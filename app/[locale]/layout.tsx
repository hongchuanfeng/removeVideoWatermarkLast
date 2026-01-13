import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/lib/auth-context';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }> | { locale: string };
}) {
  console.log('[LocaleLayout] ========================================');
  console.log('[LocaleLayout] Layout called');
  
  // Handle both Promise and non-Promise params (Next.js 15 compatibility)
  const resolvedParams = params instanceof Promise ? await params : params;
  console.log('[LocaleLayout] Resolved params:', resolvedParams);
  console.log('[LocaleLayout] Params locale:', resolvedParams?.locale);
  
  const locale = resolvedParams?.locale;
  
  if (!locale || !locales.includes(locale as any)) {
    console.log('[LocaleLayout] Invalid locale, calling notFound()');
    console.log('[LocaleLayout] Locale value:', locale);
    console.log('[LocaleLayout] Available locales:', locales);
    notFound();
  }

  console.log('[LocaleLayout] Getting messages for locale:', locale);
  const messages = await getMessages({ locale });
  console.log('[LocaleLayout] Messages loaded successfully');
  console.log('[LocaleLayout] ========================================');

  return (
    <AuthProvider>
      <NextIntlClientProvider messages={messages}>
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </NextIntlClientProvider>
    </AuthProvider>
  );
}

