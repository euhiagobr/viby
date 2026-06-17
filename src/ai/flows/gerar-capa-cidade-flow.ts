'use server';
/**
 * @fileOverview Fluxo Genkit para geração de imagem de capa de cidades.
 * 
 * - gerarCapaCidade - Gera uma imagem premium da cidade via OpenAI gpt-image-1.
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
    console.log('[CITY COVER] FLOW INICIADO');
    console.log('[CITY COVER] PARAMS', input);

    const categoriesText = input.topCategories.length > 0 
      ? `Considere as categorias mais populares de eventos atualmente cadastradas: ${input.topCategories.join(", ")}.` 
      : "";

    const promptText = `Crie uma imagem fotorealista premium representando a cidade de ${input.city}, ${input.state}, ${input.country}.
    
    A imagem deve transmitir turismo, cultura, entretenimento, experiências e eventos acontecendo na cidade.
    Utilize elementos reais e reconhecíveis da cidade quando existirem.
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

    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY não configurada no ambiente.");
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        organization: process.env.OPENAI_ORGANIZATION,
        project: process.env.OPENAI_PROJECT_ID,
      });

      const model = "gpt-image-1";

      // LOGS DE AUDITORIA OPENAI
      console.log('[OPENAI] MODELO CONFIGURADO:', model);
      console.log('[OPENAI] CLIENTE:', openai);
      console.log('[OPENAI] ORGANIZATION:', process.env.OPENAI_ORGANIZATION);
      console.log('[OPENAI] PROJECT:', process.env.OPENAI_PROJECT_ID);

      console.log('[CITY COVER] CHAMANDO OPENAI');
      const response = await openai.images.generate({
        model: model,
        prompt: promptText,
        size: "1792x1024",
      });

      console.log('[CITY COVER] OPENAI RESPONDEU');
      const url = response.data[0]?.url;

      if (!url) {
        throw new Error("A API de Imagem da OpenAI não retornou uma URL válida.");
      }

      return url;
    } catch (error: any) {
      console.error('[CITY COVER ERROR]', error);
      throw error;
    }
  }
);