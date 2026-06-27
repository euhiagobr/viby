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

const DEFAULT_FAVICON = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FiconUrl_1780427863977?alt=media&token=1ab99264-b05c-4d1d-ab5a-0c27b7bfb77b";
const VIBY_OG_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Viby | Experiências Memoráveis',
  description: 'Descubra eventos, experiências e comunidades na Viby.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="font-body antialiased bg-[#f8fafc] text-[#000000] flex flex-col min-h-screen">
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
