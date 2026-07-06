import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/firebase';
import { CartProvider } from '@/contexts/CartContext';
import { ErrorManagerProvider } from '@/components/error-manager/ErrorManagerProvider';
import { GlobalErrorBoundary } from '@/components/error-manager/GlobalErrorBoundary';
import { GoogleAdsTag } from '@/components/analytics/GoogleAdsTag';
import { I18nProvider } from '@/i18n/i18n-context';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { TooltipProvider } from '@/components/ui/tooltip';

export const revalidate = 0;

export const viewport: Viewport = {
  themeColor: '#3D5AFE',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Viby',
  description: 'AI-powered component search and project structure visualization.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground flex flex-col min-h-screen">
        <GoogleAdsTag />
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  );
}
