import { permanentRedirect } from 'next/navigation';

/**
 * @fileOverview Redirecionador Permanente (301) para a rota canônica de diversidade.
 * Consolida autoridade de SEO na rota /experiencias-lgbtqiapn.
 */
export default function LgbtRedirect() {
  permanentRedirect('/experiencias-lgbtqiapn');
}
