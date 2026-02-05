import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
const COS = require('cos-nodejs-sdk-v5');

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: userCredits,
      error: creditsError,
    } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', user.id)
      .single();

    if (creditsError || !userCredits || userCredits.credits < 1) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 });
    }

    let imageUrl: string | undefined;
    try {
      const body = await request.json();
      console.log('=== /api/image/cutout called ===');
      console.log('Request body:', JSON.stringify(body, null, 2));
      imageUrl = body?.imageUrl;
      if (!imageUrl) {
        return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
      }
    } catch (bodyErr) {
      console.error('Error parsing request body:', bodyErr);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    if (!secretId || !secretKey) {
      return NextResponse.json({ error: 'Tencent Cloud configuration missing' }, { status: 500 });
    }

    const cosBucket = process.env.TENCENT_COS_BUCKET_IMAGE;
    const cosRegion = process.env.TENCENT_COS_REGION_IMAGE;
    if (!cosBucket || !cosRegion) {
      return NextResponse.json({ error: 'COS configuration missing' }, { status: 500 });
    }

    // 先扣减积分
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ credits: userCredits.credits - 1 })
      .eq('user_id', user.id);
    if (updateError) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    // 从 imageUrl 中解析对象键（兼容 accelerate.removewatermarker.com 与 COS 域名）
    let imageObjectKey: string;
    try {
      const cosDomainPrefix = `https://${cosBucket}.cos.${cosRegion}.myqcloud.com/`;
      const acceleratePrefix = 'https://accelerate.removewatermarker.com/';

      if (imageUrl.startsWith(cosDomainPrefix)) {
        imageObjectKey = imageUrl.replace(cosDomainPrefix, '');
      } else if (imageUrl.startsWith(acceleratePrefix)) {
        imageObjectKey = imageUrl.replace(acceleratePrefix, '');
      } else if (imageUrl.startsWith('https://')) {
        const parsed = new URL(imageUrl);
        imageObjectKey = parsed.pathname.replace(/^\//, '');
      } else {
        imageObjectKey = imageUrl;
      }
    } catch (keyErr) {
      console.error('Failed to determine image object key from imageUrl:', keyErr);
      // 回滚积分
      await supabase
        .from('user_credits')
        .update({ credits: userCredits.credits })
        .eq('user_id', user.id);
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
    }

    const outputKey = `cutout/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const rule =
      process.env.TENCENT_CI_CUTOUT_RULE ||
      // 默认规则占位，需根据文档在环境变量中配置真实参数
      'ci-process=Matting';

    try {
      const cosClient = new COS({
        SecretId: secretId,
        SecretKey: secretKey,
      });

      await new Promise((resolve, reject) => {
        cosClient.copyObject(
          {
            Bucket: cosBucket,
            Region: cosRegion,
            Key: outputKey,
            CopySource: `${cosBucket}.cos.${cosRegion}.myqcloud.com/${encodeURIComponent(imageObjectKey)}`,
            Headers: {
              'Pic-Operations': JSON.stringify({
                rules: [
                  {
                    fileid: outputKey,
                    rule,
                  },
                ],
              }),
            },
          },
          (err: any, data: any) => {
            if (err) {
              console.error('Image cutout CI processing error:', err);
              reject(err);
            } else {
              console.log('Image cutout CI processing success:', data);
              resolve(data);
            }
          },
        );
      });

      const processedImageUrl = `https://accelerate.removewatermarker.com/${outputKey}`;

      const { error: recordError } = await supabase.from('conversion_records').insert({
        user_id: user.id,
        input_type: 'image',
        type: 'image_cutout',
        file_name: 'cutout-image.png',
        input_url: imageUrl,
        output_url: processedImageUrl,
        status: 'completed',
        credits_used: 1,
      });
      if (recordError) {
        console.error('Failed to save cutout conversion record:', recordError);
      }

      return NextResponse.json({
        processedImageUrl,
        creditsRemaining: userCredits.credits - 1,
      });
    } catch (processError) {
      console.error('Image cutout processing error:', processError);
      // 回滚积分
      await supabase
        .from('user_credits')
        .update({ credits: userCredits.credits })
        .eq('user_id', user.id);
      return NextResponse.json({ error: 'Image processing failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected cutout error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}


