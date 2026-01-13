import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TEST_TASK_ID = '2600022993-WorkflowTask-10c41dcecb0fc288f74bdf1ab8cd87c9tt7';

export async function GET(request: NextRequest) {
  const taskIdRaw = request.nextUrl.searchParams.get('taskId') || TEST_TASK_ID;
  const taskId = taskIdRaw.trim();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Server configuration missing Supabase URL or service role key' },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from('conversion_records')
    .select('id, task_id, status, progress, original_file_url, result_file_url, created_at')
    .eq('task_id', taskId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      {
        error: 'Record not found',
        taskId,
        hint: '请确认 task_id 完整匹配、环境变量已加载，或在 Supabase 控制台验证查询是否有结果',
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ record: data });
}

