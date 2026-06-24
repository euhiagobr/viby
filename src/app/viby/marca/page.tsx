import * as React from 'react';
import { Metadata } from 'next';
import BrandAssetsClient from './BrandAssetsClient';
import { PublicHeader } from '@/components/layout/PublicHeader';
import Footer from '@/components/layout/Footer';

const VIBY_CAPA = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibycapa.jpeg?alt=media&token=352689b1-73e0-409b-ad29-e1c5e660bac0";

export const metadata: Metadata = {
  title: 'Media Kit Oficial | Logotipos e Identidade Visual Viby',
  description: 'Acesse o guia de marca oficial da Viby. Baixe logotipos em alta resolução, ícones e materiais de apoio para sua divulgação oficial.',
  keywords: ['media kit viby', 'logos viby', 'marca oficial viby', 'identidade visual', 'ativos de marca'],
  alternates: { canonical: 'https://viby.club/viby/marca' },
  openGraph: {
    title: 'Media Kit Oficial | Viby Club Assets',
    description: 'Recursos visuais e diretrizes de marca oficiais para parceiros, imprensa e organizadores da rede Viby.',
    url: 'https://viby.club/viby/marca',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ 
      url: VIBY_CAPA,
      width: 1200,
      height: 630,
      alt: "Media Kit Oficial Viby"
    }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Viby Media Kit | Guia de Marca',
    description: 'Baixe os ativos oficiais da Viby para sua produção.',
    images: [VIBY_CAPA]
  }
};

export default function VibyBrandPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <PublicHeader showBack hideCopa />
      
      <main className="flex-1 container mx-auto px-4 py-16 md:py-24 max-w-7xl">
        <BrandAssetsClient />
      </main>

      <Footer />
    </div>
  );
}
