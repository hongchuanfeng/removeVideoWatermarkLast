import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 打印所有请求参数
    console.log('=== PDF上传接口参数打印 ===');
    console.log('1. 请求头 (Request Headers):');
    console.log('Content-Type:', request.headers.get('content-type'));
    console.log('Content-Length:', request.headers.get('content-length'));
    console.log('User-Agent:', request.headers.get('user-agent'));
    console.log('Authorization:', request.headers.get('authorization') ? '[PRESENT]' : '[NOT PRESENT]');
    console.log('All Headers:', Object.fromEntries(request.headers.entries()));

    const formData = await request.formData();

    console.log('\n2. FormData 参数:');
    console.log('FormData 字段数量:', [...formData.keys()].length);

    // 打印所有FormData字段
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`字段: ${key}`);
        console.log(`  - 类型: File`);
        console.log(`  - 文件名: ${value.name}`);
        console.log(`  - 文件类型: ${value.type}`);
        console.log(`  - 文件大小: ${value.size} bytes (${(value.size / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`  - 最后修改时间: ${value.lastModified}`);
      } else {
        console.log(`字段: ${key} = ${value}`);
      }
    }

    const file = formData.get('file') as File;

    console.log('\n3. 主要文件参数详情:');
    if (file) {
      console.log(`文件名: ${file.name}`);
      console.log(`文件类型: ${file.type}`);
      console.log(`文件大小: ${file.size} bytes`);
      console.log(`文件大小(MB): ${(file.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`最后修改时间: ${new Date(file.lastModified).toISOString()}`);
    } else {
      console.log('未找到文件参数');
    }

    console.log('\n4. 环境变量检查:');
    console.log('TENCENT_SECRET_ID:', process.env.TENCENT_SECRET_ID ? '[SET]' : '[NOT SET]');
    console.log('TENCENT_SECRET_KEY:', process.env.TENCENT_SECRET_KEY ? '[SET]' : '[NOT SET]');
    console.log('TENCENT_COS_BUCKET_PDF:', process.env.TENCENT_COS_BUCKET_PDF || '[NOT SET]');
    console.log('TENCENT_COS_REGION_PDF:', process.env.TENCENT_COS_REGION_PDF || '[NOT SET]');

    console.log('\n=== 参数打印结束 ===\n');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Validate file size (max 20MB for PDF)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 20MB' }, { status: 400 });
    }

    // Get environment variables (PDF去水印配置)
    const secretId = process.env.TENCENT_SECRET_ID;
    const secretKey = process.env.TENCENT_SECRET_KEY;
    const bucket = process.env.TENCENT_COS_BUCKET_PDF;
    const region = process.env.TENCENT_COS_REGION_PDF;

    if (!secretId || !secretKey || !bucket || !region) {
      return NextResponse.json({ error: 'Tencent Cloud configuration missing' }, { status: 500 });
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Tencent COS
    const COS = await import('cos-nodejs-sdk-v5');
    const cos = new COS.default({
      SecretId: secretId,
      SecretKey: secretKey,
    });

    const fileName = `pdfs/${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`;

    await new Promise((resolve, reject) => {
      cos.putObject({
        Bucket: bucket,
        Region: region,
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
      }, (err: any, data: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    // Generate public URL
    const publicUrl = `https://accelerate.removewatermarker.com/${fileName}`;

    console.log('\n5. 上传结果:');
    console.log('生成的文件名:', fileName);
    console.log('公开URL:', publicUrl);
    console.log('PDF上传成功 ✅');

    const response = {
      url: publicUrl,
      fileName,
    };

    console.log('返回响应:', JSON.stringify(response, null, 2));
    console.log('\n=== PDF上传接口处理完成 ===\n');

    return NextResponse.json(response);

  } catch (error) {
    console.log('\n❌ PDF上传过程中发生错误:');
    console.log('错误类型:', error instanceof Error ? error.constructor.name : typeof error);
    console.log('错误消息:', error instanceof Error ? error.message : String(error));
    console.log('错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');
    console.log('=== PDF上传接口错误结束 ===\n');

    console.error('PDF upload error:', error);
    return NextResponse.json({
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
