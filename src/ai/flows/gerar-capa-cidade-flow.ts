
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

    const prompt = `Crie uma imagem fotorealista premium representando a cidade de ${input.city}, ${input.state}, ${input.country}.
    
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

    // Utilizando a API da OpenAI diretamente via fetch para garantir compatibilidade com DALL-E 3
    // reusando a chave configurada no Genkit.
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1792x1024", // Formato aproximado 16:9
        quality: "hd",
        style: "vivid"
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`OpenAI Image Error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].url;
  }
);
