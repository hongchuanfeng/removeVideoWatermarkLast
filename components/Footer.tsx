'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';

export default function Footer() {
  const t = useTranslations('footer');
  const locale = useLocale();

  const legalLinks = [
    { href: `/${locale}/privacy`, label: t('privacy') },
    { href: `/${locale}/terms`, label: t('terms') },
    { href: `/${locale}/refund`, label: t('refund') },
    { href: `/${locale}/disclaimer`, label: t('disclaimer') },
    { href: `/${locale}/copyright`, label: t('copyright') },
    { href: `/${locale}/legal`, label: t('legal') },
    { href: `/${locale}/ip`, label: t('ip') },
  ];

  const friendLinks = [
    { href: 'https://mosaic.chdaoai.com/', label: t('friendLink1') },
    { href: 'https://www.icebreakgame.com/', label: t('friendLink2') },
    { href: 'https://pdf.chdaoai.com/', label: t('friendLink3') },
    { href: 'https://qrcode.chdaoai.com/', label: t('friendLink4') },
    { href: 'https://barcode.zorezoro.com/', label: t('friendLink5') },
    { href: 'https://www.zorezoro.com/', label: t('friendLink6') },
    { href: 'https://video2txt.zorezoro.com/', label: t('friendLink7') },
  ];

  return (
    <footer className="bg-gray-900 text-gray-300 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-white text-xl font-bold mb-4">RemoveWatermark</h3>
            <p className="text-sm">
              {t('description')}
            </p>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('legal')}</h4>
            <ul className="space-y-2">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('contact')}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="font-medium">{t('email')}:</span>{' '}
                <a href="mailto:support@removewatermarker.com" className="hover:text-white transition-colors">
                  support@removewatermarker.com
                </a>
              </li>
              <li>
                <span className="font-medium">{t('address')}:</span>{' '}
                {t('addressValue')}
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('quickLinks')}</h4>
            <ul className="space-y-2">
              <li>
                <Link href={`/${locale}`} className="text-sm hover:text-white transition-colors">
                  {t('home')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/about`} className="text-sm hover:text-white transition-colors">
                  {t('about')}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/contact`} className="text-sm hover:text-white transition-colors">
                  {t('contactUs')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Friend Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">{t('friendLinks')}</h4>
            <ul className="space-y-2">
              {friendLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} RemoveWatermark. All rights reserved.</p>
          <p className="mt-2">
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              {t('icp')}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

