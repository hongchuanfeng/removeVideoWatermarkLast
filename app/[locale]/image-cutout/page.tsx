'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCredits } from '@/lib/user-credits-client';

export default function ImageCutoutPage() {
  const t = useTranslations('imageCutout');
  const { user, loading: authLoading } = useAuth();
  const { credits, refreshCredits } = useCredits();
  const router = useRouter();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      setLoginPrompt(t('pleaseLoginToUse'));
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.push(`/?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewImage(result);
      setProcessedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const processImage = async () => {
    if (!imageFile) return;

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

      // 1) 上传图片到 COS，加速域名返回 URL
      const uploadResponse = await fetch('/api/image/upload', {
        method: 'POST',
        body: formData,
      });
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }
      const uploadResult = await uploadResponse.json();
      const { url: imageUrl } = uploadResult;

      // 2) 调用智能抠图后端接口
      const cutoutResponse = await fetch('/api/image/cutout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      if (!cutoutResponse.ok) {
        throw new Error('Cutout processing failed');
      }

      const responseData = await cutoutResponse.json();
      const { processedImageUrl } = responseData;

      await refreshCredits();
      setProcessedImage(processedImageUrl);
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
    link.download = 'cutout-image.png';
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
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {t('imageCreditsInfo', { credits: credits ?? 0 })}
            </div>
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
                <button
                  onClick={() => setLoginPrompt('')}
                  className="ml-auto text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
                >
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {!previewImage ? (
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
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    {t('selectImage')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <img
                    src={previewImage}
                    alt="Original"
                    className="mx-auto max-w-[40rem] w-full h-auto border rounded-lg"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {t('changeImage')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {previewImage && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
              <div className="text-center">
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
                <img
                  src={processedImage}
                  alt="Cutout result"
                  className="max-w-full h-auto border rounded-lg mx-auto mb-4"
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
            <div className="space-y-8">
              {/* 第1组：b1 和 a1 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                  {t('examples.example1')}
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.before')}</p>
                    <img
                      src="/cutout/b1.jpg"
                      alt="Cutout example 1 before"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.after')}</p>
                    <img
                      src="/cutout/a1.png"
                      alt="Cutout example 1 after"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* 第2组：b2 和 a2 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                  {t('examples.example2')}
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.before')}</p>
                    <img
                      src="/cutout/b2.jpg"
                      alt="Cutout example 2 before"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.after')}</p>
                    <img
                      src="/cutout/a2.png"
                      alt="Cutout example 2 after"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* 第3组：b3 和 a3 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                  {t('examples.example3')}
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.before')}</p>
                    <img
                      src="/cutout/b3.jpg"
                      alt="Cutout example 3 before"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.after')}</p>
                    <img
                      src="/cutout/a3.png"
                      alt="Cutout example 3 after"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* 第4组：b4 和 a4 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                  {t('examples.example4')}
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.before')}</p>
                    <img
                      src="/cutout/b4.jpg"
                      alt="Cutout example 4 before"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.after')}</p>
                    <img
                      src="/cutout/a4.png"
                      alt="Cutout example 4 after"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* 第5组：b5 和 a5 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                  {t('examples.example5')}
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.before')}</p>
                    <img
                      src="/cutout/b5.jpg"
                      alt="Cutout example 5 before"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.after')}</p>
                    <img
                      src="/cutout/a5.png"
                      alt="Cutout example 5 after"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* 第6组：b6 和 a6 */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                  {t('examples.example6')}
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.before')}</p>
                    <img
                      src="/cutout/b6.jpg"
                      alt="Cutout example 6 before"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.after')}</p>
                    <img
                      src="/cutout/a6.png"
                      alt="Cutout example 6 after"
                      className="mx-auto border rounded-lg w-full max-w-[40rem] h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">{t('faq.title')}</h2>
            <div className="space-y-6">
              {[1, 2, 3, 4].map((n, idx) => (
                <div
                  key={n}
                  className={idx === 3 ? '' : 'border-b border-gray-200 dark:border-gray-700 pb-6'}
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {t(`faq.q${n}`)}
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">{t(`faq.a${n}`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


