
'use server';
/**
 * @fileOverview Fluxo Genkit para geração de imagem de capa de cidades.
 * 
 * - gerarCapaCidade - Gera uma imagem premium da cidade via OpenAI DALL-E 3.
 */

import { ai, z } from '@/ai/genkit';
import OpenAI from 'openai';

const GerarCapaCidadeInputSchema = z.object({
  city: z.string().describe("Nome da cidade."),
  state: z.string().describe("Estado ou UF."),
  country: z.string().describe("País."),
  topCategories: z.array(z.string()).describe("Categorias de eventos mais populares na cidade.")
});

export async function gerarCapaCidade(input: z.infer<typeof GerarCapaCidadeInputSchema>): Promise<string> {
  return gerarCapaCidadeFlow(input);
}

const gerarCapaCidadeFlow = ai.defineFlow(
  {
    name: 'gerarCapaCidadeFlow',
    inputSchema: GerarCapaCidadeInputSchema,
    outputSchema: z.string().describe("URL da imagem gerada pela OpenAI."),
  },
  async (input) => {
    // AUDITORIA OBRIGATÓRIA
    console.log('OPENAI_PROVIDER_ENCONTRADO');
    console.log('ARQUIVO: src/ai/flows/gerar-capa-cidade-flow.ts');
    console.log('FUNÇÃO: gerarCapaCidadeFlow');
    console.log('MODELO_UTILIZADO: dall-e-3');

    console.log('[CITY_COVER] Provider: OpenAI SDK');
    console.log('[CITY_COVER] Modelo: dall-e-3');

    const categoriesText = input.topCategories.length > 0 
      ? `Considere as categorias mais populares de eventos atualmente cadastradas: ${input.topCategories.join(", ")}.` 
      : "";

    const promptText = `Crie uma imagem fotorealista premium representando a cidade de ${input.city}, ${input.state}, ${input.country}.
    
    A imagem deve transmitir turismo, cultura, entretenimento, experiências e eventos acontecendo na cidade.
    Utilize elements reais e reconhecíveis da cidade quando existirem.
    ${categoriesText}
    
    Diretrizes visuais:
    - Fotorealista
    - Alta qualidade
    - Estilo editorial profissional
    - Iluminação cinematográfica
    - Composição moderna
    - Visual atrativo para turismo e entretenimento
    - Profundidade de campo natural
    - Atmosfera vibrante
    - Qualidade de capa de portal de eventos
    
    Marca Viby:
    - Integrar discretamente a identidade visual da Viby
    - Não exibir logotipos gigantes
    - Não transformar a imagem em propaganda
    - Aparição elegante e natural
    
    Restrições:
    - Não adicionar textos
    - Não adicionar marcas d'água
    - Não adicionar QR Codes
    - Não adicionar banners promocionais
    - Não adicionar preços
    - Não adicionar datas
    - Não adicionar elementos políticos
    - Não adicionar conteúdo ofensivo`;

    console.log('[CITY_COVER] Enviando prompt');

    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: promptText,
        n: 1,
        size: "1792x1024", 
      });

      console.log('[CITY_COVER] Resposta recebida');
      const url = response.data[0]?.url;

      if (!url) {
        throw new Error("A API de Imagem da OpenAI não retornou uma URL válida.");
      }

      return url;
    } catch (error: any) {
      console.error('[CITY_COVER] Erro:', error);
      throw error;
    }
  }
);
