import { Metadata } from 'next';

export function generateMetadata(locale: string, page?: string): Metadata {
  const baseUrl = 'https://www.removewatermarker.com';
  const titles: Record<string, Record<string, string>> = {
    en: {
      home: 'Remove Video Watermark, Logo & Subtitle - Professional Service',
      about: 'About Us - RemoveWatermark',
      contact: 'Contact Us - RemoveWatermark',
      privacy: 'Privacy Policy - RemoveWatermark',
      terms: 'Terms of Service - RemoveWatermark',
      refund: 'Refund Policy - RemoveWatermark',
      disclaimer: 'Disclaimer - RemoveWatermark',
      copyright: 'Copyright Notice - RemoveWatermark',
      legal: 'Legal Notice - RemoveWatermark',
      ip: 'Intellectual Property Statement - RemoveWatermark',
    },
    zh: {
      home: '视频去水印、Logo和字幕 - 专业服务',
      about: '关于我们 - RemoveWatermark',
      contact: '联系我们 - RemoveWatermark',
      privacy: '隐私政策 - RemoveWatermark',
      terms: '服务条款 - RemoveWatermark',
      refund: '退款政策 - RemoveWatermark',
      disclaimer: '免责声明 - RemoveWatermark',
      copyright: '版权声明 - RemoveWatermark',
      legal: '法律声明 - RemoveWatermark',
      ip: '知识产权声明 - RemoveWatermark',
    },
  };

  const pageKey = page || 'home';
  const title = titles[locale as 'en' | 'zh']?.[pageKey] || titles.en[pageKey];

  const descriptions: Record<'en' | 'zh', string> = {
    en: 'Professional video watermark removal service. Remove watermarks, logos, and subtitles from your videos.',
    zh: '专业的视频去水印服务，支持去除水印、Logo、字幕。',
  };

  const keywords: Record<'en' | 'zh', string> = {
    en: 'remove video watermark, remove video logo, remove video subtitle',
    zh: '视频去水印, 去水印, 去Logo, 去字幕',
  };

  const desc = descriptions[locale as 'en' | 'zh'] || descriptions.en;
  const kw = keywords[locale as 'en' | 'zh'] || keywords.en;
  const canonical = `${baseUrl}/${locale}${pageKey === 'home' ? '' : `/${pageKey}`}`;

  return {
    title,
    description: desc,
    keywords: kw,
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/en${pageKey === 'home' ? '' : `/${pageKey}`}`,
        zh: `${baseUrl}/zh${pageKey === 'home' ? '' : `/${pageKey}`}`,
      },
    },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      siteName: 'RemoveWatermark',
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : 'en_US',
      images: [
        {
          url: '/image/logo-after.png',
          width: 1200,
          height: 630,
          alt: 'Remove watermark demo result',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: ['/image/logo-after.png'],
    },
  };
}

