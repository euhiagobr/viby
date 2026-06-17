
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
    console.log("--- [AI_FLOW_START] Geração de Capa ---");
    console.log("Input recebido:", JSON.stringify(input, null, 2));

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

    console.log("[AI_FLOW] Prompt construído:", promptText);

    try {
      /**
       * Erro detectado: Genkit ai.generate com 'openai/dall-e-3' está injetando 'response_format',
       * o que causa erro 400 na API da OpenAI para este modelo específico.
       * 
       * Solução: Utilizamos o cliente nativo da OpenAI (já presente no projeto) 
       * garantindo compatibilidade total com os parâmetros do DALL-E 3.
       */
      console.log("[AI_FLOW] Inicializando cliente OpenAI nativo para DALL-E 3...");
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      console.log("[AI_FLOW] Enviando requisição para images.generate...");
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: promptText,
        n: 1,
        size: "1792x1024", // Formato 16:9 horizontal conforme objetivo
        quality: "standard",
      });

      const url = response.data[0]?.url;

      if (!url) {
        console.error("[AI_FLOW_ERROR] Resposta da OpenAI não contém URL:", JSON.stringify(response, null, 2));
        throw new Error("A API de Imagem da OpenAI não retornou uma URL válida.");
      }

      console.log("[AI_FLOW_SUCCESS] URL gerada:", url);
      console.log("--- [AI_FLOW_END] ---");
      return url;
    } catch (error: any) {
      console.error("--- [AI_FLOW_EXCEPTION] ---");
      console.error("Mensagem:", error.message);
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", JSON.stringify(error.response.data, null, 2));
      } else {
        console.error("Error Object:", JSON.stringify(error, null, 2));
      }
      
      throw error;
    }
  }
);
