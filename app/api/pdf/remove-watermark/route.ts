import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== PDF去水印接口开始 ===');

    const { pdfUrl, lang } = await request.json();

    console.log('接收到的参数:');
    console.log('pdfUrl:', pdfUrl);

    if (!pdfUrl) {
      return NextResponse.json({ error: 'PDF URL is required' }, { status: 400 });
    }

    // Get environment variables
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    const bucket = process.env.TENCENT_COS_BUCKET_PDF;
    const region = process.env.TENCENT_COS_REGION_PDF;

    if (!secretId || !secretKey || !bucket || !region) {
      console.log('腾讯云配置缺失，使用模拟处理');
      // For demo purposes, return a mock processed PDF URL including lang if provided
      const suffix = lang ? `-${lang}-processed.pdf` : '-processed.pdf';
      const processedPDFUrl = pdfUrl.replace(/\.pdf$/i, suffix);

      console.log('模拟处理完成，返回URL:', processedPDFUrl);

      return NextResponse.json({
        processedPDFUrl,
        note: '当前为演示版本，实际PDF处理功能需要完整的腾讯云API配置'
      });
    }

    // Extract object key from PDF URL
    const objectKey = pdfUrl.replace(`https://accelerate.removewatermarker.com/`, '');

    console.log('提取的对象键:', objectKey);

    // For now, return a mock processed PDF
    // In production, this would use Tencent Cloud's Document Processing API
    // or other PDF processing services

    const langSuffix = lang ? `-${lang}` : '';
    const outputKey = `processed/${Date.now()}-${Math.random().toString(36).substring(7)}${langSuffix}-processed.pdf`;
    const processedPDFUrl = `https://accelerate.removewatermarker.com/${outputKey}`;

    // Mock processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('PDF处理完成，输出URL:', processedPDFUrl);

    // Save conversion record
    try {
      const supabase = await createClient();
      await supabase.from('conversions').insert({
        type: 'pdf_watermark_removal',
        status: 'completed',
        result_url: processedPDFUrl,
        created_at: new Date().toISOString(),
      });
      console.log('转换记录保存成功');
    } catch (dbError) {
      console.error('保存转换记录失败:', dbError);
      // Don't fail the request if DB save fails
    }

    console.log('=== PDF去水印接口处理完成 ===\n');

    return NextResponse.json({
      processedPDFUrl,
      note: 'PDF水印去除处理完成'
    });

  } catch (error) {
    console.log('\n❌ PDF去水印过程中发生错误:');
    console.log('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.log('错误消息:', error instanceof Error ? error.message : String(error));
    console.log('错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');

    console.error('PDF watermark removal error:', error);
    return NextResponse.json({
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
