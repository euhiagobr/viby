import { redirect } from 'next/navigation';

/**
 * @fileOverview Compatibilidade Retroativa.
 * Redireciona permanentemente URLs antigas /[username]/[slug] para /eventos/[slug].
 */
export default async function EventRedirectPage({ params }: { params: Promise<{ username: string, slug: string }> }) {
  const { slug } = await params;
  
  // Redirecionamento 301 para a nova estrutura unificada
  redirect(`/eventos/${slug}`);
}
