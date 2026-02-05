'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import AuthButton from './AuthButton';

export default function Header() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const toggleLanguage = (newLocale: string) => {
    const currentPath = pathname || '/';
    let pathWithoutLocale = currentPath;

    // Remove locale prefix only if it's the leading segment
    if (currentPath === `/${locale}`) {
      pathWithoutLocale = '/';
    } else if (currentPath.startsWith(`/${locale}/`)) {
      pathWithoutLocale = currentPath.slice(locale.length + 1); // remove leading '/{locale}'
    }

    const target = pathWithoutLocale === '/' ? `/${newLocale}` : `/${newLocale}${pathWithoutLocale}`;
    try {
      // Persist choice to reduce server-side locale negotiation surprises
      if (typeof document !== 'undefined') {
        // Set cookie for next requests
        document.cookie = `NEXT_LOCALE=${encodeURIComponent(newLocale)};path=/;max-age=${60 * 60 * 24 * 365}`;
        // Also set localStorage for client-side checks
        try {
          localStorage.setItem('locale', newLocale);
        } catch {}
      }
    } catch (e) {
      // ignore
    }
    // Navigate to the target locale path
    window.location.href = target;
  };

  // language dropdown open state handled above

  const navItems = [
    { href: `/${locale}`, label: t('home') },
    { href: `/${locale}/subscription`, label: t('subscription') },
  ];

  const removalItemsBase = [
    { href: `/${locale}/image-watermark-removal`, label: t('imageWatermarkRemoval') },
    { href: `/${locale}/image-restoration`, label: t('imageRestoration') },
  ];

  const removalItemsExtra =
    locale === 'zh' || locale === 'en'
      ? [{ href: `/${locale}/image-cutout`, label: t('imageCutout') }]
      : [];

  const removalItems = [
    ...removalItemsBase,
    ...removalItemsExtra,
    { href: `/${locale}/pdf-watermark-removal`, label: t('pdfWatermarkRemoval') },
    { href: `/${locale}/ebook-watermark-removal`, label: t('ebookWatermarkRemoval') },
  ];
  const [isRemovalsOpen, setIsRemovalsOpen] = useState(false);
  const removalsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!removalsRef.current) return;
      if (!removalsRef.current.contains(e.target as Node)) {
        setIsRemovalsOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <header className="bg-white dark:bg-gray-900 shadow-md sticky top-0 z-50">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href={`/${locale}`} className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            RemoveWatermark
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}

            {/* Other removals dropdown (click to open) */}
            <div className="relative" ref={removalsRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRemovalsOpen((s) => !s);
                }}
                aria-expanded={isRemovalsOpen}
                className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium whitespace-nowrap px-2 py-1 rounded-md"
                type="button"
              >
                <span>{t('otherRemovals')}</span>
                <svg
                  className={`w-4 h-4 ml-2 transition-transform ${isRemovalsOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8l4 4 4-4" />
                </svg>
              </button>
              {isRemovalsOpen && (
                <div className="absolute left-0 mt-2 min-w-[12rem] w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-2 z-50">
                  {removalItems.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors break-words"
                      onClick={() => setIsRemovalsOpen(false)}
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Language Selector */}
            <div 
              className="relative"
              onMouseEnter={() => setIsLangOpen(true)}
              onMouseLeave={() => setIsLangOpen(false)}
            >
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-sm font-medium">{locale.toUpperCase()}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isLangOpen && (
                <>
                  {/* 填充区域，确保鼠标移动路径连续 */}
                  <div 
                    className="absolute right-0 top-full w-32 h-2"
                    onMouseEnter={() => setIsLangOpen(true)}
                  />
                  <div 
                    className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-2 z-50"
                    onMouseEnter={() => setIsLangOpen(true)}
                    onMouseLeave={() => setIsLangOpen(false)}
                  >
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          setIsLangOpen(false);
                          toggleLanguage('en');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${locale === 'en' ? 'font-semibold text-blue-600' : ''}`}
                      >
                        English
                      </button>
                    </div>
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          setIsLangOpen(false);
                          toggleLanguage('zh');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${locale === 'zh' ? 'font-semibold text-blue-600' : ''}`}
                      >
                        中文
                      </button>
                    </div>
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          setIsLangOpen(false);
                          toggleLanguage('ru');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${locale === 'ru' ? 'font-semibold text-blue-600' : ''}`}
                      >
                        Русский
                      </button>
                    </div>
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          setIsLangOpen(false);
                          toggleLanguage('fr');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${locale === 'fr' ? 'font-semibold text-blue-600' : ''}`}
                      >
                        Français
                      </button>
                    </div>
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          setIsLangOpen(false);
                          toggleLanguage('de');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${locale === 'de' ? 'font-semibold text-blue-600' : ''}`}
                      >
                        Deutsch
                      </button>
                    </div>
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          setIsLangOpen(false);
                          toggleLanguage('ar');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${locale === 'ar' ? 'font-semibold text-blue-600' : ''}`}
                      >
                        العربية
                      </button>
                    </div>
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          setIsLangOpen(false);
                          toggleLanguage('ja');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${locale === 'ja' ? 'font-semibold text-blue-600' : ''}`}
                      >
                        日本語
                      </button>
                    </div>
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          setIsLangOpen(false);
                          toggleLanguage('ko');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${locale === 'ko' ? 'font-semibold text-blue-600' : ''}`}
                      >
                        한국어
                      </button>
                    </div>
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          setIsLangOpen(false);
                          toggleLanguage('es');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${locale === 'es' ? 'font-semibold text-blue-600' : ''}`}
                      >
                        Español
                      </button>
                    </div>
                    <div className="px-2 py-1">
                      <button
                        onClick={() => {
                          setIsLangOpen(false);
                          toggleLanguage('pt');
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${locale === 'pt' ? 'font-semibold text-blue-600' : ''}`}
                      >
                        Português
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Google Login Button */}
            <AuthButton />
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-2">
            <AuthButton />
            <div 
              className="relative"
              onMouseEnter={() => setIsLangOpen(true)}
              onMouseLeave={() => setIsLangOpen(false)}
            >
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm"
              >
                {locale.toUpperCase()}
              </button>
              {isLangOpen && (
                <>
                  {/* 填充区域，确保鼠标移动路径连续 */}
                  <div 
                    className="absolute right-0 top-full w-32 h-2"
                    onMouseEnter={() => setIsLangOpen(true)}
                  />
                  <div 
                    className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-2 z-50"
                    onMouseEnter={() => setIsLangOpen(true)}
                    onMouseLeave={() => setIsLangOpen(false)}
                  >
                    <button
                      onClick={() => toggleLanguage('en')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      English
                    </button>
                    <button
                      onClick={() => toggleLanguage('zh')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      中文
                    </button>
                    <button
                      onClick={() => toggleLanguage('ru')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Русский
                    </button>
                    <button
                      onClick={() => toggleLanguage('fr')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Français
                    </button>
                    <button
                      onClick={() => toggleLanguage('de')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Deutsch
                    </button>
                    <button
                      onClick={() => toggleLanguage('ar')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      العربية
                    </button>
                    <button
                      onClick={() => toggleLanguage('ja')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      日本語
                    </button>
                    <button
                      onClick={() => toggleLanguage('ko')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      한국어
                    </button>
                    <button
                      onClick={() => toggleLanguage('es')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Español
                    </button>
                    <button
                      onClick={() => toggleLanguage('pt')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Português
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 dark:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
              <div className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm">{t('otherRemovals')}</div>
              {removalItems.map((sub) => (
                <Link
                  key={sub.href}
                  href={sub.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  {sub.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

