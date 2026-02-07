'use client';

import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCredits } from '@/lib/user-credits-client';

export default function ImageColorizationPage() {
  const t = useTranslations('imageColorization');
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const { credits, refreshCredits } = useCredits();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    setProcessedUrl(null);
    if (f) {
      setOriginalPreview(URL.createObjectURL(f));
    }
  };

  const uploadAndProcess = async () => {
    if (!selectedFile) return alert(t('selectImage') || 'Please select an image');
    if (!user) {
      alert(t('pleaseLoginToUse'));
      return;
    }
    if ((credits ?? 0) < 1) {
      alert(t('insufficientCredits'));
      return;
    }
    setIsProcessing(true);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      const upRes = await fetch('/api/image/upload', { method: 'POST', body: fd });
      if (!upRes.ok) throw new Error('upload failed');
      const { url: imageUrl } = await upRes.json();
      setUploading(false);

      const procRes = await fetch('/api/image/colorization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
      if (!procRes.ok) throw new Error('processing failed');
      const { processedUrl } = await procRes.json();
      setProcessedUrl(processedUrl);
      await refreshCredits();
    } catch (err) {
      console.error(err);
      alert(t('processingError'));
    } finally {
      setIsProcessing(false);
      setUploading(false);
    }
  };

  const downloadImage = (url?: string) => {
    const href = url || processedUrl;
    if (!href) return;
    const a = document.createElement('a');
    a.href = href;
    a.download = 'colorized-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {t('title')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">{t('description')}</p>
          </div>

          {/* Features */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{t('features.title')}</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>{t('features.aiColorization')}</li>
              <li>{t('features.qualityPreservation')}</li>
              <li>{t('features.naturalColors')}</li>
              <li>{t('features.fastProcessing')}</li>
            </ul>
          </div>

          {/* Upload & Processing */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{t('uploadTitle')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{t('creditsInfo')}</p>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {!selectedFile ? (
                <>
                  <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{t('uploadPrompt')}</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    {t('selectImage')}
                  </button>
                </>
              ) : (
                <div>
                  <div className="mb-4 relative h-64 w-full max-w-md mx-auto">
                    <Image
                      src={originalPreview || ''}
                      alt="Original"
                      fill
                      className="object-contain rounded"
                    />
                  </div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">{selectedFile.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <div className="flex items-center justify-center space-x-3">
                    <button onClick={() => fileInputRef.current?.click()} className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg">{t('changeImage')}</button>
                    <button onClick={uploadAndProcess} disabled={isProcessing} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg disabled:opacity-50">
                      {isProcessing ? (uploading ? t('uploading') : t('processing')) : t('colorizeImage')}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {processedUrl && (
              <div className="mt-6">
                <p className="text-green-700 dark:text-green-300 mb-4 font-semibold text-center">{t('processingComplete')}</p>
                <div className="relative h-64 w-full max-w-md mx-auto mb-4">
                  <Image
                    src={processedUrl}
                    alt="Colorized"
                    fill
                    className="object-contain rounded border"
                  />
                </div>
                <div className="text-center">
                  <button onClick={() => downloadImage()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                    {t('downloadImage')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{t('instructions.title')}</h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-700 dark:text-gray-300">
              <li>{t('instructions.step1')}</li>
              <li>{t('instructions.step2')}</li>
              <li>{t('instructions.step3')}</li>
              <li>{t('instructions.step4')}</li>
            </ol>
          </div>

          {/* Examples */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{t('examples.title')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{t('examples.subtitle')}</p>
            <div className="space-y-6">
              {[
                { title: t('examples.example1'), before: '/colorization/b1.jpg', after: '/colorization/a1.jpg' },
                { title: t('examples.example2'), before: '/colorization/b2.jpg', after: '/colorization/a2.jpg' },
                { title: t('examples.example3'), before: '/colorization/b3.jpg', after: '/colorization/a3.jpg' },
              ].map((ex, idx) => (
                <div key={idx} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">{ex.title}</h3>
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                    <div className="w-full md:w-1/2 text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('examples.original')}</div>
                      <div className="relative h-[22rem] w-full">
                        <img src={ex.before} alt={`before-${idx}`} className="object-contain rounded mx-auto h-[22rem]" />
                      </div>
                    </div>
                    <div className="w-full md:w-1/2 text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('examples.colorized')}</div>
                      <div className="relative h-[22rem] w-full">
                        <img src={ex.after} alt={`after-${idx}`} className="object-contain rounded mx-auto h-[22rem]" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">{t('faq.title')}</h2>
            <div className="space-y-4 text-gray-700 dark:text-gray-300">
              <div>
                <h3 className="font-semibold">{t('faq.q1')}</h3>
                <p>{t('faq.a1')}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t('faq.q2')}</h3>
                <p>{t('faq.a2')}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t('faq.q3')}</h3>
                <p>{t('faq.a3')}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t('faq.q4')}</h3>
                <p>{t('faq.a4')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

