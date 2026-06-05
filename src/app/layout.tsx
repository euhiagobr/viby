import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/contexts/CartContext';
import { ErrorManagerProvider } from '@/components/error-manager/ErrorManagerProvider';
import { GlobalErrorBoundary } from '@/components/error-manager/GlobalErrorBoundary';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import Script from 'next/script';

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

async function getSiteSettings() {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const db = getFirestore(app);
    const snap = await getDoc(doc(db, 'settings', 'site'));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("[Metadata Fetch Error]", e);
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings?.siteName || 'Viby';
  
  // Fonte única oficial: siteIconUrl (Alias de prioridade para favicon dinâmico)
  const rawIconUrl = settings?.siteIconUrl || settings?.iconUrl || '/favicon.ico';
  
  // Cache busting: usando imageVersion do DB ou timestamp para garantir atualização
  const version = settings?.imageVersion || Date.now();
  const separator = rawIconUrl.includes('?') ? '&' : '?';
  const iconUrl = rawIconUrl.startsWith('http') ? `${rawIconUrl}${separator}v=${version}` : rawIconUrl;

  const description = 'Centralize seus eventos, promova experiências e utilize IA para alavancar seus resultados.';

  return {
    title: {
      default: `${siteName} | Gestão Inteligente de Eventos`,
      template: `%s | ${siteName}`
    },
    description,
    metadataBase: new URL('https://viby.club'),
    manifest: '/manifest.json',
    icons: {
      icon: [
        { url: iconUrl, type: 'image/x-icon' },
        { url: iconUrl, sizes: '32x32', type: 'image/png' },
        { url: iconUrl, sizes: '192x192', type: 'image/png' },
        { url: iconUrl, sizes: '512x512', type: 'image/png' },
      ],
      apple: [
        { url: iconUrl, sizes: '180x180', type: 'image/png' },
      ],
      shortcut: [{ url: iconUrl }],
      other: [
        {
          rel: 'mask-icon',
          url: iconUrl,
          color: '#000000',
        },
      ],
    },
    alternates: {
      canonical: '/',
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
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(function(registration) {
                  console.log('ServiceWorker registration successful with scope: ', registration.scope);
                }, function(err) {
                  console.log('ServiceWorker registration failed: ', err);
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
