'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

/**
 * @fileOverview Componente de rastreamento consolidado (Google Tag).
 * Gerencia o Google Ads (AW-18219134289) e o Google Analytics (G-WZBEXGZEDG).
 * Inclui listener de rotas para garantir page_views em navegação SPA.
 */
export function GoogleAdsTag() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      const url = pathname + searchParams.toString();
      (window as any).gtag('config', 'G-WZBEXGZEDG', {
        page_path: url,
      });
      (window as any).gtag('config', 'AW-18219134289', {
        page_path: url,
      });
    }
  }, [pathname, searchParams]);

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-18219134289"
        strategy="afterInteractive"
      />
      <Script id="google-tag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'AW-18219134289', { 'send_page_view': false });
          gtag('config', 'G-WZBEXGZEDG', { 'send_page_view': false });
        `}
      </Script>
    </>
  );
}
