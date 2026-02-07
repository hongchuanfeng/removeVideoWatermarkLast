import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userCredits, error: creditsError } = await supabase
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
      imageUrl = body?.imageUrl;

      if (!imageUrl) {
        return NextResponse.json({ error: 'Invalid request data: missing imageUrl' }, { status: 400 });
      }
    } catch (bodyErr) {
      console.error('Error parsing request body:', bodyErr);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Deduct credits first
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ credits: userCredits.credits - 1 })
      .eq('user_id', user.id);
    if (updateError) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    try {
      // Determine the object key from the URL
      let imageObjectKey: string;
      const cosDomainPrefix = `https://${process.env.TENCENT_COS_BUCKET_IMAGE}.cos.${process.env.TENCENT_COS_REGION_IMAGE}.myqcloud.com/`;
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

      const outputKey = `colorization/${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      
      // Use Tencent CI Image Colorization API
      // ci-process=Colourize for image colorization
      const ciColorizationRule = process.env.TENCENT_CI_COLORIZATION_RULE || 'ci-process=Colourize';

      const COS = require('cos-nodejs-sdk-v5');
      const secretId = process.env.TENCENT_SECRET_ID;
      const secretKey = process.env.TENCENT_SECRET_KEY;
      const cosBucket = process.env.TENCENT_COS_BUCKET_IMAGE;
      const cosRegion = process.env.TENCENT_COS_REGION_IMAGE;

      if (!secretId || !secretKey || !cosBucket || !cosRegion) {
        await supabase.from('user_credits').update({ credits: userCredits.credits }).eq('user_id', user.id);
        return NextResponse.json({ error: 'Tencent Cloud configuration missing' }, { status: 500 });
      }

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
                    rule: ciColorizationRule,
                  },
                ],
              }),
            },
          },
          (err: any, data: any) => {
            if (err) reject(err);
            else resolve(data);
          },
        );
      });

      const processedImageUrl = `https://accelerate.removewatermarker.com/${outputKey}`;

      const { error: recordError } = await supabase.from('conversion_records').insert({
        user_id: user.id,
        input_type: 'image',
        type: 'image_colorization',
        file_name: 'colorized-image.png',
        input_url: imageUrl,
        output_url: processedImageUrl,
        status: 'completed',
        credits_used: 1,
      });
      if (recordError) {
        console.error('Failed to save conversion record:', recordError);
      }

      return NextResponse.json({
        processedImageUrl,
        creditsRemaining: userCredits.credits - 1,
      });
    } catch (processError) {
      console.error('Image colorization processing error:', processError);
      await supabase.from('user_credits').update({ credits: userCredits.credits }).eq('user_id', user.id);
      return NextResponse.json({ error: 'Image processing failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

