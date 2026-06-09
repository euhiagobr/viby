import { redirect } from 'next/navigation';

/**
 * @fileOverview Rota de legado. Redireciona para o handler unificado em [slug]/page.tsx.
 * O Next.js tratará [id] e [slug] como a mesma rota se estiverem no mesmo nível.
 * Mantemos este arquivo apenas para garantir o redirecionamento se o Next.js resolver este caminho primeiro.
 */
export default async function EventoLegacyIdPage({ params }: { params: Promise<{ username: string, id: string }> }) {
  const { username, id } = await params;
  // Simplesmente passa para a rota unificada que já lida com IDs e Slugs
  redirect(`/${username}/${id}`);
}
