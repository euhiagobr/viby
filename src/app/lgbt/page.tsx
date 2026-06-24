
import { redirect } from 'next/navigation';

/**
 * @fileOverview Redirecionador para a rota canônica de diversidade.
 * Evita conteúdo duplicado entre /lgbt e /experiencias-lgbtqiapn.
 */
export default function LgbtRedirect() {
  redirect('/experiencias-lgbtqiapn');
}
