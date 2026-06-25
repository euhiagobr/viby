
'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useCallback } from 'react';

/**
 * @fileOverview Componente de rastreamento consolidado (Google Tag).
 * Gerencia o Google Ads (AW-18219134289) e o Google Analytics (G-WZBEXGZEDG).
 * Corrigido para garantir rastreamento em todas as rotas dinâmicas e navegações SPA.
 */
export function GoogleAdsTag() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sendPageView = useCallback((path: string) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      // IMPORTANTE: Para SPAs com auto-tracking desativado, o hit deve ser enviado via 'event' 'page_view'
      (window as any).gtag('event', 'page_view', {
        page_path: path,
        page_location: window.location.href,
        page_title: document.title,
        send_to: 'G-WZBEXGZEDG'
      });
      
      // Atualiza o contexto do Google Ads também
      (window as any).gtag('config', 'AW-18219134289', {
        page_path: path
      });
      
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // Correção: Inclusão do '?' para searchParams se existirem
    const query = searchParams.toString();
    const url = pathname + (query ? `?${query}` : '');
    
    // Tenta rastrear a visualização
    const tracked = sendPageView(url);

    // Mecanismo de polling para garantir o rastreio da Landing Page 
    // se o script do Google demorar a inicializar o objeto window.gtag
    if (!tracked) {
      const interval = setInterval(() => {
        if (sendPageView(url)) {
          clearInterval(interval);
        }
      }, 500);

      const timeout = setTimeout(() => clearInterval(interval), 10000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [pathname, searchParams, sendPageView]);

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

          // Desativa o hit automático global para evitar duplicação
          // O rastreio é gerido manualmente pelo componente React
          gtag('config', 'AW-18219134289', { 'send_page_view': false });
          gtag('config', 'G-WZBEXGZEDG', { 'send_page_view': false });
        `}
      </Script>
    </>
  );
}
