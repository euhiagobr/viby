'use server';
/**
 * @fileOverview [DEPRECATED] Este fluxo foi substituído pela API Route /api/city-cover
 * para evitar timeouts de execução em Server Actions.
 */

import { z } from '@/ai/genkit';

const GerarCapaCidadeInputSchema = z.object({
  city: z.string(),
  state: z.string(),
  country: z.string(),
  topCategories: z.array(z.string())
});

export async function gerarCapaCidade(input: z.infer<typeof GerarCapaCidadeInputSchema>): Promise<string> {
  throw new Error("Este fluxo está depreciado. Utilize a API Route /api/city-cover.");
}
