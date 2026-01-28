import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

// 动态导入MPS SDK
let mpsModule: any;
let modelsModule: any;
try {
  mpsModule = require('tencentcloud-sdk-nodejs/tencentcloud/services/mps/v20190612/mps_client');
  modelsModule = require('tencentcloud-sdk-nodejs/tencentcloud/services/mps/v20190612/mps_models');
} catch (error) {
  console.error('Failed to load MPS SDK:', error);
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== [API] /api/video/create-task called ===');
    try {
      const hdrs: Record<string,string> = {};
      request.headers.forEach((v,k) => { hdrs[k]=v; });
      // redact cookies/authorization
      if (hdrs.authorization) hdrs.authorization = '[REDACTED]';
      if (hdrs.cookie) hdrs.cookie = '[REDACTED]';
      console.log('Request headers (sanitized):', hdrs);
    } catch (hdrErr) {
      console.warn('Failed to enumerate request headers for logging:', hdrErr);
    }
    const rawBody = await request.text();
    let body: any;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      console.warn('Failed to parse JSON body, using raw text:', parseErr);
      body = { raw: rawBody };
    }
    console.log('Request body for create-task:', body);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Authenticated user for create-task:', { id: user.id, email: user.email });
    const { cosUrl, cosKey, fileName, removalType: removalTypeRaw, videoDuration } = body;
    const durationSeconds = videoDuration ? Number(videoDuration) : undefined;

    if (!cosUrl || !cosKey || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields: cosUrl, cosKey, fileName' },
        { status: 400 }
      );
    }

    // 仅允许两类：watermark_logo | subtitle
    const removalType: 'watermark_logo' | 'subtitle' =
      removalTypeRaw === 'subtitle' ? 'subtitle' : 'watermark_logo';

    // 检查用户积分与免费试用机会
    const { data: creditsData } = await supabase
      .from('user_credits')
      .select('credits, has_used_free_trial')
      .eq('user_id', user.id)
      .maybeSingle();

    let credits = creditsData?.credits || 0;
    let hasUsedFreeTrial = creditsData?.has_used_free_trial || false;

    // 兜底：若标记缺失但已经存在免费试用记录，则视为已用
    if (!hasUsedFreeTrial) {
      const { data: freeTrialRecord } = await supabase
        .from('conversion_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('credits_used', -1)
        .limit(1);
      if (freeTrialRecord && freeTrialRecord.length > 0) {
        hasUsedFreeTrial = true;
      }
    }

    const isFreeTrial = !hasUsedFreeTrial;

    // 免费使用时限制视频时长 <= 30 秒
    if (isFreeTrial) {
      if (!durationSeconds || durationSeconds <= 0) {
        return NextResponse.json(
          { error: '无法获取视频时长，免费使用需提供时长信息' },
          { status: 400 }
        );
      }
      if (durationSeconds > 30) {
        return NextResponse.json(
          { error: '免费使用时，视频时长不能超过30秒，请订阅或充值后处理更长视频' },
          { status: 400 }
        );
      }
    } else {
      if (!durationSeconds || durationSeconds <= 0) {
        return NextResponse.json(
          { error: '无法获取视频时长，使用积分处理需提供时长信息' },
          { status: 400 }
        );
      }
      if (durationSeconds > 120) {
        return NextResponse.json(
          { error: '使用积分时，视频时长不能超过2分钟，请裁剪后再试' },
          { status: 400 }
        );
      }
    }

    // 若已用完免费机会且积分不足，则拒绝
    if (!isFreeTrial && credits <= 0) {
      return NextResponse.json(
        { error: '积分不足，请先充值后再处理视频' },
        { status: 402 }
      );
    }

    // 检查环境变量
    let bucket = process.env.TENCENT_COS_BUCKET;
    const region = process.env.TENCENT_COS_REGION || 'ap-guangzhou';

    if (!bucket) {
      console.error('TENCENT_COS_BUCKET not configured');
      return NextResponse.json(
        { error: 'Server configuration error: COS bucket not configured' },
        { status: 500 }
      );
    }

    // 清理存储桶名称
    bucket = bucket.trim();
    if (bucket.includes('.cos.')) {
      bucket = bucket.split('.cos.')[0];
    }
    bucket = bucket.replace(/^https?:\/\//, '').split('/')[0];

    // 创建转换记录
    const { data: record, error: recordError } = await supabase
      .from('conversion_records')
      .insert({
        user_id: user.id,
        type: `${removalType}_removal`,
        file_name: fileName,
        status: 'pending',
        original_file_url: cosUrl,
        progress: 0,
        credits_used: isFreeTrial ? -1 : 0,
        video_duration: durationSeconds ? Math.ceil(durationSeconds) : null,
      })
      .select()
      .single();

    if (recordError) {
      console.error('Error creating record:', recordError);
      console.error('Error creating record:', recordError);
      return NextResponse.json(
        {
          error: 'Failed to create record',
          details: recordError.message,
          code: recordError.code,
        },
        { status: 500 }
      );
    }
    console.log('Created conversion record:', record);

    // 如果使用免费试用，立即标记已使用
    if (isFreeTrial) {
      await supabase
        .from('user_credits')
        .upsert(
          {
            user_id: user.id,
            has_used_free_trial: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    }

    // 调用腾讯云视频智能擦除API
    try {
      if (!mpsModule || !modelsModule) {
        throw new Error('MPS SDK not loaded');
      }

      const MpsClient = mpsModule.Client;
      if (!MpsClient) {
        throw new Error('MpsClient not found in SDK module');
      }

      const client = new MpsClient({
        credential: {
          secretId: process.env.TENCENT_SECRET_ID!,
          secretKey: process.env.TENCENT_SECRET_KEY!,
        },
        region: region,
      });

      // 构建智能擦除请求
      const outputDir = `/results/${user.id}/`;

      // 根据类型选择模板
      const isSubtitle = removalType === 'subtitle';
      const smartEraseDefinition = isSubtitle
        ? Number(process.env.removesub || 101)
        : Number(process.env.removewatermark || 201);

      const smartEraseTask: any = {
        Definition: smartEraseDefinition,
      };

      // 构建智能擦除任务参数
      const req: any = {
        InputInfo: {
          Type: 'COS',
          CosInputInfo: {
            Bucket: bucket,
            Region: region,
            Object: cosKey,
          },
        },
        SmartEraseTask: smartEraseTask,
        OutputStorage: {
          Type: 'COS',
          CosOutputStorage: {
            Bucket: bucket,
            Region: region,
          },
        },
        OutputDir: outputDir,
      };

      console.log('Calling Tencent Cloud MPS API...');
      console.log('SmartEraseTask payload:', JSON.stringify(req.SmartEraseTask, null, 2));

      // 调用API
      const taskResponse = await client.ProcessMedia(req);

      console.log('MPS API response (taskResponse):', taskResponse);

      // 更新记录，保存任务ID
      await supabase
        .from('conversion_records')
        .update({
          task_id: taskResponse.TaskId,
          status: 'processing',
        })
        .eq('id', record.id);

      return NextResponse.json({
        success: true,
        recordId: record.id,
        taskId: taskResponse.TaskId,
      });
    } catch (mpsError: any) {
      console.error('MPS API error:', mpsError);

      // 即使MPS API调用失败，也保存记录，以便后续重试
      await supabase
        .from('conversion_records')
        .update({
          status: 'failed',
        })
        .eq('id', record.id);

      return NextResponse.json(
        {
          error: 'Failed to start video processing',
          details: mpsError.message || 'Unknown error',
          recordId: record.id,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create task' },
      { status: 500 }
    );
  }
}

