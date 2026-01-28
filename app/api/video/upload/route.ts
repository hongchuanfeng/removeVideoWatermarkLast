import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
// Vercel 配置：允许更长的执行时间（最大 300 秒，Pro 计划）
export const maxDuration = 300;
// 使用 Node.js runtime
export const runtime = 'nodejs';

// 动态导入COS SDK以避免类型错误
let COS: any;
try {
  COS = require('cos-nodejs-sdk-v5');
} catch (error) {
  console.error('Failed to load COS SDK:', error);
}

// 初始化腾讯云COS客户端（延迟初始化）
function getCosClient() {
  if (!COS) {
    throw new Error('COS SDK not loaded');
  }
  
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  
  if (!secretId || !secretKey) {
    throw new Error('Tencent Cloud credentials not configured');
  }
  
  // 初始化 COS 客户端，确保使用正确的配置
  // 注意：腾讯云 COS SDK v5 使用 SecretId 和 SecretKey（首字母大写）
  const cosClient = new COS({
    SecretId: secretId.trim(),
    SecretKey: secretKey.trim(),
    // 可选：设置默认区域（如果所有操作都在同一区域，可以设置）
    // Region: process.env.TENCENT_COS_REGION || 'ap-guangzhou',
    // 设置请求超时时间（毫秒）
    Timeout: 60000,
    // 确保使用正确的域名格式：bucket.cos.region.myqcloud.com
    // 对于包含 appid 的存储桶名称（如 test-1308733829），SDK 应该自动构建正确的域名
    // 如果 SDK 构建的域名缺少 .cos.，可能需要更新 SDK 版本或检查配置
  });
  
  return cosClient;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查请求大小（Vercel 默认限制 4.5MB，但可以通过配置增加到 150MB）
    const contentLength = request.headers.get('content-length');
    if (contentLength) {
      const sizeInMB = parseInt(contentLength) / (1024 * 1024);
      console.log(`Request size: ${sizeInMB.toFixed(2)} MB`);
      
      // Vercel Hobby 计划限制 4.5MB，Pro 计划可以配置到 150MB
      // 设置安全边界为 140MB（略小于配置的 150MB）
      if (sizeInMB > 140) {
        return NextResponse.json(
          { 
            error: 'File too large',
            message: 'File size exceeds the maximum allowed limit. Please use a smaller file or upgrade your plan.',
            maxSize: '140MB'
          },
          { status: 413 }
        );
      }
    }

    // 使用 try-catch 包装 formData 解析，以捕获可能的 403 错误
    let formData: FormData;
    try {
      formData = await request.formData();
      // Debug: log headers and formData keys
      try {
        const hdrs: Record<string, string> = {};
        request.headers.forEach((v, k) => { hdrs[k] = v; });
        console.log('Upload request headers:', hdrs);
      } catch (hdrErr) {
        console.warn('Unable to enumerate request headers for logging:', hdrErr);
      }
      console.log('FormData keys:', Array.from(formData.keys()));
    } catch (error: any) {
      console.error('Error parsing formData:', error);
      // 如果是 403 或请求体相关的错误，提供更友好的错误信息
      if (error.message?.includes('403') || error.message?.includes('Forbidden') || error.message?.includes('body')) {
        return NextResponse.json(
          {
            error: 'Request too large',
            message: 'The file you are trying to upload is too large for the current server configuration. Please try a smaller file or contact support.',
            details: 'Vercel Serverless Functions have request body size limits. For large files, consider using direct upload to cloud storage.'
          },
          { status: 413 }
        );
      }
      throw error;
    }

    const file = formData.get('file') as File;
    const removalTypeRaw = (formData.get('type') as string) || 'watermark_logo';
    // 仅允许两类：watermark_logo | subtitle
    const removalType: 'watermark_logo' | 'subtitle' =
      removalTypeRaw === 'subtitle' ? 'subtitle' : 'watermark_logo';

    if (!file) {
      console.log('No file provided in upload formData.');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    } else {
      try {
        console.log('Received file metadata:', {
          name: (file as File).name,
          size: (file as File).size,
          type: (file as File).type,
        });
      } catch (metaErr) {
        console.warn('Failed to read file metadata for logging:', metaErr);
      }
    }

    // 检查文件类型
    if (!file.type?.startsWith('video/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // 检查文件大小
    const fileSizeInMB = file.size / (1024 * 1024);
    console.log(`File size: ${fileSizeInMB.toFixed(2)} MB`);
    
    // 设置安全边界为 140MB（略小于配置的 150MB）
    if (fileSizeInMB > 140) {
      return NextResponse.json(
        {
          error: 'File too large',
          message: `File size (${fileSizeInMB.toFixed(2)} MB) exceeds the maximum allowed limit (140 MB).`,
          maxSize: '140MB'
        },
        { status: 413 }
      );
    }

    // 检查用户积分与免费试用机会
    const { data: creditsData } = await supabase
      .from('user_credits')
      .select('credits, has_used_free_trial')
      .eq('user_id', user.id)
      .maybeSingle();

    let credits = creditsData?.credits || 0;
    let hasUsedFreeTrial = creditsData?.has_used_free_trial || false;
    console.log('Upload: user credits info', {
      userId: user.id,
      credits,
      hasUsedFreeTrial,
    });

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
        // 同步回 user_credits，避免后续再放行
        await supabase
          .from('user_credits')
          .upsert(
            {
              user_id: user.id,
              has_used_free_trial: true,
              credits, // 保持原值
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
      }
    }

    const isFreeTrial = !hasUsedFreeTrial; // 有且仅有一次免费机会

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

    // 清理存储桶名称（支持包含 appid 的格式，如 test-1308733829）
    bucket = bucket.trim();
    // 如果包含完整域名，提取存储桶名（保留 appid）
    if (bucket.includes('.cos.')) {
      bucket = bucket.split('.cos.')[0];
    }
    // 移除协议前缀
    bucket = bucket.replace(/^https?:\/\//, '');
    // 移除路径部分
    bucket = bucket.split('/')[0];

    console.log('Using bucket name:', bucket);
    console.log('Using region:', region);

    // 读取文件并上传到腾讯云COS
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    // 使用 uploads/ 目录，与其他项目保持一致
    const cosKey = `uploads/${fileName}`;

    console.log(`Uploading file to COS:`);
    console.log(`  Bucket: ${bucket}`);
    console.log(`  Region: ${region}`);
    console.log(`  Key: ${cosKey}`);
    console.log(`  File size: ${buffer.length} bytes`);

    // 获取COS客户端并上传
    const cos = getCosClient();
    
    // 上传到腾讯云COS
    const uploadResult = await new Promise<any>((resolve, reject) => {
      // 确保参数格式正确
      // 对于包含 appid 的存储桶名称（如 test-1308733829），SDK 会自动构建正确的域名
      // 域名格式：bucket.cos.region.myqcloud.com
      const uploadParams: any = {
        Bucket: bucket,
        Region: region,
        Key: cosKey,
        Body: buffer,
        ContentType: file.type || 'video/mp4',
        // 添加超时设置
        Timeout: 60000, // 60秒超时
      };
      
      // 确保使用正确的域名格式：bucket.cos.region.myqcloud.com
      // 对于包含 appid 的存储桶名称（如 test-1308733829），SDK 应该自动构建正确的域名
      const expectedDomain = `${bucket}.cos.${region}.myqcloud.com`;
      console.log('Expected domain format:', expectedDomain);
      
      // 注意：COS SDK v5 应该自动构建正确的域名格式
      // 如果 SDK 构建的域名缺少 .cos.，可能是 SDK 版本问题
      // 可以尝试使用自定义域名配置，但需要检查 SDK 是否支持
      
      console.log('Upload params:', {
        Bucket: uploadParams.Bucket,
        Region: uploadParams.Region,
        Key: uploadParams.Key,
        ContentType: uploadParams.ContentType,
        BodySize: buffer.length,
      });
      
      cos.putObject(
        uploadParams,
        (err: any, data: any) => {
          if (err) {
            console.error('COS upload error details:');
            console.error('  Error code:', err.code);
            console.error('  Error message:', err.message);
            console.error('  Error statusCode:', err.statusCode);
            console.error('  Error requestId:', err.requestId);
            console.error('  Error hostname:', err.hostname);
            console.error('  Full error:', JSON.stringify(err, null, 2));
            
            // 提供更友好的错误信息
            let errorMessage = 'Failed to upload file to cloud storage';
            if (err.error?.code === 'ENOENT' || err.code === 'ENOENT' || err.message?.includes('getaddrinfo') || err.error?.syscall === 'getaddrinfo') {
              const hostname = err.error?.hostname || err.hostname || 'unknown';
              const expectedDomain = `${bucket}.cos.${region}.myqcloud.com`;
              
              // 检查域名格式是否正确
              if (!hostname.includes('.cos.')) {
                errorMessage = `域名格式错误：SDK 构建的域名为 "${hostname}"，缺少 ".cos."\n`;
                errorMessage += `正确的域名格式应该是：${expectedDomain}\n`;
                errorMessage += `这可能是 SDK 版本问题，请尝试更新 cos-nodejs-sdk-v5 到最新版本`;
              } else {
                errorMessage = `Cannot resolve storage bucket domain "${hostname}". `;
                errorMessage += `Please check:\n`;
                errorMessage += `1. Bucket name "${bucket}" is correct\n`;
                errorMessage += `2. Region "${region}" matches the bucket's actual region\n`;
                errorMessage += `3. The bucket exists in your Tencent Cloud account\n`;
                errorMessage += `4. Your network can access Tencent Cloud services\n`;
                errorMessage += `Expected domain: ${expectedDomain}`;
              }
            } else if (err.statusCode === 403) {
              errorMessage = 'Access denied. Please check your cloud storage credentials (SecretId and SecretKey).';
            } else if (err.statusCode === 404) {
              errorMessage = `Storage bucket "${bucket}" not found. Please check the bucket name is correct.`;
            } else if (err.statusCode === 400) {
              errorMessage = `Bad request. Please check bucket name "${bucket}" and region "${region}" are correct.`;
            }
            
            reject(new Error(errorMessage));
          } else {
            console.log('COS upload success:', JSON.stringify(data, null, 2));
            resolve(data);
          }
        }
      );
    });

    // 构建公开访问的 URL
    // 改为使用加速域名 https://accelerate.removewatermarker.com/（上传返回的 URL 已经为完整 https URL）
    // 不再拼接 COS 域名，保证后续接口收到的 original_file_url 是完整可访问的 URL
    const cosUrl = `https://accelerate.removewatermarker.com/${cosKey}`;
    console.log('Using accelerate URL for uploaded video:', cosUrl);
    console.log('Upload result (uploadResult):', JSON.stringify(uploadResult, null, 2));
    // Debug: full upload context
    console.log('Upload debug:', {
      bucket,
      region,
      cosKey,
      cosUrl,
      uploadResult,
    });

    // 创建转换记录
    const { data: record, error: recordError } = await supabase
      .from('conversion_records')
      .insert({
        user_id: user.id,
        type: `${removalType}_removal`,
        file_name: file.name,
        status: 'pending',
        original_file_url: cosUrl,
        progress: 0,
        // 免费试用标记为 -1，后续不再扣积分；正常流程为 0，后续扣积分
        credits_used: isFreeTrial ? -1 : 0,
      })
      .select()
      .single();

    if (recordError) {
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

    // 调用腾讯云视频智能擦除API
    try {
      const mpsModule = require('tencentcloud-sdk-nodejs/tencentcloud/services/mps/v20190612/mps_client');
      const modelsModule = require('tencentcloud-sdk-nodejs/tencentcloud/services/mps/v20190612/mps_models');
      
      // 腾讯云 SDK 导出的是 Client
      const MpsClient = mpsModule.Client;
      const models = modelsModule;

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

      // 构建智能擦除请求
      // OutputDir 必须以 / 开头和结尾
      const outputDir = `/results/${user.id}/`;

      // 根据类型选择模板和配置
      const isSubtitle = removalType === 'subtitle';
      // 模板ID：去字幕=101，去水印/Logo=201（可通过 env 覆盖）
      const smartEraseDefinition = isSubtitle
        ? Number(process.env.removesub || 101)
        : Number(process.env.removewatermark || 201);

      // 仅使用模板 ID，不再附加 EraseSubtitleConfig 避免参数错误
      const smartEraseTask: any = {
        Definition: smartEraseDefinition,
      };

      // 构建智能擦除任务参数（按腾讯云文档要求）
      const req: any = {
        InputInfo: {
          Type: 'COS',
          CosInputInfo: {
            Bucket: bucket,
            Region: region,
            Object: cosKey,
          },
        },
        // 智能擦除任务，顶层参数（非 MediaProcessTask 内）
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

      const responseObj = {
        success: true,
        recordId: record.id,
        taskId: taskResponse.TaskId,
      };
      console.log('Returning response from /api/video/upload:', responseObj);
      return NextResponse.json(responseObj);
    } catch (mpsError: any) {
      console.error('MPS API error:', mpsError);
      
      // 即使MPS API调用失败，也保存记录，以便后续重试
      await supabase
        .from('conversion_records')
        .update({
          status: 'failed',
        })
        .eq('id', record.id);
      
      // 返回更详细的错误信息
      return NextResponse.json(
        { 
          error: 'Failed to start video processing',
          details: mpsError.message || 'Unknown error',
          recordId: record.id, // 返回记录ID以便调试
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Upload error:', error);
    console.error('Error stack:', error.stack);
    
    // 返回更详细的错误信息
    const errorMessage = error.message || 'Upload failed';
    const errorDetails = {
      error: errorMessage,
      type: error.name || 'UnknownError',
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        details: error.toString(),
      }),
    };
    
    return NextResponse.json(
      errorDetails,
      { status: 500 }
    );
  }
}

