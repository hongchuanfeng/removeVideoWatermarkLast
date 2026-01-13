import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
const COS = require('cos-nodejs-sdk-v5');

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check credits
    const { data: userCredits, error: creditsError } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('user_id', user.id)
      .single();

    if (creditsError || !userCredits || userCredits.credits < 1) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 });
    }

    // Log incoming request details for debugging and extract body
    let imageUrl: string | undefined;
    let regions: any;
    try {
      const body = await request.json();
      console.log('=== /api/image/remove-watermark called ===');
      console.log('Request URL:', request.url);
      console.log('Request method:', (request as any).method || 'POST');
      try {
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });
        console.log('Request headers:', headers);
      } catch (hdrErr) {
        console.log('Unable to read headers:', String(hdrErr));
      }
      console.log('Request body:', JSON.stringify(body, null, 2));
      console.log('Authenticated user:', user ? { id: user.id, email: user.email } : null);
      console.log('User credits record:', JSON.stringify(userCredits, null, 2));
      console.log('COS bucket:', process.env.TENCENT_COS_BUCKET);
      console.log('COS region:', process.env.TENCENT_COS_REGION);

      imageUrl = body?.imageUrl;
      regions = body?.regions;

      if (!imageUrl || !regions || regions.length === 0) {
        console.error('Invalid request data: missing imageUrl or regions');
        return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
      }
    } catch (bodyErr) {
      console.error('Error parsing request body:', bodyErr);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Get Tencent Cloud configuration (图片去水印配置)
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    const region = process.env.TENCENT_REGION_IMAGE || 'ap-shanghai';

    console.log('=== Image Watermark Removal Environment Variables ===');
    console.log('TENCENT_SECRET_ID:', secretId ? '[SET]' : '[NOT SET]');
    console.log('TENCENT_SECRET_KEY:', secretKey ? '[SET]' : '[NOT SET]');
    console.log('TENCENT_REGION_IMAGE from env:', process.env.TENCENT_REGION_IMAGE || '[NOT SET]');
    console.log('Using region:', region);
    console.log('===============================================');

    if (!secretId || !secretKey) {
      return NextResponse.json({ error: 'Tencent Cloud configuration missing' }, { status: 500 });
    }

    // Deduct credits first
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ credits: userCredits.credits - 1 })
      .eq('user_id', user.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 });
    }

    // Get COS configuration for image processing (上海)
    const cosBucket = process.env.TENCENT_COS_BUCKET_IMAGE;
    const cosRegion = process.env.TENCENT_COS_REGION_IMAGE;

    if (!cosBucket || !cosRegion) {
      return NextResponse.json({ error: 'COS configuration missing' }, { status: 500 });
    }

    // Extract object key from image URL
    const imageObjectKey = imageUrl.replace(`https://${cosBucket}.cos.${cosRegion}.myqcloud.com/`, '');

    // Convert regions to Tencent Cloud MaskPoly format
    // regions format: [{x, y, w, h}, ...]
    // MaskPoly format: [[[x1,y1], [x2,y2], [x3,y3], [x4,y4]], ...] (clockwise)
    const maskPolygons = regions.map((region: any) => {
      const { x, y, w, h } = region;
      // Create rectangle polygon: top-left -> top-right -> bottom-right -> bottom-left (clockwise)
      return [
        [Math.round(x), Math.round(y)],           // top-left
        [Math.round(x + w), Math.round(y)],       // top-right
        [Math.round(x + w), Math.round(y + h)],   // bottom-right
        [Math.round(x), Math.round(y + h)]        // bottom-left
      ];
    });

    // Encode MaskPoly parameter for URL
    const maskPolyStr = JSON.stringify(maskPolygons);
    const maskPolyEncoded = Buffer.from(maskPolyStr).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    console.log('Converted regions to MaskPoly format:');
    console.log('Original regions:', regions);
    console.log('MaskPoly polygons:', maskPolygons);
    console.log('MaskPoly encoded:', maskPolyEncoded);

    // Prepare request for Tencent Cloud CI (Cloud Infinite) Image Processing
    const ciRequestBody = {
      Input: {
        Object: imageObjectKey
      },
      Operations: [{
        TemplateId: process.env.TENCENT_REMOVE_WATERMARK_TEMPLATE_ID || 'removesub',
        Output: {
          Region: cosRegion,
          Bucket: cosBucket,
          Object: `processed/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        }
      }]
    };

    try {
      // Generate output key
      const outputKey = `processed/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

      console.log('Starting real Tencent Cloud CI image processing...');
      console.log('Input image:', imageObjectKey);
      console.log('Output image:', outputKey);
      console.log('MaskPoly parameter:', maskPolyEncoded);

      // Initialize COS client
      const cosClient = new COS({
        SecretId: secretId,
        SecretKey: secretKey,
      });

      // Use Tencent Cloud CI ImageRepair via download-time processing
      // This method processes the image on-the-fly and returns the result

      console.log('Using download-time processing approach...');

      // Construct the CI processing URL
      const ciProcessUrl = `https://${cosBucket}.cos.${cosRegion}.myqcloud.com/${encodeURIComponent(imageObjectKey)}?ci-process=ImageRepair&MaskPoly=${maskPolyEncoded}`;

      console.log('CI Process URL:', ciProcessUrl);

      try {
        // Use COS copyObject with Pic-Operations to process and save directly
        // This is more efficient than download-process-upload cycle

        console.log('Using COS copyObject with CI processing...');

        await new Promise((resolve, reject) => {
          cosClient.copyObject({
            Bucket: cosBucket,
            Region: cosRegion,
            Key: outputKey, // Destination
            CopySource: `${cosBucket}.cos.${cosRegion}.myqcloud.com/${encodeURIComponent(imageObjectKey)}`, // Source
            Headers: {
              'Pic-Operations': JSON.stringify({
                rules: [{
                  fileid: outputKey,
                  rule: `ci-process=ImageRepair&MaskPoly=${maskPolyEncoded}`
                }]
              })
            }
          }, (err: any, data: any) => {
            if (err) {
              console.error('CI processing via copyObject failed:', err);
              reject(err);
            } else {
              console.log('CI processing via copyObject successful:', data);
              resolve(data);
            }
          });
        });

      } catch (ciError: any) {
        console.error('CI processing error:', ciError);

        // Fallback: try the download-process-upload method
        console.log('Falling back to download-process-upload method...');

        try {
          const processedImageBuffer = await new Promise<Buffer>((resolve, reject) => {
            cosClient.getObject({
              Bucket: cosBucket,
              Region: cosRegion,
              Key: imageObjectKey,
              QueryString: `ci-process=ImageRepair&MaskPoly=${maskPolyEncoded}`,
            }, (err: any, data: any) => {
              if (err) {
                console.error('Fallback CI processing failed:', err);
                reject(err);
              } else {
                console.log('Fallback CI processing successful');
                resolve(Buffer.from(data.Body));
              }
            });
          });

          // Upload the processed image
          await new Promise((resolve, reject) => {
            cosClient.putObject({
              Bucket: cosBucket,
              Region: cosRegion,
              Key: outputKey,
              Body: processedImageBuffer,
              ContentType: 'image/jpeg',
            }, (err: any, data: any) => {
              if (err) {
                reject(err);
              } else {
                resolve(data);
              }
            });
          });

          console.log('Fallback method successful');

        } catch (fallbackError: any) {
          console.error('Both CI processing methods failed', fallbackError);
          // Include both errors if available
          const outerMsg = ciError && ciError.message ? ciError.message : String(ciError);
          const fallbackMsg = fallbackError && fallbackError.message ? fallbackError.message : String(fallbackError);
          throw new Error(`Image processing failed. copyObject error: ${outerMsg}; fallback error: ${fallbackMsg}`);
        }
      }

      console.log('Tencent Cloud CI image processing completed successfully');

      // Construct the processed image URL
      const processedImageUrl = `https://${cosBucket}.cos.${cosRegion}.myqcloud.com/${outputKey}`;

      console.log('Processed image URL:', processedImageUrl);

      // Save conversion record
      const { error: recordError } = await supabase
        .from('conversion_records')
        .insert({
          user_id: user.id,
          input_type: 'image',
          type: 'image_watermark_removed',
          file_name: 'processed-image.jpg', // 文件名用于图片处理记录
          input_url: imageUrl,
          output_url: processedImageUrl,
          status: 'completed',
          credits_used: 1
        });

      if (recordError) {
        console.error('Failed to save conversion record:', recordError);
        // Don't return error, continue with processing
      }

      console.log('Returning success response with processed image URL');

      return NextResponse.json({
        processedImageUrl,
        creditsRemaining: userCredits.credits - 1
      });

    } catch (processError) {
      console.error('Processing error:', processError);

      // Rollback credits if processing failed
      await supabase
        .from('user_credits')
        .update({ credits: userCredits.credits })
        .eq('user_id', user.id);

      return NextResponse.json({ error: 'Image processing failed' }, { status: 500 });
    }

  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

// TODO: Implement actual Tencent Cloud CI API call
// The actual implementation would require:
// 1. Proper API endpoint for image processing
// 2. Correct authentication signature
// 3. Template ID for watermark removal
// 4. Error handling for API responses
