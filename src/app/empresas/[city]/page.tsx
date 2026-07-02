
import * as React from 'react';
import { Metadata } from 'next';
import { getAdminDb } from '@/lib/firebase/admin';
import CityCompaniesClient from './CityCompaniesClient';
import { notFound } from 'next/navigation';
import { slugifyLocation } from '@/lib/city-utils';
import { PublicHeader } from '@/components/layout/PublicHeader';
import Footer from '@/components/layout/Footer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function serializeData(data: any): any {
  if (data === null || data === undefined) return null;
  if (typeof data.toDate === 'function') return data.toDate().toISOString();
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(item => serializeData(item));
  if (typeof data === 'object') {
    const proto = Object.getPrototypeOf(data);
    if (proto !== null && proto !== Object.prototype) return String(data);
    const serialized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        serialized[key] = serializeData(data[key]);
      }
    }
    return serialized;
  }
  return data;
}

async function getCityCompanies(citySlug: string) {
  const db = getAdminDb();
  try {
    // Busca todas as organizações ativas (limite de 200 para o diretório local)
    const snap = await db.collection('organizations')
      .where('status', '==', 'Ativo')
      .limit(200)
      .get();

    const allOrgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filtragem em memória para lidar com o slug da cidade (que pode não estar normalizado em todos os docs)
    const filtered = allOrgs.filter((org: any) => {
      const orgCity = org.city || org.address?.city || "";
      return slugifyLocation(orgCity) === citySlug.toLowerCase();
    });

    if (filtered.length === 0) return null;

    const cityName = filtered[0].city || filtered[0].address?.city || citySlug;

    return serializeData({
      organizations: filtered,
      cityName
    });
  } catch (e) {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params;
  const data = await getCityCompanies(city);
  
  if (!data) return { title: 'Empresas não encontradas | Viby', robots: { index: false } };

  const title = `Guia de Empresas e Serviços em ${data.cityName} | Viby`;
  const description = `Conheça os melhores prestadores de serviço, lojas, produtoras e marcas em ${data.cityName}. O diretório comercial oficial da Viby.`;

  return {
    title,
    description,
    alternates: { canonical: `https://viby.club/empresas/${city}` },
    openGraph: {
      title,
      description,
      url: `https://viby.club/empresas/${city}`,
      siteName: 'Viby',
      type: 'website',
      locale: 'pt_BR',
    }
  };
}

export default async function CityCompaniesPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  const data = await getCityCompanies(city);

  if (!data) notFound();

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col selection:bg-secondary selection:text-white">
      <PublicHeader showBack hideCopa />
      <main className="flex-1 container mx-auto px-4 py-12 md:py-20 max-w-7xl">
        <CityCompaniesClient 
          initialOrgs={data.organizations} 
          cityName={data.cityName} 
        />
      </main>
      <Footer />
    </div>
  );
}
