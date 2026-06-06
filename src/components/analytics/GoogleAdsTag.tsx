import Script from 'next/script';

/**
 * Componente de rastreamento do Google Ads (gtag.js).
 * Gerencia a inicialização do dataLayer e configuração da conta AW-18219134289.
 */
export function GoogleAdsTag() {
  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=AW-18219134289"
        strategy="afterInteractive"
      />
      <Script id="google-ads-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', 'AW-18219134289');
        `}
      </Script>
    </>
  );
}
