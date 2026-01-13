'use client';

import { useTranslations } from 'next-intl';

export const dynamic = 'force-static';

export default function PrivacyPage() {
  const t = useTranslations('privacy');

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('lastUpdated')}: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Introduction */}
        <div className="bg-blue-50 dark:bg-gray-800 p-6 rounded-xl mb-8">
          <p className="text-lg text-gray-700 dark:text-gray-300">
            {t('intro')}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <section key={num} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">{t(`section${num}.title`)}</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                {t(`section${num}.content`)}
              </p>
              {num === 10 && (
                <div className="mt-4 space-y-2">
                  <p className="text-gray-700 dark:text-gray-300">{t('section10.email')}</p>
                  <p className="text-gray-700 dark:text-gray-300">{t('section10.address')}</p>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
