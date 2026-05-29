
import type {Metadata} from 'next';
import './globals.css';
import {Toaster} from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/contexts/CartContext';
import { ErrorManagerProvider } from '@/components/error-manager/ErrorManagerProvider';
import { GlobalErrorBoundary } from '@/components/error-manager/GlobalErrorBoundary';

export const metadata: Metadata = {
  title: {
    default: 'Viby | Gestão Inteligente de Eventos',
    template: '%s | Viby'
  },
  description: 'Centralize seus eventos, promova experiências e utilize IA para alavancar seus resultados.',
  metadataBase: new URL('https://viby.club'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Viby | Gestão Inteligente de Eventos',
    description: 'Centralize seus eventos, promova experiências e utilize IA para alavancar seus resultados.',
    url: 'https://viby.club',
    siteName: 'Viby',
    images: [
      {
        url: '/api/og?type=platform',
        width: 1200,
        height: 630,
        alt: 'Viby Platform',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viby | Gestão Inteligente de Eventos',
    description: 'Centralize seus eventos, promova experiências e utilize IA para alavancar seus resultados.',
    images: ['/api/og?type=platform'],
    creator: '@vibyclub',
  },
  robots: {
    index: true,
    follow: true,
  },
};

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
      </body>
    </html>
  );
}
