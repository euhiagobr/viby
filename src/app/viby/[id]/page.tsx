
import { redirect } from 'next/navigation';

/**
 * @fileOverview Redirecionador de rotas dinâmicas obsoletas.
 * Conforme o objetivo, não existem mais media kits por organização, apenas o oficial da Viby em /viby/marca.
 */
export default async function BrandAssetsLegacyRedirect() {
  redirect('/viby/marca');
}
