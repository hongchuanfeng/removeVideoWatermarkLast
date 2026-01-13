import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const envFilePath = join(process.cwd(), '.env.local');
  let envFileContent = 'File not found or cannot be read';

  try {
    if (existsSync(envFilePath)) {
      envFileContent = readFileSync(envFilePath, 'utf-8');
    }
  } catch (error: any) {
    envFileContent = `Error reading file: ${error.message}`;
  }

  return NextResponse.json({
    message: 'Environment variables and .env.local file check',
    env_file_exists: existsSync(envFilePath),
    env_file_content: envFileContent,
    loaded_variables: {
      video_processing: {
        TENCENT_REGION: process.env.TENCENT_REGION || '[NOT SET]',
        TENCENT_COS_BUCKET: process.env.TENCENT_COS_BUCKET || '[NOT SET]',
        TENCENT_COS_REGION: process.env.TENCENT_COS_REGION || '[NOT SET]',
        TENCENT_COS_UPLOAD_DIR: process.env.TENCENT_COS_UPLOAD_DIR || '[NOT SET]',
      },
      image_processing: {
        TENCENT_REGION_IMAGE: process.env.TENCENT_REGION_IMAGE || '[NOT SET]',
        TENCENT_COS_BUCKET_IMAGE: process.env.TENCENT_COS_BUCKET_IMAGE || '[NOT SET]',
        TENCENT_COS_REGION_IMAGE: process.env.TENCENT_COS_REGION_IMAGE || '[NOT SET]',
      },
      shared: {
        TENCENT_SECRET_ID: process.env.TENCENT_SECRET_ID ? '[SET]' : '[NOT SET]',
        TENCENT_SECRET_KEY: process.env.TENCENT_SECRET_KEY ? '[SET]' : '[NOT SET]',
      },
      all_tencent_vars: Object.keys(process.env).filter(key => key.startsWith('TENCENT_')).reduce((obj, key) => {
        obj[key] = process.env[key] || '[NOT SET]';
        return obj;
      }, {} as Record<string, string>),
      supabase: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '[SET]' : '[NOT SET]',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '[SET]' : '[NOT SET]',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '[SET]' : '[NOT SET]',
      },
    },
    node_env: process.env.NODE_ENV,
    cwd: process.cwd(),
    timestamp: new Date().toISOString()
  });
}
