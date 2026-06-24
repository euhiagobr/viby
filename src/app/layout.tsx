import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/contexts/CartContext';
import { ErrorManagerProvider } from '@/components/error-manager/ErrorManagerProvider';
import { GlobalErrorBoundary } from '@/components/error-manager/GlobalErrorBoundary';
import { GoogleAdsTag } from '@/components/analytics/GoogleAdsTag';
import { I18nProvider } from '@/i18n/i18n-context';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { TooltipProvider } from '@/components/ui/tooltip';

export const revalidate = 0;

const DEFAULT_FAVICON = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FiconUrl_1780427863977?alt=media&token=1ab99264-b05c-4d1d-ab5a-0c27b7bfb77b";
const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

async function getSiteSettings() {
  try {
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const db = getAdminDb();
    const snap = await db.collection('settings').doc('site').get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings?.siteName || 'Viby';
  const description = 'Descubra eventos, experiências e comunidades na Viby.';
  
  const rawIconUrl = settings?.siteIconUrl || settings?.iconUrl || DEFAULT_FAVICON;
  const version = settings?.imageVersion || Date.now();
  const separator = rawIconUrl.includes('?') ? '&' : '?';
  const iconUrl = rawIconUrl.startsWith('http') ? `${rawIconUrl}${separator}cache_v=${version}` : rawIconUrl;

  return {
    title: {
      default: `${siteName} | Experiências Memoráveis`,
      template: `%s | ${siteName}`
    },
    description,
    metadataBase: new URL('https://viby.club'),
    keywords: ['eventos', 'ingressos', 'shows', 'experiências', 'viby', 'baladas', 'festivais'],
    icons: {
      icon: [
        { url: iconUrl, type: 'image/png' },
      ],
      apple: [
        { url: iconUrl, sizes: '180x180', type: 'image/png' },
      ],
    },
    openGraph: {
      title: siteName,
      description,
      url: 'https://viby.club',
      siteName: siteName,
      images: [
        {
          url: VIBY_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: siteName,
        },
      ],
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: siteName,
      description,
      images: [VIBY_OG_IMAGE],
    },
    robots: {
      index: true,
      follow: true,
    }
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="google-adsense-account" content="ca-pub-3790085999731396" />
        <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3790085999731396" crossOrigin="anonymous"></script>
      </head>
      <body className="font-body antialiased bg-[#f8fafc] text-[#000000] flex flex-col min-h-screen">
        <GoogleAdsTag />
        <FirebaseClientProvider>
          <I18nProvider>
            <CurrencyProvider>
              <ErrorManagerProvider>
                <GlobalErrorBoundary>
                  <TooltipProvider>
                    <CartProvider>
                      <div className="flex-1 flex flex-col">
                        {children}
                      </div>
                      <Toaster />
                    </CartProvider>
                  </TooltipProvider>
                </GlobalErrorBoundary>
              </ErrorManagerProvider>
            </CurrencyProvider>
          </I18nProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
