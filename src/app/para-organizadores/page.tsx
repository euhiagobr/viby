import { permanentRedirect } from 'next/navigation';

/**
 * @fileOverview Redirecionador Permanente (301) para a rota canônica B2B.
 * Consolida autoridade de SEO na rota /anunciar.
 */
export default function ParaOrganizadoresRedirect() {
  permanentRedirect('/anunciar');
}
