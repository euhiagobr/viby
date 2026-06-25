'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useCallback } from 'react';

/**
 * @fileOverview Componente de rastreamento consolidado (Google Tag).
 * Gerencia o Google Ads (AW-18219134289) e o Google Analytics (G-WZBEXGZEDG).
 * Corrigido para lidar com carregamento assíncrono e garantir hit de landing page.
 */
export function GoogleAdsTag() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const trackPageView = useCallback(() => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      const queryString = searchParams.toString();
      const url = pathname + (queryString ? `?${queryString}` : '');
      
      // Atualiza o caminho e envia o hit de visualização
      (window as any).gtag('config', 'G-WZBEXGZEDG', {
        page_path: url,
      });
      (window as any).gtag('config', 'AW-18219134289', {
        page_path: url,
      });
      return true;
    }
    return false;
  }, [pathname, searchParams]);

  useEffect(() => {
    // Tenta rastrear imediatamente
    const tracked = trackPageView();

    // Se o gtag ainda não estiver pronto (script carregando), 
    // tenta novamente em intervalos curtos até ter sucesso
    if (!tracked) {
      const interval = setInterval(() => {
        if (trackPageView()) {
          clearInterval(interval);
        }
      }, 500);

      // Timeout de segurança para não rodar infinitamente
      const timeout = setTimeout(() => clearInterval(interval), 10000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [trackPageView]);

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

          // Desativa o hit automático para controle manual via componente de rota
          gtag('config', 'AW-18219134289', { 'send_page_view': false });
          gtag('config', 'G-WZBEXGZEDG', { 'send_page_view': false });
        `}
      </Script>
    </>
  );
}
