'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useCallback } from 'react';

/**
 * @fileOverview Componente de rastreamento consolidado (Google Tag).
 * Gerencia o Google Ads (AW-18219134289) e o Google Analytics (G-WZBEXGZEDG).
 * Implementado para garantir rastreamento em 100% das páginas, incluindo SPAs.
 */
export function GoogleAdsTag() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sendPageView = useCallback((path: string) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      // Dispara evento manual de page_view para garantir captura em navegação interna (SPA)
      (window as any).gtag('event', 'page_view', {
        page_path: path,
        page_location: window.location.href,
        page_title: document.title,
        send_to: 'G-WZBEXGZEDG'
      });
      
      // Atualiza contexto do Google Ads
      (window as any).gtag('config', 'AW-18219134289', {
        page_path: path
      });
      
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    // Montagem da URL completa com query string correta
    const query = searchParams.toString();
    const url = pathname + (query ? `?${query}` : '');
    
    // Tenta enviar o hit inicial
    const tracked = sendPageView(url);

    // Mecanismo de redundância: Caso o script gtag ainda não tenha carregado
    // no momento do mount da primeira página (Landing Page), tenta novamente
    // em intervalos curtos até o carregamento ou timeout.
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

          // Configuração inicial desativando hits automáticos para evitar duplicidade
          // O rastreio é gerido manualmente pelo useEffect acima em cada mudança de rota.
          gtag('config', 'AW-18219134289', { 'send_page_view': false });
          gtag('config', 'G-WZBEXGZEDG', { 'send_page_view': false });
        `}
      </Script>
    </>
  );
}
