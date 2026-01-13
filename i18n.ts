import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'zh', 'ru', 'fr', 'de', 'ar', 'ja', 'ko', 'es', 'pt'] as const;
export const defaultLocale = 'en' as const;

export default getRequestConfig(async ({ locale }) => {
  console.log('[i18n.ts] ========================================');
  console.log('[i18n.ts] getRequestConfig called with locale:', locale);
  console.log('[i18n.ts] Available locales:', locales);
  console.log('[i18n.ts] Default locale:', defaultLocale);
  
  // In next-intl 3.0.0, locale parameter is still available (deprecated but functional)
  // requestLocale() is only available in newer versions (3.22+)
  // If locale is undefined (e.g., during static generation), use default locale
  const resolvedLocale = locale || defaultLocale;
  
  if (!resolvedLocale || !locales.includes(resolvedLocale as any)) {
    console.log('[i18n.ts] Invalid locale, calling notFound()');
    console.log('[i18n.ts] Locale value:', resolvedLocale);
    console.log('[i18n.ts] Locale type:', typeof resolvedLocale);
    notFound();
  }

  console.log('[i18n.ts] Loading messages for locale:', resolvedLocale);
  const messages = (await import(`./messages/${resolvedLocale}.json`)).default;
  console.log('[i18n.ts] Messages loaded successfully');
  console.log('[i18n.ts] ========================================');

  return {
    locale: resolvedLocale,
    messages
  };
});

