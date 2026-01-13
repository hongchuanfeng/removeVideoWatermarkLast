import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    const taskIdParam = searchParams.get('taskId');

    // 允许两种方式：recordId 或 taskId
    if (!recordId && !taskIdParam) {
      return NextResponse.json({ error: 'recordId or taskId required' }, { status: 400 });
    }

    // 当传 taskId 时，不先查库，直接用 taskId 调腾讯云，再回写数据库
    let record: any = null;
    if (recordId) {
      const { data: recordData, error } = await supabase
        .from('conversion_records')
        .select('*')
        .eq('id', recordId)
        .eq('user_id', user.id)
        .single();

      if (error || !recordData) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }
      record = recordData;
    }

    const taskId = taskIdParam || record?.task_id;

    // 如果有任务ID，查询腾讯云任务状态
    if (taskId) {
      try {
        const mpsModule = require('tencentcloud-sdk-nodejs/tencentcloud/services/mps/v20190612/mps_client');
        
        // 腾讯云 SDK 导出的是 Client
        const MpsClient = mpsModule.Client;

        if (!MpsClient) {
          throw new Error('MpsClient not found in SDK module');
        }

        const client = new MpsClient({
          credential: {
            secretId: process.env.TENCENT_SECRET_ID!,
            secretKey: process.env.TENCENT_SECRET_KEY!,
          },
          region: process.env.TENCENT_COS_REGION || 'ap-guangzhou',
        });

        // 使用对象字面量构建请求
        const req: any = {
          TaskId: taskId,
        };

        // SDK 返回通常形如 { Response: { ... } }
        const taskResp = await client.DescribeTaskDetail(req);
        console.log('Progress: raw taskResp', JSON.stringify(taskResp, null, 2));
        const taskDetail = taskResp?.Response || taskResp;

        // 兼容不同返回结构：有的字段在顶层，有的在 Task / WorkflowTask 下
        const taskInfo = taskDetail.Task || taskDetail.WorkflowTask || taskDetail;
        const progressVal =
          typeof taskInfo.Progress === 'number'
            ? taskInfo.Progress
            : typeof taskDetail.Progress === 'number'
            ? taskDetail.Progress
            : undefined;
        let progress = progressVal ?? record?.progress ?? 0;
        let status = taskInfo.Status || taskDetail.Status || record?.status || 'processing';
        let resultUrl = record?.result_file_url;

        const resultSets = [
          taskInfo.MediaProcessResultSet,
          taskDetail.MediaProcessResultSet,
          taskDetail.WorkflowTask?.MediaProcessResultSet,
        ].filter(Boolean) as any[];
        const mediaResults = resultSets.length > 0 ? resultSets.flat() : [];

        const firstResult = mediaResults[0];
        const firstResultStatus =
          firstResult?.Status || firstResult?.StatusString || undefined;

        // SmartErase 单独的结果字段（有些返回不在 MediaProcessResultSet）
        const smartEraseResult =
          taskInfo.SmartEraseTask ||
          taskDetail.SmartEraseTask ||
          taskDetail.SmartEraseTaskResult ||
          taskDetail.WorkflowTask?.SmartEraseTask ||
          taskDetail.WorkflowTask?.SmartEraseTaskResult ||
          undefined;

        // 主状态或子任务状态任一成功/FINISH 都视为完成
        const isSuccess =
          status === 'SUCCESS' ||
          status === 'FINISH' ||
          firstResultStatus === 'SUCCESS' ||
          firstResultStatus === 'FINISH';

        if (isSuccess) {
          status = 'completed';
          progress = 100;
          // 获取输出文件URL
          const bucket = process.env.TENCENT_COS_BUCKET!;
          const region = process.env.TENCENT_COS_REGION || 'ap-guangzhou';

          const buildUrl = (path: string) =>
            path.startsWith('http')
              ? path
              : `https://${bucket}.cos.${region}.myqcloud.com/${path.replace(/^\/+/, '')}`;

          const pickOutputPath = () => {
            // 优先遍历所有结果，寻找 SmartEraseTask 输出
            for (const item of mediaResults) {
              const se = item?.SmartEraseTask;
              if (se?.Output?.Url) return se.Output.Url;
              if (se?.Output?.Path) return se.Output.Path;
              if (se?.Output?.OutputPath) return se.Output.OutputPath;
              if (se?.OutputUrl) return se.OutputUrl;
              if (item?.Output?.Url) return item.Output.Url;
              if (item?.Output?.Path) return item.Output.Path;
              if (item?.Output?.OutputPath) return item.Output.OutputPath;
            }
            // 兼容 SmartEraseTaskResult
            if (smartEraseResult?.Output?.Url) return smartEraseResult.Output.Url;
            if (smartEraseResult?.Output?.Path) return smartEraseResult.Output.Path;
            if (smartEraseResult?.Output?.OutputPath) return smartEraseResult.Output.OutputPath;
            if (smartEraseResult?.OutputUrl) return smartEraseResult.OutputUrl;
            return undefined;
          };

          const outputPath = pickOutputPath();
          console.log('Progress: taskId', taskId, 'status', status, 'outputPath', outputPath);
          console.log('Progress: mediaResults length', mediaResults.length);
          console.log('Progress: firstResult keys', firstResult ? Object.keys(firstResult) : null);
          console.log(
            'Progress: firstResult.Output',
            firstResult?.Output ? JSON.stringify(firstResult.Output) : null
          );
          console.log(
            'Progress: SmartEraseTask raw',
            smartEraseResult ? JSON.stringify(smartEraseResult) : null
          );
          if (outputPath) {
            resultUrl = buildUrl(outputPath);
          }
        } else if (status === 'PROCESSING') {
          status = 'processing';
          // 若无进度，缓慢提升但不超过 90
          if (progressVal === undefined) {
            progress = Math.min(record.progress + 10, 90);
          }
        } else if (status === 'FAILED') {
          status = 'failed';
        }

        // 回写数据库（通过 task_id，绑定当前用户）
        const updated = await supabase
          .from('conversion_records')
          .update({
            status,
            progress,
            result_file_url: resultUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('task_id', taskId)
          .eq('user_id', user.id)
          .select('id, credits_used, video_duration')
          .maybeSingle();

        const updatedRecord = updated.data || record;

        // 如果处理完成，扣除积分
        if (status === 'completed' && updatedRecord && updatedRecord.credits_used === 0) {
          const videoDuration = updatedRecord.video_duration || 60; // 默认60秒
          const creditsToDeduct = Math.ceil(videoDuration / 60); // 1分钟=1积分，向上取整

          // 扣除积分
          const { data: currentCredits } = await supabase
            .from('user_credits')
            .select('credits')
            .eq('user_id', user.id)
            .single();

          if (currentCredits && currentCredits.credits >= creditsToDeduct) {
            await supabase
              .from('user_credits')
              .update({
                credits: currentCredits.credits - creditsToDeduct,
              })
              .eq('user_id', user.id);

            // 更新记录的积分使用
            await supabase
              .from('conversion_records')
              .update({
                credits_used: creditsToDeduct,
              })
              .eq('task_id', taskId)
              .eq('user_id', user.id);
          }
        }

        return NextResponse.json({
          status,
          progress,
          resultUrl,
        });
      } catch (apiError: any) {
        console.error('Error querying task:', apiError);
        // 如果API查询失败，返回数据库中的状态
      }
    }

    return NextResponse.json({
      status: record?.status || 'processing',
      progress: record?.progress || 0,
      resultUrl: record?.result_file_url || null,
    });
  } catch (error: any) {
    console.error('Progress query error:', error);
    return NextResponse.json(
      { error: error.message || 'Query failed' },
      { status: 500 }
    );
  }
}

