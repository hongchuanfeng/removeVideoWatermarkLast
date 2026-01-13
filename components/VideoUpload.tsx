'use client';

import { useState, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface UploadProgress {
  recordId: string | null;
  progress: number;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  resultUrl: string | null;
}

export default function VideoUpload() {
  const t = useTranslations('home');
  const locale = useLocale();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removalType, setRemovalType] = useState<'watermark_logo' | 'subtitle'>('watermark_logo');
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isLoadingDuration, setIsLoadingDuration] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    recordId: null,
    progress: 0,
    status: 'idle',
    resultUrl: null,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInsufficientCredits, setIsInsufficientCredits] = useState(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const supabase = createClient();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file');
        return;
      }
      setSelectedFile(file);
      setVideoDuration(null);
      setIsLoadingDuration(true);
      setError(null);
      const objectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = objectUrl;
      video.onloadedmetadata = () => {
        const duration = video.duration;
        setVideoDuration(Number.isFinite(duration) ? duration : null);
        setIsLoadingDuration(false);
        URL.revokeObjectURL(objectUrl);
      };
      video.onerror = () => {
        setError('无法读取视频时长，请重试或更换文件');
        setIsLoadingDuration(false);
        setVideoDuration(null);
        URL.revokeObjectURL(objectUrl);
      };
      // 如果之前是失败状态，重置状态
      if (uploadProgress.status === 'failed') {
        setUploadProgress({
          recordId: null,
          progress: 0,
          status: 'idle',
          resultUrl: null,
        });
        setIsInsufficientCredits(false);
        setError(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }
    if (isLoadingDuration) {
      setError('正在读取视频时长，请稍后再试');
      return;
    }
    if (videoDuration !== null && videoDuration <= 0) {
      setError('视频时长无效，请更换文件');
      return;
    }
    if (videoDuration !== null && videoDuration > 120) {
      setError(t('upload.creditLimit', { default: 'Videos longer than 2 minutes are not allowed when using credits. Please trim and retry.' }));
      return;
    }

    // 检查登录状态
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // 未登录，直接触发 Google 登录
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/${locale}`,
        },
      });

      if (signInError) {
        setError('Failed to initiate login. Please try again.');
        console.error('Login error:', signInError);
      }
      return;
    }

    // 清除之前的进度轮询（如果存在）
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress({
      recordId: null,
      progress: 0,
      status: 'uploading',
      resultUrl: null,
    });

    try {
      // 检查登录状态
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('User not authenticated, triggering login...');
        // 未登录，直接触发 Google 登录
        const { error: signInError } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=/${locale}`,
          },
        });

        if (signInError) {
          console.error('Login error:', signInError);
          throw new Error('Authentication required. Please log in and try again.');
        }
        return; // 登录流程会重定向，不继续执行
      }

      console.log('User authenticated:', user.id);

      // 步骤1: 获取预签名URL
      console.log('Step 1: Requesting presigned URL...');
      console.log('Request payload:', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        contentType: selectedFile.type,
        videoDuration: videoDuration ? Math.ceil(videoDuration) : undefined,
      });

      const presignedResponse = await fetch('/api/video/presigned-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          contentType: selectedFile.type,
          videoDuration: videoDuration ? Math.ceil(videoDuration) : undefined,
        }),
        credentials: 'include',
      });

      console.log('Presigned URL response status:', presignedResponse.status);
      console.log('Presigned URL response headers:', Object.fromEntries(presignedResponse.headers.entries()));

      const presignedData = await presignedResponse.json();
      console.log('Presigned URL response data:', presignedData);

      if (!presignedResponse.ok) {
        const errorMessage = presignedData.error || 'Failed to get upload URL';
        const errorDetails = presignedData.details || '';

        console.error('Presigned URL error:', {
          status: presignedResponse.status,
          error: errorMessage,
          details: errorDetails,
          fullResponse: presignedData
        });

        const isCreditsError = errorMessage.includes('积分不足') ||
                              errorMessage.includes('积分') &&
                              (errorMessage.includes('不足') || errorMessage.includes('insufficient'));
        setIsInsufficientCredits(isCreditsError);

        // 如果是认证错误，提供更清晰的信息
        if (presignedResponse.status === 401) {
          throw new Error('Authentication required. Please refresh the page and log in again.');
        }

        throw new Error(`${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`);
      }

      const { presignedUrl, cosKey, bucket, region } = presignedData;
      console.log('Step 1: Got presigned URL', { cosKey, bucket, region });

      // 步骤2: 直接上传文件到COS
      console.log('Step 2: Uploading file to COS...');
      console.log('Upload details:', {
        presignedUrl: presignedUrl.substring(0, 100) + '...',
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        contentType: selectedFile.type,
      });

      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type || 'video/mp4',
        },
      });

      console.log('Upload response status:', uploadResponse.status);
      console.log('Upload response statusText:', uploadResponse.statusText);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('Upload error response:', errorText);
        throw new Error(`Failed to upload file to COS: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}`);
      }

      console.log('Step 2: File uploaded to COS successfully');

      // 构建COS URL
      const cosUrl = `https://${bucket}.cos.${region}.myqcloud.com/${cosKey}`;

      // 步骤3: 创建处理任务
      console.log('Step 3: Creating processing task...');
      const taskResponse = await fetch('/api/video/create-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cosUrl,
          cosKey,
          fileName: selectedFile.name,
          removalType,
          videoDuration: videoDuration ? Math.ceil(videoDuration) : undefined,
        }),
        credentials: 'include',
      });

      const taskData = await taskResponse.json();

      if (!taskResponse.ok) {
        const errorMessage = taskData.error || 'Failed to create task';
        const isCreditsError = errorMessage.includes('积分不足') || 
                              errorMessage.includes('积分') && 
                              (errorMessage.includes('不足') || errorMessage.includes('insufficient'));
        setIsInsufficientCredits(isCreditsError);
        throw new Error(errorMessage);
      }

      console.log('Step 3: Task created successfully', taskData);

      // 成功时重置积分不足状态
      setIsInsufficientCredits(false);

      setUploadProgress({
        recordId: taskData.recordId,
        progress: 10,
        status: 'processing',
        resultUrl: null,
      });

      // 开始轮询进度
      if (taskData.recordId) {
        startProgressPolling(taskData.recordId);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Upload failed';
      // 检查是否是积分不足的错误
      const isCreditsError = errorMessage.includes('积分不足') || 
                            errorMessage.includes('积分') && 
                            (errorMessage.includes('不足') || errorMessage.includes('insufficient'));
      setIsInsufficientCredits(isCreditsError);
      setError(errorMessage);
      setUploadProgress({
        recordId: null,
        progress: 0,
        status: 'failed',
        resultUrl: null,
      });
      setIsUploading(false);
      // 清除进度轮询
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  };

  const startProgressPolling = (recordId: string) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/video/progress?recordId=${recordId}`);
        const data = await response.json();

        if (response.ok) {
          setUploadProgress((prev) => ({
            ...prev,
            progress: data.progress || prev.progress,
            status: data.status === 'completed' ? 'completed' : 
                   data.status === 'failed' ? 'failed' : 'processing',
            resultUrl: data.resultUrl || prev.resultUrl,
          }));

          if (data.status === 'completed' || data.status === 'failed') {
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            setIsUploading(false);

            if (data.status === 'completed' && data.resultUrl) {
              // 自动下载
              const link = document.createElement('a');
              link.href = data.resultUrl;
              link.download = selectedFile?.name || 'processed-video.mp4';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } else if (data.status === 'failed') {
              // 设置错误信息
              setError(data.error || 'Processing failed. Please try again.');
            }
          }
        }
      } catch (err) {
        console.error('Progress polling error:', err);
      }
    }, 2000); // 每2秒查询一次
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl shadow-xl max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-8">
        {t('upload.title', { default: 'Upload Your Video' })}
      </h2>

      {/* 提示信息 */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300 text-center">
          <p>
            <svg
              className="w-4 h-4 inline-block mr-2 align-middle"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {t('upload.tip', { default: 'After uploading, you can view your conversion records in the Profile Center even if you leave this page' })}
          </p>
          <p>{t('upload.freeLimit', { default: 'Free usage is limited to videos up to 1 minute. Subscribe or recharge to process longer videos.' })}</p>
          <p>{t('upload.creditLimit', { default: 'When using credits, videos must not exceed 2 minutes.' })}</p>
        </div>
      </div>

      {/* 移除类型选择 */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          {t('upload.removalType', { default: 'Removal Type' })}
        </label>
        <div className="flex gap-4">
          {(
            ['watermark_logo', 'subtitle'] as const
          ).map((type) => (
            <button
              key={type}
              onClick={() => setRemovalType(type)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                removalType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t(`upload.${type}`, { default: type })}
            </button>
          ))}
        </div>
      </div>

      {/* 文件上传区域 */}
      <div
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading || uploadProgress.status === 'processing'}
        />
        <svg
          className="w-16 h-16 text-gray-400 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        {selectedFile ? (
          <div>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-2">
              {selectedFile.name}
            </p>
            <p className="text-sm text-gray-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            {videoDuration !== null && (
              <p className="text-sm text-gray-500">
                时长：{Math.ceil(videoDuration)} 秒
              </p>
            )}
            {isLoadingDuration && (
              <p className="text-sm text-gray-500">正在读取视频时长...</p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
              {t('upload.dragDrop', { default: 'Drag and drop your video here, or click to browse' })}
            </p>
            <button
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              disabled={isUploading}
            >
              {t('upload.selectFile', { default: 'Select Video File' })}
            </button>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {/* 上传按钮 */}
      {selectedFile && !isUploading && (uploadProgress.status === 'idle' || uploadProgress.status === 'failed') && (
        <div className="mt-6 text-center">
          {isInsufficientCredits ? (
            <button
              onClick={() => router.push(`/${locale}/subscription`)}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
            >
              {t('upload.recharge', { default: 'Recharge' })}
            </button>
          ) : (
            <button
              onClick={handleUpload}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
            >
              {uploadProgress.status === 'failed' 
                ? t('upload.retry', { default: 'Retry' })
                : t('upload.start', { default: 'Start Processing' })}
            </button>
          )}
        </div>
      )}

      {/* 进度条 */}
      {(uploadProgress.status === 'uploading' || uploadProgress.status === 'processing') && (
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {uploadProgress.status === 'uploading'
                ? t('upload.uploading', { default: 'Uploading...' })
                : t('upload.processing', { default: 'Processing...' })}
            </span>
            <span className="text-gray-600 dark:text-gray-400">{uploadProgress.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </div>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            {t('upload.waiting', {
              default: 'Processing takes some time, please wait patiently. The file will be automatically downloaded when processing is complete.',
            })}
          </p>
        </div>
      )}

      {/* 完成状态 */}
      {uploadProgress.status === 'completed' && (
        <div className="mt-6 text-center">
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg">
            {t('upload.completed', { default: 'Processing completed successfully!' })}
          </div>
          {uploadProgress.resultUrl && (
            <div className="mb-4 space-y-3 w-full">
              <video
                className="mx-auto rounded-lg shadow max-h-96 w-full"
                src={uploadProgress.resultUrl}
                controls
              />
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <a
                  href={uploadProgress.resultUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {t('upload.download', { default: 'Download Video' })}
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 失败状态 */}
      {uploadProgress.status === 'failed' && (
        <div className="mt-6 text-center">
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">
            {error || t('upload.failed', { default: 'Processing failed. Please try again.' })}
          </div>
          {/* 重试按钮已经在上面显示，这里不再重复 */}
        </div>
      )}
    </div>
  );
}

