'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useCredits } from '@/lib/user-credits-client';

export default function PDFWatermarkRemovalPage() {
  const t = useTranslations('pdfWatermarkRemoval');
  const locale = useLocale();
  const { user, loading: authLoading } = useAuth();
  const { credits, refreshCredits } = useCredits();
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedPDFs, setProcessedPDFs] = useState<Record<string,string>>({});
  const [loginPrompt, setLoginPrompt] = useState<string>('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([locale]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load selected languages from header/localStorage on mount
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('pdf_selected_languages') : null;
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedLanguages(parsed);
          return;
        }
      }
    } catch (e) {}
    // fallback to current locale
    setSelectedLanguages([locale]);
  }, [locale]);

  // Handle PDF upload
  const handlePDFUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('=== handlePDFUpload 被调用 ===');

    // Require login when attempting to upload a PDF
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

      setSelectedFile(file);
      setProcessedPDFs({});
    } else {
      console.log('没有选择文件');
    }
  };

  // Process PDF with AI
  const processPDF = async () => {
    console.log('=== processPDF 函数被调用 ===');
    console.log('selectedFile:', selectedFile);

    if (!selectedFile) {
      console.log('缺少PDF文件');
      return;
    }

    // Require login when attempting to process a PDF
    if (!user) {
      setLoginPrompt(t('pleaseLoginToUse') || '请先登录后再使用');
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      router.push(`/?next=${encodeURIComponent(currentPath)}`);
      return;
    }

    // Check credits (1 per language)
    const neededCredits = selectedLanguages.length;
    if ((credits ?? 0) < neededCredits) {
      console.log('积分不足:', credits, '需要:', neededCredits);
      alert(t('insufficientCredits'));
      return;
    }

    console.log('开始处理PDF...');
    setIsProcessing(true);

    try {
      // First, upload PDF to get URL
      console.log('准备上传PDF...');
      const formData = new FormData();
      formData.append('file', selectedFile);
      console.log('FormData创建完成，包含文件:', selectedFile.name);

      console.log('发起上传请求到 /api/pdf/upload...');
      const uploadResponse = await fetch('/api/pdf/upload', {
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
      const { url: pdfUrl } = uploadResult;

      // Batch processing: process selectedLanguages in groups of 2 to avoid timeout
      const batchSize = 2;
      const results: Record<string,string> = {};
      for (let i = 0; i < selectedLanguages.length; i += batchSize) {
        const batch = selectedLanguages.slice(i, i + batchSize);
        console.log('Processing batch:', batch);

        const promises = batch.map((lang) =>
          fetch('/api/pdf/remove-watermark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdfUrl, lang }),
          }).then(async (res) => {
            if (!res.ok) {
              const text = await res.text();
              throw new Error(text || 'Processing failed');
            }
            return res.json();
          })
        );

        const batchResponses = await Promise.all(promises);
        batchResponses.forEach((r, idx) => {
          const lang = batch[idx];
          results[lang] = r.processedPDFUrl;
        });

        // Refresh credits after each batch
        await refreshCredits();

        // If there are more batches, ask user whether to continue
        if (i + batchSize < selectedLanguages.length) {
          const continueMsg = t('continuePrompt', { processed: i + batchSize, total: selectedLanguages.length });
          const shouldContinue = window.confirm(continueMsg);
          if (!shouldContinue) {
            break;
          }
        }
      }

      setProcessedPDFs(results);
    } catch (error) {
      console.error('Processing error:', error);
      alert(t('processingError'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Download processed PDF
  const downloadPDF = (url?: string) => {
    const target = url || Object.values(processedPDFs)[0];
    if (!target) return;
    const link = document.createElement('a');
    link.href = target;
    link.download = 'processed-document.pdf';
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
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              {t('title')}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {t('description')}
            </p>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {t('pdfCreditsInfo', { credits })}
            </div>
          </div>

          {/* Selected languages are managed via header multi-select; load from localStorage */}

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
                accept="application/pdf"
                onChange={handlePDFUpload}
                className="hidden"
              />

              {!selectedFile ? (
                <div>
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6 4h6m6-8v6m0 0v6m0-6h6m-6 0h6m6-4v8m0-8v8m0-8h-6m6 0h-6" />
                  </svg>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{t('uploadPrompt')}</p>
                  <button
                    onClick={() => {
                      console.log('=== 选择PDF按钮被点击 ===');
                      if (fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    {t('selectPDF')}
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6 4h6m6-8v6m0 0v6m0-6h6m-6 0h6m6-4v8m0-8v8m0-8h-6m6 0h-6" />
                  </svg>
                  <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    onClick={() => {
                      console.log('=== 更换PDF按钮被点击 ===');
                      if (fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors mr-4"
                  >
                    {t('changePDF')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Processing Section */}
          {selectedFile && Object.keys(processedPDFs).length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {t('readyToProcess')}
                </p>
                <button
                  onClick={processPDF}
                  disabled={isProcessing || ((credits ?? 0) < 1)}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg transition-colors text-lg font-semibold"
                >
                  {isProcessing ? t('processing') : t('processPDF')}
                </button>
              </div>
            </div>
          )}

          {/* Result Section */}
          {Object.keys(processedPDFs).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                {t('resultTitle')}
              </h2>

              <div className="space-y-4">
                {Object.entries(processedPDFs).map(([lang, url]) => (
                  <div key={lang} className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <div className="text-green-800 dark:text-green-200 font-medium">{t('processingComplete')} - {lang.toUpperCase()}</div>
                      <div className="text-green-600 dark:text-green-400 text-sm">{t('downloadReady')}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{t('downloadPDF')}</a>
                      <button onClick={() => downloadPDF(url)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm">
                        {t('downloadPDF')}
                      </button>
                    </div>
                  </div>
                ))}
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
                  <p className="text-gray-700 dark:text-gray-300">{t('features.aiDetection')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('features.textWatermark')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('features.imageWatermark')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300">{t('features.quality')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Examples Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              {t('examples.title')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{t('examples.subtitle')}</p>

            <div className="space-y-6">
              {[
                { before: '/pdf/b1.jpg', after: '/pdf/a1.jpg' },
                { before: '/pdf/b2.jpg', after: '/pdf/a2.jpg' },
                { before: '/pdf/b3.jpg', after: '/pdf/a3.jpg' },
                { before: '/pdf/b4.jpg', after: '/pdf/a4.jpg' },
                { before: '/pdf/b5.jpg', after: '/pdf/a5.jpg' },
              ].map((ex, idx) => (
                <div key={idx} className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-b-0">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white text-center">
                    {t('examples.title')} {idx + 1}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6 items-center">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.before')}</p>
                      <img
                        src={ex.before}
                        alt={`before-${idx + 1}`}
                        className="max-w-full h-auto border rounded-lg mx-auto"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('examples.after')}</p>
                      <img
                        src={ex.after}
                        alt={`after-${idx + 1}`}
                        className="max-w-full h-auto border rounded-lg mx-auto"
                      />
                    </div>
                  </div>
                </div>
              ))}
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
