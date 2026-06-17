'use server';
/**
 * @fileOverview [DEPRECATED] Este fluxo foi substituído pela API Route /api/city-cover
 * para evitar timeouts de execução em Server Actions e Genkit.
 */

export async function gerarCapaCidade(): Promise<string> {
  throw new Error("Este fluxo está depreciado. Utilize a API Route /api/city-cover.");
}
