'use server';
/**
 * @fileOverview Fluxo Genkit para geração de campanhas de marketing utilizando dados reais da Viby.
 * Mapeado conforme auditoria de schema e configurado com GPT-4o-Mini por padrão.
 */

import { ai, z } from '@/ai/genkit';
import { getAdminDb } from '@/lib/firebase/admin';

const GerarCampanhaEmailInputSchema = z.object({
  objetivo: z.string().describe("Objetivo da campanha (ex: reativar compradores inativos)."),
  publicoAlvo: z.string().describe("Descrição do segmento de público selecionado."),
  tom: z.string().describe("Tom da comunicação (profissional, amigável, urgente)."),
  maxEventos: z.number().default(3).describe("Quantidade máxima de eventos para destacar.")
});

const GerarCampanhaEmailOutputSchema = z.object({
  subject: z.string().describe("Assunto do e-mail."),
  preheader: z.string().describe("Texto de pré-cabeçalho."),
  contentHtml: z.string().describe("Código HTML completo do corpo do e-mail (usando as cores da marca)."),
  selectedEventIds: z.array(z.string()).describe("IDs dos eventos reais selecionados pela IA."),
  reasoning: z.string().describe("Explicação da estratégia utilizada.")
});

export async function gerarCampanhaEmail(input: z.infer<typeof GerarCampanhaEmailInputSchema>) {
  const db = getAdminDb();
  
  // 1. Consultar Base de Conhecimento Permanente da Marca
  const brandSnap = await db.collection('settings').doc('brand_knowledge').get();
  const brand = brandSnap.exists ? brandSnap.data() : null;
  
  // 2. Consultar Configurações de IA (Modelos)
  const aiConfigSnap = await db.collection('settings').doc('ai_config').get();
  const aiConfig = aiConfigSnap.exists ? aiConfigSnap.data() : { modelCampaigns: "openai/gpt-4o-mini" };

  // 3. Consultar Eventos Reais com Métricas da Auditoria
  const eventsSnap = await db.collection('events')
    .where('status', '==', 'Ativo')
    .orderBy('ingressosVendidos', 'desc')
    .limit(15)
    .get();
  
  const eventsContext = eventsSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      title: data.title,
      description: data.description,
      categoryName: data.categoryName,
      city: data.city,
      interestedCount: data.interestedCount || 0,
      ingressosVendidos: data.ingressosVendidos || 0,
      startingPrice: data.startingPrice || 0,
      url: `https://viby.club/eventos/${data.slug || d.id}`
    };
  });

  const generatePrompt = ai.definePrompt({
    name: 'generateCampaignPrompt',
    input: { schema: z.object({
      input: GerarCampanhaEmailInputSchema,
      brand: z.any(),
      events: z.any()
    }) },
    output: { schema: GerarCampanhaEmailOutputSchema },
    prompt: `Você é a IA oficial da Viby. Sua missão é gerar campanhas de Email Marketing de alta conversão.

    DIRETRIZES DA MARCA:
    - Nome: {{{brand.identity.tradeName}}}
    - Slogan: {{{brand.identity.slogan}}}
    - Cores: Primária {{{brand.visual.primaryColor}}}, CTA {{{brand.visual.ctaColor}}}
    - Links: Site {{{brand.urls.mainSite}}}

    CONTEXTO DA CAMPANHA:
    - Objetivo: {{{input.objetivo}}}
    - Público-Alvo: {{{input.publicoAlvo}}}
    - Tom Sugerido: {{{input.tom}}}

    EVENTOS REAIS (SELECIONE OS MAIS RELEVANTES):
    {{#each events}}
    - {{{title}}} ({{{city}}}): Categoria {{{categoryName}}}, {{{interestedCount}}} interessados, Preço a partir de R$ {{{startingPrice}}}. ID: {{{id}}}
    {{/each}}

    REQUISITOS TÉCNICOS:
    - Retorne apenas o objeto JSON conforme o esquema de saída.
    - O campo contentHtml deve ser um template moderno, responsivo e utilizar as cores da marca em botões.
    - Substitua todas as tags de placeholder (como \\{\\{brand...\\}\\}) por valores reais agora.
    - É PROIBIDO retornar o HTML com tags de template. O usuário deve ver o dado final.
    - Utilize os nomes e URLs reais dos eventos fornecidos.
    - Não inclua blocos de código markdown ou explicações fora do JSON.`
  });

  const response = await generatePrompt({
    input,
    brand,
    events: eventsContext
  }, {
    model: aiConfig.modelCampaigns || "openai/gpt-4o-mini"
  });

  return {
    ...response.output,
    brandVersion: brand?.version || 0,
    timestamp: new Date().toISOString()
  };
}
