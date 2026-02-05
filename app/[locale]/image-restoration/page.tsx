'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCredits } from '@/lib/user-credits-client';

export default function ImageRestorationPage() {
  const t = useTranslations('imageRestoration');
  const { user, loading: authLoading } = useAuth();
  const { credits, refreshCredits } = useCredits();
  const router = useRouter();

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedImage, setProcessedImage] = useState<string | null>(null);

  const [regions, setRegions] = useState<Array<{ x: number; y: number; w: number; h: number }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [previewRegion, setPreviewRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [loginPrompt, setLoginPrompt] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draw image to canvas
  useEffect(() => {
    if (!selectedImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = selectedImage;
  }, [selectedImage]);

  // Ensure drag ends even if mouseup outside canvas
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
          setRegions((prev) => [...prev, pr]);
        }
      }
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

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      setLoginPrompt(t('pleaseLoginToUse'));
      router.push('/?next=' + encodeURIComponent(window.location.pathname));
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedImage(result);
      setRegions([]);
      setProcessedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const x = Math.round((event.clientX - rect.left) * scaleX);
    const y = Math.round((event.clientY - rect.top) * scaleY);

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

    const clampedX = Math.max(0, Math.min(x, canvasRef.current.width));
    const clampedY = Math.max(0, Math.min(y, canvasRef.current.height));

    const sx = Math.min(dragStart.x, clampedX);
    const sy = Math.min(dragStart.y, clampedY);
    const w = Math.abs(clampedX - dragStart.x);
    const h = Math.abs(clampedY - dragStart.y);
    setPreviewRegion({ x: sx, y: sy, w, h });
  };

  const handleCanvasMouseUp = () => {
    if (!isDragging || !previewRegion) {
      setIsDragging(false);
      setPreviewRegion(null);
      return;
    }
    if (previewRegion.w > 4 && previewRegion.h > 4) {
      setRegions((prev) => [...prev, previewRegion]);
    }
    setIsDragging(false);
    setDragStart(null);
    setPreviewRegion(null);
  };

  const clearRegions = () => setRegions([]);
  const removeLastRegion = () => setRegions((prev) => prev.slice(0, -1));

  const processImage = async () => {
    if (!imageFile || regions.length === 0) return;

    if (!user) {
      setLoginPrompt(t('pleaseLoginToUse'));
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.push(`/?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    if ((credits ?? 0) < 1) {
      alert(t('insufficientCredits'));
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', imageFile);

      const uploadResponse = await fetch('/api/image/upload', {
        method: 'POST',
        body: formData,
      });
      if (!uploadResponse.ok) throw new Error('Upload failed');
      const uploadResult = await uploadResponse.json();
      const { url: imageUrl } = uploadResult;

      const processResponse = await fetch('/api/image/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, regions }),
      });
      if (!processResponse.ok) throw new Error('Processing failed');

      const responseData = await processResponse.json();
      const { processedImageUrl } = responseData;

      await refreshCredits();
      setProcessedImage(processedImageUrl);
      setRegions([]);
    } catch (e) {
      console.error(e);
      alert(t('processingError'));
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = () => {
    if (!processedImage) return;
    const link = document.createElement('a');
    link.href = processedImage;
    link.download = 'restored-image.jpg';
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{t('title')}</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">{t('description')}</p>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t('imageCreditsInfo', { credits })}</div>
          </div>

          {loginPrompt && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-8">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-yellow-800 dark:text-yellow-200 font-medium">{loginPrompt}</p>
                <button onClick={() => setLoginPrompt('')} className="ml-auto text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{t('uploadTitle')}</h2>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

              {!selectedImage ? (
                <div>
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{t('uploadPrompt')}</p>
                  <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
                    {t('selectImage')}
                  </button>
                </div>
              ) : (
                <div className="relative inline-block">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full h-auto border rounded-lg cursor-crosshair"
                    style={{ maxWidth: '100%', height: 'auto', imageRendering: 'pixelated' }}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                  />

                  {selectedImage && regions.length === 0 && (
                    <div className="mt-4 p-4 bg-black bg-opacity-60 text-white rounded-lg text-center">
                      <div className="text-lg font-semibold">{t('promptTitle')}</div>
                      <div className="text-sm opacity-90 mt-1">{t('promptDesc')}</div>
                      <div className="text-xs opacity-75 mt-2">{t('promptHint')}</div>
                    </div>
                  )}

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

                  {previewRegion && canvasRef.current && (() => {
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
                  })()}

                  <div className="mt-4 flex justify-center space-x-4">
                    <button onClick={() => fileInputRef.current?.click()} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
                      {t('changeImage')}
                    </button>
                    <button onClick={clearRegions} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors">
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

          {selectedImage && regions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-4">{t('markedPoints', { count: regions.length })}</p>
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

          {processedImage && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">{t('resultTitle')}</h2>
              <div className="text-center">
                <img src={processedImage} alt="Restored image" className="max-w-full h-auto border rounded-lg mb-4" />
                <button onClick={downloadImage} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
                  {t('downloadImage')}
                </button>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('features.title')}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {(['intelligent', 'precision', 'batch', 'quality'] as const).map((k) => (
                <div key={k} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">{t(`features.${k}`)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('instructions.title')}</h2>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {n}
                  </div>
                  <p className="text-gray-700 dark:text-gray-300">{t(`instructions.step${n}`)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{t('examples.title')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{t('examples.subtitle')}</p>
            <div className="space-y-6">
              {['/repair/1.jpg', '/repair/2.jpg', '/repair/3.jpg', '/repair/4.jpg'].map((src, index) => (
                <div key={src} className="text-center">
                  <img
                    src={src}
                    alt={`Repair example ${index + 1}`}
                    className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('faq.title')}</h2>
            <div className="space-y-6">
              {[
                { q: t('faq.q1'), a: t('faq.a1') },
                { q: t('faq.q2'), a: t('faq.a2') },
                { q: t('faq.q3'), a: t('faq.a3') },
                { q: t('faq.q4'), a: t('faq.a4') },
              ].map((item, idx) => (
                <div key={idx} className={idx === 3 ? '' : 'border-b border-gray-200 dark:border-gray-700 pb-6'}>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{item.q}</h3>
                  <p className="text-gray-700 dark:text-gray-300">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



