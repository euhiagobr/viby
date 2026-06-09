/**
 * @fileOverview ROTA DESATIVADA PARA ELIMINAR CONFLITO DE ROUTE MANIFEST.
 * O Next.js não permite nomes de parâmetros dinâmicos divergentes no mesmo nível.
 * Toda a lógica foi movida para src/app/[username]/[event]/page.tsx
 */
export const dynamic = 'force-static';
export default function InactivePage() { return null; }
