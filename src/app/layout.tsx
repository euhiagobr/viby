import type { Metadata } from 'next';
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
  const iconUrl = settings?.iconUrl || '/favicon.ico';
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
        { url: iconUrl },
        { url: iconUrl, sizes: '32x32', type: 'image/png' },
        { url: iconUrl, sizes: '16x16', type: 'image/png' },
      ],
      apple: [
        { url: iconUrl, sizes: '180x180', type: 'image/png' },
      ],
      shortcut: [iconUrl],
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
    },
    other: {
      "google-adsense-account": "ca-pub-3790085999731396",
    },
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
        {/* Google AdSense Script - Pure Injection to prevent data-nscript attribute error */}
        <script 
          async 
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3790085999731396"
          crossOrigin="anonymous"
          dangerouslySetInnerHTML={{ __html: '' }}
        />
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
