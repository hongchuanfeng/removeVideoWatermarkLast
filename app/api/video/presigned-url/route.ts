import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

// 动态导入COS SDK
let COS: any;
try {
  COS = require('cos-nodejs-sdk-v5');
} catch (error) {
  console.error('Failed to load COS SDK:', error);
}

// 初始化腾讯云COS客户端
function getCosClient() {
  if (!COS) {
    throw new Error('COS SDK not loaded');
  }
  
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  
  if (!secretId || !secretKey) {
    throw new Error('Tencent Cloud credentials not configured');
  }
  
  const cosClient = new COS({
    SecretId: secretId.trim(),
    SecretKey: secretKey.trim(),
    Timeout: 60000,
  });
  
  return cosClient;
}

// 生成预签名URL
export async function POST(request: NextRequest) {
  try {
    console.log('=== [API] /api/video/presigned-url called ===');
    console.log('Request method:', request.method);
    console.log('Request URL:', request.url);

    // 打印请求头（排除敏感信息）
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      if (!key.toLowerCase().includes('authorization') && !key.toLowerCase().includes('cookie')) {
        headers[key] = value;
      } else if (key.toLowerCase().includes('authorization')) {
        headers[key] = '[PRESENT]';
      } else if (key.toLowerCase().includes('cookie')) {
        headers[key] = '[COOKIES PRESENT]';
      }
    });
    console.log('Request headers:', headers);

    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    console.log('Auth check result:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message
    });

    if (authError) {
      console.error('Authentication error:', authError);
      return NextResponse.json({
        error: 'Authentication failed',
        details: authError.message
      }, { status: 401 });
    }

    if (!user) {
      console.log('No authenticated user found');
      return NextResponse.json({
        error: 'Unauthorized - Please log in first',
        details: 'User authentication required for video upload. Please refresh the page and log in with Google.'
      }, { status: 401 });
    }

    console.log('User authenticated successfully:', user.id);

    const body = await request.json();
    const { fileName, fileSize, contentType, videoDuration } = body;
    const durationSeconds = videoDuration ? Number(videoDuration) : undefined;

    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

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

    // 检查环境变量 (视频去水印配置)
    let bucket = process.env.TENCENT_COS_BUCKET;
    const region = process.env.TENCENT_COS_REGION || 'ap-guangzhou';

    console.log('=== Video Upload Environment Variables ===');
    console.log('TENCENT_COS_BUCKET from env:', process.env.TENCENT_COS_BUCKET);
    console.log('TENCENT_COS_REGION from env:', process.env.TENCENT_COS_REGION);
    console.log('Final bucket:', bucket);
    console.log('Final region:', region);
    console.log('All TENCENT_* vars:', Object.keys(process.env).filter(key => key.startsWith('TENCENT_')).map(key => `${key}=${process.env[key]}`).join(', '));
    console.log('=======================================');

    if (!bucket) {
      console.error('TENCENT_COS_BUCKET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 清理存储桶名称
    bucket = bucket.trim();
    if (bucket.includes('.cos.')) {
      bucket = bucket.split('.cos.')[0];
    }
    bucket = bucket.replace(/^https?:\/\//, '').split('/')[0];

    // 生成文件路径
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const cosKey = `uploads/${Date.now()}-${sanitizedFileName}`;

    // 使用COS SDK生成预签名URL
    const cos = getCosClient();
    const presignedUrl = await new Promise<string>((resolve, reject) => {
      // 尝试使用 getObjectUrl 方法生成 PUT 请求的预签名 URL
      // 如果失败，尝试使用 getPreSignedUrl
      const params: any = {
        Bucket: bucket,
        Region: region,
        Key: cosKey,
        Method: 'PUT',
        Expires: 3600, // 1小时有效期
        Sign: true,
      };

      // 如果指定了 ContentType，添加到参数中
      if (contentType) {
        params.ContentType = contentType;
      }

      // 首先尝试 getObjectUrl
      if (typeof cos.getObjectUrl === 'function') {
        cos.getObjectUrl(
          params,
          (err: any, data: any) => {
            if (err) {
              console.error('getObjectUrl error:', err);
              // 如果 getObjectUrl 失败，尝试 getPreSignedUrl
              tryGetPreSignedUrl();
            } else {
              console.log('Presigned URL generated via getObjectUrl:', {
                url: data.Url,
                bucket,
                region,
                cosKey,
              });
              resolve(data.Url);
            }
          }
        );
      } else {
        // 如果 getObjectUrl 不存在，直接尝试 getPreSignedUrl
        tryGetPreSignedUrl();
      }

      function tryGetPreSignedUrl() {
        if (typeof cos.getPreSignedUrl === 'function') {
          cos.getPreSignedUrl(
            params,
            (err: any, data: any) => {
              if (err) {
                console.error('getPreSignedUrl error:', err);
                console.error('Error details:', JSON.stringify(err, null, 2));
                reject(err);
              } else {
                console.log('Presigned URL generated via getPreSignedUrl:', {
                  url: data.Url || data,
                  bucket,
                  region,
                  cosKey,
                });
                resolve(data.Url || data);
              }
            }
          );
        } else {
          reject(new Error('Neither getObjectUrl nor getPreSignedUrl method found in COS SDK'));
        }
      }
    });

    console.log('Generated presigned URL:', {
      bucket,
      region,
      cosKey,
      expiresIn: 3600,
      contentType: contentType || 'video/mp4',
    });
    // Also provide an accelerate domain variant (same path/query but with accelerate host).
    // Note: signature is usually tied to host; ensure accelerate domain is configured as a proxy if you intend to PUT to it.
    let acceleratePresignedUrl = presignedUrl;
    try {
      const u = new URL(presignedUrl);
      u.hostname = 'accelerate.removewatermarker.com';
      acceleratePresignedUrl = u.toString();
      console.log('Generated acceleratePresignedUrl (host replaced):', acceleratePresignedUrl);
    } catch (err) {
      console.warn('Failed to construct acceleratePresignedUrl, will return original presignedUrl:', err);
    }

    return NextResponse.json({
      presignedUrl,
      acceleratePresignedUrl,
      cosKey,
      bucket,
      region,
      expiresIn: 3600,
    });
  } catch (error: any) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate presigned URL' },
      { status: 500 }
    );
  }
}

