
import { redirect } from 'next/navigation';

/**
 * @fileOverview Redirecionador para a rota canônica B2B.
 * Consolida autoridade de SEO na rota /anunciar.
 */
export default function ParaOrganizadoresRedirect() {
  redirect('/anunciar');
}
