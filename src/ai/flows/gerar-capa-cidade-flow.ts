
'use server';
/**
 * @fileOverview Fluxo Genkit para geração de imagem de capa de cidades.
 * 
 * - gerarCapaCidade - Gera uma imagem premium da cidade via DALL-E 3.
 */

import { ai, z } from '@/ai/genkit';

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
    outputSchema: z.string().describe("URL da imagem gerada pela OpenAI (temporária)."),
  },
  async (input) => {
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

    console.log(`[AI Flow] Solicitando Geração de Imagem para: ${input.city}`);

    try {
      // Utilizamos a infraestrutura Genkit OpenAI já configurada
      // O identificador do modelo para o plugin genkitx-openai é 'openai/dall-e-3'
      const response = await ai.generate({
        model: 'openai/dall-e-3',
        prompt: promptText,
      });

      const url = response.media?.url;

      if (!url) {
        // Fallback: Se o plugin não retornar via media, tentamos extrair o erro ou retorno bruto
        throw new Error("A API de Imagem da OpenAI não retornou uma mídia válida. Verifique se o modelo 'dall-e-3' está disponível na sua conta.");
      }

      console.log(`[AI Flow SUCCESS] URL gerada com sucesso.`);
      return url;
    } catch (error: any) {
      console.error("[AI Flow EXCEPTION]", error.message);
      
      // Tratamento específico para erro de modelo inexistente
      if (error.message.includes('does not exist')) {
        throw new Error("Erro: O modelo 'dall-e-3' não foi localizado ou não está habilitado nesta chave de API da OpenAI.");
      }
      
      throw error;
    }
  }
);
