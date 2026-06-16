'use server';
/**
 * @fileOverview Fluxo Genkit para geração de campanhas de marketing utilizando dados reais da Viby.
 * 
 * Correções Críticas (Audit v2):
 * - URLs Canônicas: https://viby.club/{username}/{slug}
 * - Preços Inteligentes: "Gratuito" ou "A partir de R$ XX,XX"
 * - Fallback de Imagem Institucional
 * - Validação rigorosa de integridade de dados (Slug e Username obrigatórios)
 */

import { ai, z } from '@/ai/genkit';
import { getAdminDb } from '@/lib/firebase/admin';

const VIBY_DEFAULT_EVENT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

const GerarCampanhaEmailInputSchema = z.object({
  objetivo: z.string().describe("Objetivo da campanha (ex: reativar compradores inativos)."),
  publicoAlvo: z.string().describe("Descrição do segmento de público selecionado."),
  tom: z.string().describe("Tom da comunicação (profissional, amigável, urgente)."),
  maxEventos: z.number().default(3).describe("Quantidade máxima de eventos para destacar.")
});

const GerarCampanhaEmailOutputSchema = z.object({
  subject: z.string().describe("Assunto do e-mail."),
  preheader: z.string().describe("Texto de pré-cabeçalho."),
  contentHtml: z.string().describe("Código HTML completo do corpo do e-mail."),
  selectedEventIds: z.array(z.string()).describe("IDs dos eventos reais selecionados pela IA."),
  reasoning: z.string().describe("Explicação da estratégia utilizada.")
});

const CampaignPromptInputSchema = z.object({
  input: GerarCampanhaEmailInputSchema,
  brand: z.any(),
  events: z.array(z.object({
    id: z.string(),
    title: z.string(),
    categoryName: z.string(),
    city: z.string(),
    displayDate: z.string(),
    displayPrice: z.string(),
    image: z.string(),
    url: z.string()
  }))
});

/**
 * Prompt mestre com estrutura de card profissional e regras de integridade.
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

    EVENTOS REAIS DISPONÍVEIS:
    {{#each events}}
    - {{title}} ({{city}}): {{categoryName}}, {{displayDate}}. Preço: {{displayPrice}}. URL: {{url}}. Imagem: {{image}}
    {{/each}}

    REQUISITOS TÉCNICOS DO HTML:
    - Retorne apenas o JSON.
    - O campo contentHtml deve ser um template responsivo com cards para os eventos.
    - ESTRUTURA DO CARD: Imagem do evento (full width no card) -> Título -> Cidade | Data -> Categoria -> Preço (em destaque) -> Botão "Ver Evento".
    - PROIBIÇÕES ABSOLUTAS:
      1. Nunca usar links no formato /event/{id}. Use apenas a URL fornecida no contexto.
      2. Nunca escrever "R$ 0,00". Use "{{displayPrice}}" (que já vem formatado como "Gratuito" ou valor real).
      3. Nunca deixar um card sem imagem. Use a URL de imagem fornecida.
      4. O botão de cada card deve levar exatamente para a URL do evento fornecida.

    ESTILO VISUAL:
    - Use bordas arredondadas (24px) em cards e botões.
    - Use fontes limpas (sans-serif).
    - Botões de CTA devem usar a cor {{brand.visual.ctaColor}}.`
});

/**
 * Fluxo de geração com validação de integridade (Username + Slug).
 */
const generateCampaignFlow = ai.defineFlow(
  {
    name: 'generateCampaignFlow',
    inputSchema: GerarCampanhaEmailInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    const db = getAdminDb();
    
    // 1. Consultar Base de Conhecimento
    const brandSnap = await db.collection('settings').doc('brand_knowledge').get();
    const brand = brandSnap.exists ? brandSnap.data() : { 
      identity: { tradeName: "Viby", slogan: "Viva o agora" },
      visual: { primaryColor: "#000000", ctaColor: "#2C52EE" },
      urls: { mainSite: "https://viby.club" },
      version: 0
    };
    
    // 2. Configurações de IA
    const aiConfigSnap = await db.collection('settings').doc('ai_config').get();
    const aiConfig = aiConfigSnap.exists ? aiConfigSnap.data() : { modelCampaigns: "openai/gpt-4o-mini" };

    // 3. Consultar Eventos Ativos com Validação Canônica
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .limit(30)
      .get();
    
    const eventsContext = [];
    
    for (const d of eventsSnap.docs) {
      const data = d.data();
      
      // Validação de Integridade (Problema 6)
      if (!data.title || !data.slug || !data.organizationId) {
        console.error(`[CRM-AI-AUDIT] Evento ${d.id} ignorado: Dados estruturais ausentes.`);
        continue;
      }

      // Resolução de Username para URL Canônica (Problema 1)
      const orgSnap = await db.collection('organizations').doc(data.organizationId).get();
      if (!orgSnap.exists || !orgSnap.data()?.username) {
        console.error(`[CRM-AI-AUDIT] Evento ${d.id} ignorado: Username da organização não localizado.`);
        continue;
      }
      
      const orgUsername = orgSnap.data()!.username;

      // Lógica de Preço (Problema 2)
      const displayPrice = (!data.startingPrice || data.startingPrice === 0) 
        ? "Gratuito" 
        : `A partir de R$ ${data.startingPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

      // Fallback de Imagem (Problema 3)
      const image = data.image || VIBY_DEFAULT_EVENT_IMAGE;

      eventsContext.push({
        id: d.id,
        title: data.title,
        categoryName: data.categoryName || "Geral",
        city: data.city || "Brasil",
        displayDate: data.date?.toDate ? data.date.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : "Confirmar data",
        displayPrice,
        image,
        url: `https://viby.club/${orgUsername}/${data.slug}`
      });

      if (eventsContext.length >= input.maxEventos) break;
    }

    if (eventsContext.length === 0) {
      throw new Error("Nenhum evento válido localizado para compor a campanha.");
    }

    // 4. Geração via IA
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

export async function gerarCampanhaEmail(input: z.infer<typeof GerarCampanhaEmailInputSchema>) {
  return generateCampaignFlow(input);
}
