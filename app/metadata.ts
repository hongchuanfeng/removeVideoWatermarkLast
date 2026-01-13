import { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.removewatermarker.com'),
  title: {
    default: '视频去水印、Logo和字幕 - 专业服务',
    template: '%s | RemoveWatermark',
  },
  description: '专业的视频去水印服务，支持去除水印、Logo、字幕，基于先进AI技术。',
  keywords: ['视频去水印', '去水印', '去Logo', '去字幕'],
  authors: [{ name: 'RemoveWatermark' }],
  creator: 'RemoveWatermark',
  publisher: 'RemoveWatermark',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://www.removewatermarker.com',
    siteName: 'RemoveWatermark',
    title: '视频去水印、Logo和字幕',
    description: '专业的视频去水印服务，去除水印/Logo/字幕',
  },
  twitter: {
    card: 'summary_large_image',
    title: '视频去水印、Logo和字幕',
    description: '专业的视频去水印服务，去除水印/Logo/字幕',
  },
  alternates: {
    canonical: 'https://www.removewatermarker.com',
    languages: {
      'en': 'https://www.removewatermarker.com/en',
      'zh': 'https://www.removewatermarker.com/zh',
    },
  },
};

