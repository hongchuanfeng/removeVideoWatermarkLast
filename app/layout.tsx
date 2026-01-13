import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const baseUrl = 'https://www.removewatermarker.com';

export const metadata = {
  title: 'Remove Video Watermark, Logo & Subtitle - Professional Service',
  description: 'Professional video watermark removal service. Remove watermarks, logos, and subtitles from your videos.',
  keywords: 'remove video watermark, remove video logo, remove video subtitle',
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    title: 'Remove Video Watermark, Logo & Subtitle - Professional Service',
    description: 'Professional video watermark removal service. Remove watermarks, logos, and subtitles from your videos.',
    url: baseUrl,
    siteName: 'RemoveWatermark',
    type: 'website',
    locale: 'en_US',
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
    title: 'Remove Video Watermark, Logo & Subtitle - Professional Service',
    description: 'Professional video watermark removal service. Remove watermarks, logos, and subtitles from your videos.',
    images: ['/image/logo-after.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <head>
        <link rel="canonical" href="https://www.removewatermarker.com" />
      </head>
      <body className={inter.className}>
        {/* Google tag (gtag.js) */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-YY6ZDNMLEF"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-YY6ZDNMLEF');
          `}
        </Script>

        {/* Google AdSense */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7274710287377352"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />

        {children}
      </body>
    </html>
  );
}

