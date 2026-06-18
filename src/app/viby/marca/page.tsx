
import * as React from 'react';
import { Metadata } from 'next';
import BrandAssetsClient from './BrandAssetsClient';
import { PublicHeader } from '@/components/layout/PublicHeader';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Material de Marca | Viby Club Official',
  description: 'Acesse e baixe os logotipos, ícones e materiais oficiais da Viby para sua divulgação.',
  alternates: { canonical: 'https://viby.club/viby/marca' },
  openGraph: {
    title: 'Media Kit Oficial | Viby',
    description: 'Recursos oficiais para parceiros e organizadores Viby.',
    url: 'https://viby.club/viby/marca',
    type: 'website'
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
