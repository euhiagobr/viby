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
      ? `Incorporar sutilmente a energia das seguintes categorias populares: ${input.topCategories.join(", ")}.` 
      : "manter foco geral em turismo e vida urbana.";

    const promptText = `Crie uma imagem fotorealista premium em formato de banner horizontal representando a cidade de ${input.city}, ${input.state}, ${input.country}.

A imagem deve ser usada como capa oficial de uma plataforma de eventos e experiências chamada Viby.

FOCO PRINCIPAL
Representar visualmente o que fazer na cidade através de:
* cultura local
* turismo urbano
* vida noturna (se aplicável)
* eventos e experiências
* arquitetura e pontos icônicos reais da cidade

COMPOSIÇÃO VISUAL
* Estilo fotorealista ultra detalhado
* Iluminação cinematográfica natural (golden hour ou blue hour)
* Profundidade de campo suave
* Atmosfera vibrante e moderna
* Sensação de cidade viva e ativa
* Estética de capa de portal global de eventos e turismo

ELEMENTOS DA CIDADE
Incluir referências visuais reais e reconhecíveis de ${input.city} quando possível, como:
* skyline
* pontos turísticos
* áreas culturais
* regiões urbanas icônicas
* paisagens naturais próximas

CATEGORIAS DE EVENTOS (INFLUÊNCIA VISUAL)
${categoriesText}

IDENTIDADE VIBY
Integrar de forma extremamente sutil:
* sensação de plataforma moderna de eventos
* lifestyle urbano contemporâneo
* não incluir logos visíveis
* não incluir textos
* não incluir marcas d’água

RESTRIÇÕES ABSOLUTAS
* NÃO adicionar texto
* NÃO adicionar logotipos
* NÃO adicionar QR codes
* NÃO adicionar preços
* NÃO adicionar datas
* NÃO adicionar banners promocionais
* NÃO adicionar elementos políticos
* NÃO adicionar conteúdo ofensivo
* NÃO estilizar como propaganda explícita

FORMATO OBRIGATÓRIO
* 1536x1024 (horizontal)
* estilo editorial premium
* qualidade publicitária global`;

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

      console.log('[CITY COVER] CHAMANDO OPENAI');
      const response = await openai.images.generate({
        model: model,
        prompt: promptText,
        size: "1536x1024",
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