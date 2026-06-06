import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/contexts/CartContext';
import { ErrorManagerProvider } from '@/components/error-manager/ErrorManagerProvider';
import { GlobalErrorBoundary } from '@/components/error-manager/GlobalErrorBoundary';
import { GoogleAdsTag } from '@/components/analytics/GoogleAdsTag';
import { I18nProvider } from '@/i18n/i18n-context';

export const revalidate = 0;

const DEFAULT_FAVICON = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FiconUrl_1780427863977?alt=media&token=1ab99264-b05c-4d1d-ab5a-0c27b7bfb77b";

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
    console.error("[Metadata Fetch Error]", e);
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings?.siteName || 'Viby';
  
  const rawIconUrl = settings?.siteIconUrl || settings?.iconUrl || DEFAULT_FAVICON;
  const version = settings?.imageVersion || Date.now();
  const separator = rawIconUrl.includes('?') ? '&' : '?';
  const iconUrl = rawIconUrl.startsWith('http') ? `${rawIconUrl}${separator}cache_v=${version}` : rawIconUrl;

  const description = 'Centralize seus eventos, promova experiências e utilize IA para alavancar seus resultados.';

  return {
    title: {
      default: `${siteName} | Gestão Inteligente de Eventos`,
      template: `%s | ${siteName}`
    },
    description,
    metadataBase: new URL('https://viby.club'),
    icons: {
      icon: [
        { url: iconUrl, type: 'image/png' },
        { url: iconUrl, sizes: '32x32', type: 'image/png' },
        { url: iconUrl, sizes: '192x192', type: 'image/png' },
        { url: iconUrl, sizes: '512x512', type: 'image/png' },
      ],
      apple: [
        { url: iconUrl, sizes: '180x180', type: 'image/png' },
      ],
      shortcut: [iconUrl],
    },
    manifest: '/manifest.webmanifest',
    alternates: {
      canonical: '/',
      languages: {
        'pt-BR': '/pt-BR',
        'en-US': '/en-US',
      },
    },
    openGraph: {
      title: `${siteName} | Gestão Inteligente de Eventos`,
      description,
      url: 'https://viby.club',
      siteName: siteName,
      images: [
        {
          url: '/api/og?type=platform',
          width: 1200,
          height: 630,
          alt: `${siteName} Platform`,
        },
      ],
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${siteName} | Gestão Inteligente de Eventos`,
      description,
      images: ['/api/og?type=platform'],
      creator: '@vibyclub',
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
      </head>
      <body className="font-body antialiased bg-[#f8fafc] text-[#000000] flex flex-col min-h-screen">
        <GoogleAdsTag />
        <I18nProvider>
          <FirebaseClientProvider>
            <ErrorManagerProvider>
              <GlobalErrorBoundary>
                <CartProvider>
                  <div className="flex-1 flex flex-col">
                    {children}
                  </div>
                  <Toaster />
                </CartProvider>
              </GlobalErrorBoundary>
            </ErrorManagerProvider>
          </FirebaseClientProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
