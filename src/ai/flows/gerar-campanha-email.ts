
'use server';
/**
 * @fileOverview Fluxo Genkit para geração de campanhas de marketing utilizando dados reais da Viby.
 * 
 * - gerarCampanhaEmail: Função principal que coordena a consulta de dados e chamada à IA.
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

const CampaignPromptInputSchema = z.object({
  input: GerarCampanhaEmailInputSchema,
  brand: z.any(),
  events: z.array(z.any())
});

/**
 * Definição do Prompt em nível de módulo para registro correto no Genkit.
 */
const generateCampaignPrompt = ai.definePrompt({
  name: 'generateCampaignPrompt',
  input: { schema: CampaignPromptInputSchema },
  output: { schema: GerarCampanhaEmailOutputSchema },
  prompt: `Você é a IA oficial da Viby. Sua missão é gerar campanhas de Email Marketing de alta conversão.

    DIRETRIZES DA MARCA:
    - Nome: {{brand.identity.tradeName}}
    - Slogan: {{brand.identity.slogan}}
    - Cores: Primária {{brand.visual.primaryColor}}, CTA {{brand.visual.ctaColor}}
    - Links: Site {{brand.urls.mainSite}}

    CONTEXTO DA CAMPANHA:
    - Objetivo: {{input.objetivo}}
    - Público-Alvo: {{input.publicoAlvo}}
    - Tom Sugerido: {{input.tom}}

    EVENTOS REAIS DISPONÍVEIS (SELECIONE OS MAIS RELEVANTES):
    {{#each events}}
    - {{title}} ({{city}}): Categoria {{categoryName}}, {{interestedCount}} interessados, Preço a partir de R$ {{startingPrice}}. ID: {{id}}
    {{/each}}

    REQUISITOS TÉCNICOS:
    - Retorne apenas o objeto JSON conforme o esquema de saída.
    - O campo contentHtml deve ser um template moderno, responsivo e utilizar as cores da marca em botões.
    - É PROIBIDO retornar o HTML com tags de placeholder ou chaves duplas. O usuário deve ver o dado final.
    - Utilize os nomes e URLs reais dos eventos fornecidos.
    - Não inclua blocos de código markdown ou explicações fora do JSON.`
});

/**
 * Fluxo de geração de campanha.
 */
const generateCampaignFlow = ai.defineFlow(
  {
    name: 'generateCampaignFlow',
    inputSchema: GerarCampanhaEmailInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    const db = getAdminDb();
    
    // 1. Consultar Base de Conhecimento Permanente da Marca
    const brandSnap = await db.collection('settings').doc('brand_knowledge').get();
    const brand = brandSnap.exists ? brandSnap.data() : { 
      identity: { tradeName: "Viby", slogan: "Viva o agora" },
      visual: { primaryColor: "#000000", ctaColor: "#2C52EE" },
      urls: { mainSite: "https://viby.club" },
      version: 0
    };
    
    // 2. Consultar Configurações de IA (Modelos)
    const aiConfigSnap = await db.collection('settings').doc('ai_config').get();
    const aiConfig = aiConfigSnap.exists ? aiConfigSnap.data() : { modelCampaigns: "openai/gpt-4o-mini" };

    // 3. Consultar Eventos Ativos
    // Nota: Removido orderBy ingressosVendidos para evitar erro de índice ausente no Firestore.
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .limit(20)
      .get();
    
    const eventsContext = eventsSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        categoryName: data.categoryName || "Geral",
        city: data.city || "Brasil",
        interestedCount: data.interestedCount || 0,
        ingressosVendidos: data.ingressosVendidos || 0,
        startingPrice: data.startingPrice || 0,
        url: `https://viby.club/eventos/${data.slug || d.id}`
      };
    });

    // 4. Chamar a IA com o modelo configurado ou fallback estável
    const { output } = await generateCampaignPrompt({
      input,
      brand,
      events: eventsContext
    }, {
      model: aiConfig.modelCampaigns || "openai/gpt-4o-mini"
    });

    if (!output) {
      throw new Error("Falha na geração de conteúdo pela IA.");
    }

    return {
      ...output,
      brandVersion: brand?.version || 0,
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Função exportada para ser chamada pelas Server Actions do Next.js.
 */
export async function gerarCampanhaEmail(input: z.infer<typeof GerarCampanhaEmailInputSchema>) {
  return generateCampaignFlow(input);
}
