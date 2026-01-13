'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';
interface ConversionRecord {
  id: string;
  task_id: string;
  status: string;
  progress: number | null;
  original_file_url: string | null;
  result_file_url: string | null;
  created_at: string;
}

// 固定测试 task_id
const TEST_TASK_ID = '2600022993-WorkflowTask-10c41dcecb0fc288f74bdf1ab8cd87c9tt7';

export default function TestTaskPage() {
  const [record, setRecord] = useState<ConversionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('conversion_records')
          .select('id, task_id, status, progress, original_file_url, result_file_url, created_at')
          .eq('task_id', TEST_TASK_ID)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('未找到记录');
        setRecord(data as ConversionRecord);
      } catch (err: any) {
        setError(err.message || '查询失败');
      }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">测试任务记录查询</h1>
      <p className="text-sm text-gray-500">
        task_id: <code className="break-all">{TEST_TASK_ID}</code>
      </p>

      {loading && <div>加载中...</div>}
      {error && <div className="text-red-600">错误：{error}</div>}

      {record && (
        <div className="space-y-2 border rounded-lg p-4 bg-white">
          <div>
            <span className="font-semibold">状态：</span>
            {record.status}（进度：{record.progress ?? 0}%）
          </div>
          <div>
            <span className="font-semibold">创建时间：</span>
            {new Date(record.created_at).toLocaleString()}
          </div>
          <div>
            <span className="font-semibold">原始文件：</span>
            {record.original_file_url ? (
              <a
                className="text-blue-600 hover:underline"
                href={record.original_file_url}
                target="_blank"
                rel="noreferrer"
              >
                打开
              </a>
            ) : (
              '无'
            )}
          </div>
          <div>
            <span className="font-semibold">处理后文件：</span>
            {record.result_file_url ? (
              <a
                className="text-blue-600 hover:underline"
                href={record.result_file_url}
                target="_blank"
                rel="noreferrer"
              >
                下载/预览
              </a>
            ) : (
              '暂无'
            )}
          </div>
        </div>
      )}
    </div>
  );
}

