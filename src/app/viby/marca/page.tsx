import * as React from 'react';
import { Metadata } from 'next';
import BrandAssetsClient from './BrandAssetsClient';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Material de Marca | Viby Club Official',
  description: 'Acesse e baixe os logotipos, ícones e materiais oficiais da Viby para sua divulgação no Media Kit oficial.',
  keywords: ['media kit', 'brand assets', 'logos viby', 'identidade visual viby', 'marketing viby'],
  alternates: { canonical: 'https://viby.club/viby/marca' },
  openGraph: {
    title: 'Media Kit Oficial | Viby Club',
    description: 'Recursos visuais e mídias oficiais para parceiros e organizadores da rede Viby.',
    url: 'https://viby.club/viby/marca',
    siteName: 'Viby',
    type: 'website',
    locale: 'pt_BR',
    images: [{ 
      url: "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417",
      width: 1200,
      height: 630,
      alt: "Media Kit Viby"
    }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Media Kit Oficial | Viby Club',
    description: 'Acesse e baixe os logotipos e materiais oficiais da Viby.',
    images: ["https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417"]
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
