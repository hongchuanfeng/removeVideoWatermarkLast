'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import VideoUpload from '@/components/VideoUpload';
import { useAuth } from '@/lib/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const t = useTranslations('home');
  const locale = useLocale();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle redirect after login
  useEffect(() => {
    const next = searchParams?.get('next');
    if (user && next) {
      router.push(next);
    }
  }, [user, searchParams, router]);

  // Handle login prompt for unauthenticated users with next parameter
  const nextParam = searchParams?.get('next');
  const needsLogin = nextParam && !user;

  // Show login prompt for unauthenticated users who came from protected pages
  if (needsLogin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <svg className="w-16 h-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('authRequired.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('authRequired.subtitle')}
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={async () => {
                // Trigger Google OAuth login
                const supabase = createClient();
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                  },
                });

                if (error) {
                  console.error('Error signing in:', error);
                }
              }}
              className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="hidden sm:inline">{t('auth.signInWithGoogle')}</span>
            </button>

            <button
              onClick={() => router.push('/')}
              className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              {t('auth.backToHome')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      {/* Hero Section */}
      <section className="text-center mb-20">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          {t('title')}
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8">
          {t('subtitle')}
        </p>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-12">
          {t('description')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="#upload"
            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-lg font-semibold"
          >
            {t('cta.start')}
          </Link>
          <Link
            href={`/${locale}/subscription`}
            className="px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-lg font-semibold"
          >
            {t('subscribe')}
          </Link>
          <Link
            href="#features"
            className="px-8 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hoverbg-gray-600 transition-colors text-lg font-semibold"
          >
            {t('cta.learnMore')}
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="mb-20">
        <h2 className="text-4xl font-bold text-center mb-12">{t('features.title')}</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-6 mx-auto">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-center mb-4">{t('features.watermark')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {t('features.watermarkDesc')}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-6 mx-auto">
              <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-center mb-4">{t('features.logo')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {t('features.logoDesc')}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-6 mx-auto">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-center mb-4">{t('features.subtitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-center">
              {t('features.subtitleDesc')}
            </p>
          </div>
        </div>
      </section>

      {/* How to Use Section */}
      <section id="how-to-use" className="mb-20 bg-gray-50 dark:bg-gray-900 py-16 rounded-2xl">
        <h2 className="text-4xl font-bold text-center mb-12">{t('howToUse.title')}</h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-6 mx-auto">
              1
            </div>
            <h3 className="text-xl font-semibold mb-4">{t('howToUse.step1')}</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('howToUse.step1Desc')}
            </p>
          </div>
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-6 mx-auto">
              2
            </div>
            <h3 className="text-xl font-semibold mb-4">{t('howToUse.step2')}</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('howToUse.step2Desc')}
            </p>
          </div>
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-600 text-white rounded-full flex items-center justify-center text-3xl font-bold mb-6 mx-auto">
              3
            </div>
            <h3 className="text-xl font-semibold mb-4">{t('howToUse.step3')}</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {t('howToUse.step3Desc')}
            </p>
          </div>
        </div>
      </section>

      {/* Credits Info Section */}
      <section className="mb-20">
        <div className="max-w-4xl mx-auto">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3">
              {t('creditsInfo.title')}
            </h3>
            <p className="text-blue-800 dark:text-blue-200 mb-4">
              {t('creditsInfo.rule')}
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                t('creditsInfo.example1'),
                t('creditsInfo.example2'),
                t('creditsInfo.example3')
              ].map((example: string, index: number) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-100 dark:border-blue-700">
                  <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
                    {example}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Upload Section */}
      <section id="upload" className="mb-20">
        <VideoUpload />
      </section>

      {/* Case Studies Section */}
      <section id="case-studies" className="mb-20">
        <h2 className="text-4xl font-bold text-center mb-12">{t('caseStudies.title')}</h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
          {t('caseStudies.description')}
        </p>
        <div className="grid md:grid-cols-2 gap-8">
          {/* 去水印/Logo - 处理前 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="aspect-video relative rounded-lg mb-4 overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src="/image/logo-before.jpg"
                alt={t('caseStudies.beforeTitle')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('caseStudies.beforeTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('caseStudies.beforeDesc')}</p>
          </div>
          {/* 去水印/Logo - 处理后 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="aspect-video relative rounded-lg mb-4 overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src="/image/logo-after.jpg"
                alt={t('caseStudies.afterTitle')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('caseStudies.afterTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('caseStudies.afterDesc')}</p>
          </div>
          {/* 去字幕 - 处理前 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="aspect-video relative rounded-lg mb-4 overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src="/image/srt-before.jpg"
                alt={t('caseStudies.subtitleBeforeTitle')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('caseStudies.subtitleBeforeTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('caseStudies.subtitleBeforeDesc')}</p>
          </div>
          {/* 去字幕 - 处理后 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="aspect-video relative rounded-lg mb-4 overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src="/image/srt-after.jpg"
                alt={t('caseStudies.subtitleAfterTitle')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('caseStudies.subtitleAfterTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('caseStudies.subtitleAfterDesc')}</p>
          </div>
          {/* 去Logo示例1 - 处理前 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="aspect-video relative rounded-lg mb-4 overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src="/image/b1.jpg"
                alt={t('caseStudies.logo1BeforeTitle')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('caseStudies.logo1BeforeTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('caseStudies.logo1BeforeDesc')}</p>
          </div>
          {/* 去Logo示例1 - 处理后 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="aspect-video relative rounded-lg mb-4 overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src="/image/a1.jpg"
                alt={t('caseStudies.logo1AfterTitle')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('caseStudies.logo1AfterTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('caseStudies.logo1AfterDesc')}</p>
          </div>
          {/* 去Logo示例2 - 处理前 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="aspect-video relative rounded-lg mb-4 overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src="/image/b2.jpg"
                alt={t('caseStudies.logo2BeforeTitle')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('caseStudies.logo2BeforeTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('caseStudies.logo2BeforeDesc')}</p>
          </div>
          {/* 去Logo示例2 - 处理后 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="aspect-video relative rounded-lg mb-4 overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src="/image/a2.jpg"
                alt={t('caseStudies.logo2AfterTitle')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('caseStudies.logo2AfterTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('caseStudies.logo2AfterDesc')}</p>
          </div>
          {/* 去字幕示例 - 处理前 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="aspect-video relative rounded-lg mb-4 overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src="/image/b3.jpg"
                alt={t('caseStudies.subtitle2BeforeTitle')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('caseStudies.subtitle2BeforeTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('caseStudies.subtitle2BeforeDesc')}</p>
          </div>
          {/* 去字幕示例 - 处理后 */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="aspect-video relative rounded-lg mb-4 overflow-hidden bg-gray-200 dark:bg-gray-700">
              <Image
                src="/image/a3.jpg"
                alt={t('caseStudies.subtitle2AfterTitle')}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t('caseStudies.subtitle2AfterTitle')}</h3>
            <p className="text-gray-600 dark:text-gray-400">{t('caseStudies.subtitle2AfterDesc')}</p>
          </div>
        </div>
      </section>

      {/* Help & FAQ Section */}
      <section id="help" className="mb-20 bg-gray-50 dark:bg-gray-900 py-16 rounded-2xl">
        <h2 className="text-4xl font-bold text-center mb-12">
          {t('help.title', { default: '帮助与支持' })}
        </h2>
        <div className="max-w-3xl mx-auto">
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2">
                {t('help.faq1.title', { default: '支持哪些视频格式？' })}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('help.faq1.desc', { default: '支持主流格式：MP4、AVI、MOV、MKV 等。' })}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2">
                {t('help.faq2.title', { default: '处理需要多久？' })}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('help.faq2.desc', { default: '取决于视频长度和复杂度，1 分钟视频通常需 2-5 分钟。' })}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-2">
                {t('help.faq3.title', { default: '视频安全吗？' })}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {t('help.faq3.desc', { default: '使用安全加密，视频会在 24 小时后自动删除。' })}
              </p>
            </div>
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/contact"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block"
            >
              {t('help.feedback', { default: '问题反馈' })}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

