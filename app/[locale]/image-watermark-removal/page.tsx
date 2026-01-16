'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCredits } from '@/lib/user-credits-client';

export default function ImageWatermarkRemovalPage() {
  const t = useTranslations('imageWatermarkRemoval');
  const { user, loading: authLoading } = useAuth();
  const { credits, refreshCredits } = useCredits();
  const router = useRouter();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  // 矩形选择相关状态：regions 存储已保存的矩形（x,y,w,h），previewRegion 用于拖拽时预览
  const [regions, setRegions] = useState<Array<{x: number, y: number, w: number, h: number}>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [previewRegion, setPreviewRegion] = useState<{x: number, y: number, w: number, h: number} | null>(null);
  const [loginPrompt, setLoginPrompt] = useState<string>('');
 

  // 调试regions变化
  useEffect(() => {
    console.log('regions 更新:', regions);
    console.log('regions.length:', regions.length);
  }, [regions]);

  // 绘制图片到canvas
  useEffect(() => {
    if (selectedImage && canvasRef.current) {
      console.log('=== 开始绘制图片到canvas ===');
      console.log('selectedImage 长度:', selectedImage.length);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('无法获取canvas上下文');
        return;
      }

      const img = new Image();
      img.onload = () => {
        console.log('图片加载完成，开始绘制');
        console.log('图片尺寸:', { width: img.width, height: img.height });

        // 设置canvas尺寸
        canvas.width = img.width;
        canvas.height = img.height;

        // 绘制图片
        ctx.drawImage(img, 0, 0);

        console.log('图片绘制完成');
        console.log('canvas尺寸:', { width: canvas.width, height: canvas.height });
      };

      img.onerror = (error) => {
        console.error('图片加载失败:', error);
      };

      console.log('设置图片src');
      img.src = selectedImage;
    }
  }, [selectedImage]);

  // 调试selectedImage变化
  useEffect(() => {
    console.log('selectedImage 更新:', selectedImage ? `有值 (长度: ${selectedImage.length})` : 'null');
  }, [selectedImage]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug ref setup
  useEffect(() => {
    console.log('=== 组件初始化 ===');
    console.log('canvasRef:', canvasRef);
    console.log('fileInputRef:', fileInputRef);
  }, []);

  // Allow anonymous users to view the page; do not redirect here.
  // When user attempts to process an image, we'll require login and prompt then.

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('=== handleImageUpload 被调用 ===');
    console.log('事件对象:', event);
    console.log('目标元素:', event.target);
    console.log('文件列表:', event.target.files);

    // Require login when attempting to upload an image
    if (!user) {
      setLoginPrompt(t('pleaseLoginToUse') || '请先登录后再使用');
      router.push('/?next=' + encodeURIComponent(window.location.pathname));
      return;
    }

    const file = event.target.files?.[0];
    console.log('选择的文件:', file);

    if (file) {
      console.log('文件信息:');
      console.log('- 文件名:', file.name);
      console.log('- 文件类型:', file.type);
      console.log('- 文件大小:', file.size, 'bytes');

      setImageFile(file);
      const reader = new FileReader();

      reader.onload = (e) => {
        console.log('文件读取完成，设置selectedImage');
        const result = e.target?.result as string;
        console.log('图片数据URL长度:', result?.length || 0);
        setSelectedImage(result);
        setRegions([]);
        setProcessedImage(null);
      };

      reader.onerror = (error) => {
        console.error('文件读取错误:', error);
      };

      console.log('开始读取文件...');
      reader.readAsDataURL(file);
    } else {
      console.log('没有选择文件');
    }
  };

  // Canvas 鼠标事件 —— 支持拖拽绘制矩形区域
  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);

    // 确保坐标在canvas范围内
    const clampedX = Math.max(0, Math.min(x, canvasRef.current.width));
    const clampedY = Math.max(0, Math.min(y, canvasRef.current.height));

    setIsDragging(true);
    setDragStart({ x: clampedX, y: clampedY });
    setPreviewRegion({ x: clampedX, y: clampedY, w: 0, h: 0 });
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current || !dragStart) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);

    // 确保坐标在canvas范围内
    const clampedX = Math.max(0, Math.min(x, canvasRef.current.width));
    const clampedY = Math.max(0, Math.min(y, canvasRef.current.height));

    const sx = Math.min(dragStart.x, clampedX);
    const sy = Math.min(dragStart.y, clampedY);
    const w = Math.abs(clampedX - dragStart.x);
    const h = Math.abs(clampedY - dragStart.y);
    setPreviewRegion({ x: sx, y: sy, w, h });
  };

  const handleCanvasMouseUp = (_event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !previewRegion) {
      setIsDragging(false);
      setPreviewRegion(null);
      return;
    }
    // 如果宽高有效则保存
    if (previewRegion.w > 4 && previewRegion.h > 4) {
      setRegions(prev => [...prev, previewRegion]);
    }
    setIsDragging(false);
    setDragStart(null);
    setPreviewRegion(null);
  };

  // 防止 mouseup 在 canvas 外发生导致状态未清理 — 监听 window mouseup/touchend，确保一旦松开就结束拖拽并保存预览区
  const previewRegionRef = useRef(previewRegion);
  const isDraggingRef = useRef(isDragging);
  useEffect(() => {
    previewRegionRef.current = previewRegion;
  }, [previewRegion]);
  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    const onWindowUp = () => {
      if (isDraggingRef.current) {
        const pr = previewRegionRef.current;
        if (pr && pr.w > 4 && pr.h > 4) {
          setRegions(prev => [...prev, pr]);
        }
      }
      // 清理拖拽状态（无论是否在 canvas 内）
      setIsDragging(false);
      setDragStart(null);
      setPreviewRegion(null);
    };

    window.addEventListener('mouseup', onWindowUp);
    window.addEventListener('touchend', onWindowUp);
    return () => {
      window.removeEventListener('mouseup', onWindowUp);
      window.removeEventListener('touchend', onWindowUp);
    };
  }, []);
 

  // Remove last region / clear regions
  const removeLastRegion = () => {
    setRegions(prev => prev.slice(0, -1));
  };

  const clearRegions = () => {
    setRegions([]);
  };

  // Process image with Tencent Cloud API
  const processImage = async () => {
    console.log('=== processImage 函数被调用 ===');
    console.log('imageFile:', imageFile);
    console.log('regions:', regions);
    console.log('credits:', credits);

    if (!imageFile || regions.length === 0) {
      console.log('缺少必要参数，返回');
      return;
    }

    // Require login when attempting to process an image
    if (!user) {
      setLoginPrompt(t('pleaseLoginToUse') || '请先登录后再使用');
      // Redirect to home page and preserve current path so user can return after login
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.push(`/?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    // Check credits
    if ((credits ?? 0) < 1) {
      console.log('积分不足:', credits);
      alert(t('insufficientCredits'));
      return;
    }

    console.log('开始处理图片...');
    setIsProcessing(true);

    try {
      // First, upload image to get URL
      console.log('准备上传图片...');
      const formData = new FormData();
      formData.append('file', imageFile);
      console.log('FormData创建完成，包含文件:', imageFile.name);

      console.log('发起上传请求到 /api/image/upload...');
      const uploadResponse = await fetch('/api/image/upload', {
        method: 'POST',
        body: formData,
      });

      console.log('上传响应状态:', uploadResponse.status);
      console.log('上传响应ok:', uploadResponse.ok);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('上传失败，响应内容:', errorText);
        throw new Error('Upload failed');
      }

      const uploadResult = await uploadResponse.json();
      console.log('上传结果:', uploadResult);
      const { url: imageUrl } = uploadResult;

      // Process with Tencent Cloud
      const processResponse = await fetch('/api/image/remove-watermark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          regions,
        }),
      });

      if (!processResponse.ok) {
        throw new Error('Processing failed');
      }

      const responseData = await processResponse.json();
      const { processedImageUrl, note } = responseData;

      // Show note if present (for demo purposes)
      if (note) {
        console.log('Processing note:', note);
      }

      // Refresh credits
      await refreshCredits();

      setProcessedImage(processedImageUrl);
      setRegions([]);
    } catch (error) {
      console.error('Processing error:', error);
      alert(t('processingError'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Download processed image
  const downloadImage = () => {
    if (!processedImage) return;

    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'processed-image.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Note: do not block rendering for anonymous users here. The actual processing
  // action will check authentication and prompt login if needed.

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {t('title')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {t('description')}
            </p>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {t('imageCreditsInfo', { credits })}
            </div>
          </div>

          {/* Login Prompt */}
          {loginPrompt && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                  {loginPrompt}
                </p>
                <button
                  onClick={() => setLoginPrompt('')}
                  className="ml-auto text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Upload Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {t('uploadTitle')}
            </h2>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {!selectedImage ? (
                <div>
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{t('uploadPrompt')}</p>
                  <button
                    onClick={() => {
                      console.log('=== 选择图片按钮被点击 ===');
                      console.log('fileInputRef.current:', fileInputRef.current);
                      if (fileInputRef.current) {
                        console.log('触发文件输入框点击');
                        fileInputRef.current.click();
                      } else {
                        console.log('fileInputRef.current 为 null');
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    {t('selectImage')}
                  </button>
                </div>
              ) : (
                <div className="relative inline-block">
                  {/* 提示信息（已移除覆盖层，改为在画布下方显示文本提示） */}

                  <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto border rounded-lg cursor-crosshair"
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      imageRendering: 'pixelated'
                    }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                  />

                  {/* Inline prompt below canvas (不在图片上显示) */}
                  {selectedImage && regions.length === 0 && (
                    <div className="mt-4 p-4 bg-black bg-opacity-60 text-white rounded-lg text-center">
                      <div className="text-lg font-semibold">{t('promptTitle') || '请点击图片标记水印位置'}</div>
                      <div className="text-sm opacity-90 mt-1">{t('promptDesc') || '点击图片上的水印区域，系统会自动标记位置'}</div>
                      <div className="text-xs opacity-75 mt-2">{t('promptHint') || '提示：点击任意位置即可开始测试'}</div>
                    </div>
                  )}

                  {/* Regions overlay (saved rectangles) */}
                  {regions.map((r, index) => {
                    if (!canvasRef.current) return null;
                    const rect = canvasRef.current.getBoundingClientRect();
                    const scaleX = rect.width / canvasRef.current.width;
                    const scaleY = rect.height / canvasRef.current.height;

                    return (
                      <div
                        key={index}
                        className="absolute border-2 border-red-400 bg-red-400 bg-opacity-20 rounded-sm pointer-events-none"
                        style={{
                          left: `${r.x * scaleX}px`,
                          top: `${r.y * scaleY}px`,
                          width: `${r.w * scaleX}px`,
                          height: `${r.h * scaleY}px`,
                        }}
                      />
                    );
                  })}

                  {/* Preview region while dragging */}
                  {previewRegion && canvasRef.current && (
                    (() => {
                      const rect = canvasRef.current.getBoundingClientRect();
                      const scaleX = rect.width / canvasRef.current.width;
                      const scaleY = rect.height / canvasRef.current.height;

                      return (
                        <div
                          className="absolute border-2 border-yellow-300 bg-yellow-300 bg-opacity-20 rounded-sm pointer-events-none"
                          style={{
                            left: `${previewRegion.x * scaleX}px`,
                            top: `${previewRegion.y * scaleY}px`,
                            width: `${previewRegion.w * scaleX}px`,
                            height: `${previewRegion.h * scaleY}px`,
                          }}
                        />
                      );
                    })()
                  )}

                  <div className="mt-4 flex justify-center space-x-4">
                    <button
                      onClick={() => {
                        console.log('=== 更换图片按钮被点击 ===');
                        console.log('fileInputRef.current:', fileInputRef.current);
                        if (fileInputRef.current) {
                          console.log('触发文件输入框点击');
                          fileInputRef.current.click();
                        } else {
                          console.log('fileInputRef.current 为 null');
                        }
                      }}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      {t('changeImage')}
                    </button>
                    <button
                      onClick={clearRegions}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      {t('clearPoints')}
                    </button>
                    <button
                      onClick={removeLastRegion}
                      disabled={regions.length === 0}
                      className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                      {t('removeLastPoint')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Processing Section */}
          {selectedImage && regions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {t('markedPoints', { count: regions.length })}
                </p>
                <button
                  onClick={processImage}
                  disabled={isProcessing || ((credits ?? 0) < 1)}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg transition-colors text-lg font-semibold"
                >
                  {isProcessing ? t('processing') : t('processImage')}
                </button>
              </div>
            </div>
          )}

          {/* Result Section */}
          {processedImage && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                {t('resultTitle')}
              </h2>

              <div className="text-center">
                <img
                  src={processedImage}
                  alt="Processed image"
                  className="max-w-full h-auto border rounded-lg mb-4"
                />


                <button
                  onClick={downloadImage}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  {t('downloadImage')}
                </button>
              </div>
            </div>
          )}

          {/* Features Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
              {t('features.title')}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('features.intelligent')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('features.precision')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('features.batch')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('features.quality')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
              {t('instructions.title')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('instructions.step1')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('instructions.step2')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('instructions.step3')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('instructions.step4')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  5
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('instructions.step5')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Examples Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              {t('examples.title')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('examples.subtitle')}
            </p>

            {/* Vertical examples - each pair as one row */}
            <div className="space-y-6">
              {[
                { title: t('examples.logoExample'), before: 'b1.png', after: 'a1.png' },
                { title: t('examples.watermarkExample'), before: 'b2.png', after: 'a2.png' },
                { title: `${t('examples.combinedExample')} 1`, before: 'b3.png', after: 'a3.png' },
                { title: `${t('examples.combinedExample')} 2`, before: 'b4.png', after: 'a4.png' },
                { title: `${t('examples.combinedExample')} 3`, before: 'b5.png', after: 'a5.png' },
                { title: `${t('examples.combinedExample')} 4`, before: 'b6.png', after: 'a6.png' },
                { title: `${t('examples.combinedExample')} 5`, before: 'b7.png', after: 'a7.png' },
                { title: `${t('examples.combinedExample')} 6`, before: 'b8.png', after: 'a8.png' }
              ].map((example, index) => (
                <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white text-center">
                    {example.title}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.before')}</p>
                      <img
                        src={`/image_demo/${example.before}`}
                        alt={`${example.title} before`}
                        className="max-w-full h-auto border rounded-lg mx-auto"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.after')}</p>
                      <img
                        src={`/image_demo/${example.after}`}
                        alt={`${example.title} after`}
                        className="max-w-full h-auto border rounded-lg mx-auto"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
              {t('faq.title')}
            </h2>
            <div className="space-y-6">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {t('faq.q1')}
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {t('faq.a1')}
                </p>
              </div>

              <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {t('faq.q2')}
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {t('faq.a2')}
                </p>
              </div>

              <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {t('faq.q3')}
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {t('faq.a3')}
                </p>
              </div>

              <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {t('faq.q4')}
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {t('faq.a4')}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {t('faq.q5')}
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  {t('faq.a5')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
