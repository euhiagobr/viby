import Script from 'next/script';

/**
 * Componente de rastreamento consolidado (Google Tag).
 * Gerencia o Google Ads (AW-18219134289) e o Google Analytics (G-WZBEXGZEDG).
 */
export function GoogleAdsTag() {
  return (
    <>
      {/* Script principal da Google Tag */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-18219134289"
        strategy="afterInteractive"
      />
      <Script id="google-tag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          // Configuração Google Ads
          gtag('config', 'AW-18219134289');
          
          // Configuração Google Analytics (GA4)
          gtag('config', 'G-WZBEXGZEDG');
        `}
      </Script>
    </>
  );
}
