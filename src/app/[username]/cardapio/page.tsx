
import { ExclusivePublicMenu } from "@/components/organizer/ExclusivePublicMenu";
import { getOrganizationByUsername, getMenuByOrgId } from "@/firebase/server";
import { notFound } from 'next/navigation';
import type { Metadata, ResolvingMetadata } from 'next';
import { PublicHeader } from "@/components/layout/PublicHeader";
import Footer from "@/components/layout/Footer";
 
type Props = {
  params: { username: string }
}
 
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const org = await getOrganizationByUsername(params.username);
 
  if (!org) {
    return {
        title: "Cardápio não encontrado",
    }
  }
 
  const title = `Cardápio | ${org.nome}`;
  const description = `Confira o cardápio completo de ${org.nome}. ${org.slogan || 'Pratos, bebidas, sobremesas e muito mais.'}`;
  const coverImage = org.coverUrl || org.logoUrl;

  return {
    title: title,
    description: description,
    openGraph: {
      title: title,
      description: description,
      url: `/${org.username}/cardapio`,
      siteName: 'Viby',
      images: coverImage ? [{ url: coverImage }] : [],
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: title,
        description: description,
        images: coverImage ? [coverImage] : [],
    },
    alternates: {
        canonical: `/${org.username}/cardapio`,
    },
  }
}

export default async function Page({ params }: { params: { username: string } }) {

    const org = await getOrganizationByUsername(params.username);

    if (!org) {
        notFound();
    }

    const { sections, items } = await getMenuByOrgId(org.id);

    return (
        <div className="bg-white min-h-screen flex flex-col">
            <PublicHeader />
            <main className="flex-grow">
               <ExclusivePublicMenu org={org} sections={sections} items={items} />
            </main>
            <Footer />
        </div>
    );
}
