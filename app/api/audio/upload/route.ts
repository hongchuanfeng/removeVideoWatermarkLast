import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }
    // Mock upload - in production, upload to COS or storage
    const fileExt = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const allowedExts = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma'];
    if (!allowedExts.includes(fileExt)) {
      return NextResponse.json({ error: 'invalid format' }, { status: 400 });
    }
    const key = `audio/${Date.now()}-${Math.random().toString(36).slice(2,9)}.${fileExt}`;
    const publicUrl = `https://accelerate.removewatermarker.com/${key}`;
    return NextResponse.json({ url: publicUrl, fileName: key });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }
}

