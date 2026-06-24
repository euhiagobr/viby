
/**
 * ARQUIVO DESATIVADO
 * Esta rota foi consolidada no arquivo principal /src/app/sitemap.ts.
 * Retornamos 410 (Gone) para informar aos crawlers que o recurso foi removido permanentemente 
 * em favor do sitemap gerado nativamente pelo Next.js.
 */
export async function GET() {
  return new Response(null, { status: 410 });
}
