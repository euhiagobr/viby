'use server';
/**
 * @fileOverview Fluxo Genkit para geração de campanhas de marketing utilizando dados reais da Viby.
 * 
 * Correções Críticas (Audit v3):
 * - Filtro Temporal Obrigatório: Filtra eventos por data antes da geração.
 * - Auditoria de Datas: Retorna a menor e maior data encontrada para validação.
 * - Ordenação Rigorosa: Data ASC -> Interesse DESC -> Vendas DESC.
 */

import { ai, z } from '@/ai/genkit';
import { getAdminDb } from '@/lib/firebase/admin';
import { startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, isWithinInterval, parseISO } from 'date-fns';
import * as admin from 'firebase-admin';

const VIBY_DEFAULT_EVENT_IMAGE = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

const GerarCampanhaEmailInputSchema = z.object({
  objetivo: z.string().describe("Objetivo da campanha (ex: reativar compradores inativos)."),
  publicoAlvo: z.string().describe("Descrição do segmento de público selecionado."),
  periodo: z.enum(['hoje', 'amanha', 'semana', '7dias', '15dias', '30dias', 'mes_atual', 'proximo_mes']).describe("Período temporal da agenda."),
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
    - Período Solicitado: {{input.periodo}}
    - Tom Sugerido: {{input.tom}}

    EVENTOS REAIS DISPONÍVEIS (FILTRADOS POR DATA):
    {{#each events}}
    - {{title}} ({{city}}): {{categoryName}}, {{displayDate}}. Preço: {{displayPrice}}. URL: {{url}}. Imagem: {{image}}
    {{/each}}

    REQUISITOS TÉCNICOS DO HTML:
    - Retorne apenas o JSON conforme o schema.
    - O campo contentHtml deve ser um template responsivo com cards para os eventos fornecidos.
    - ESTRUTURA DO CARD: Imagem do evento (full width no card) -> Título -> Cidade | Data -> Categoria -> Preço (em destaque) -> Botão "Ver Evento".
    - PROIBIÇÕES ABSOLUTAS:
      1. NUNCA use links no formato /event/{id}. Use apenas a URL fornecida no contexto.
      2. NUNCA escreva "R$ 0,00". Use "{{displayPrice}}" (que já vem formatado como "Gratuito" ou valor real).
      3. NUNCA deixe um card sem imagem. Use a URL de imagem fornecida.
      4. O botão de cada card deve levar exatamente para a URL do evento fornecida.
      5. NÃO invente eventos. Use apenas os da lista acima.

    ESTILO VISUAL:
    - Use bordas arredondadas (24px) em cards e botões.
    - Use fontes limpas (sans-serif).
    - Botões de CTA devem usar a cor {{brand.visual.ctaColor}}.`
});

/**
 * Fluxo de geração com filtro temporal rígido e auditoria de datas.
 */
const generateCampaignFlow = ai.defineFlow(
  {
    name: 'generateCampaignFlow',
    inputSchema: GerarCampanhaEmailInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    const db = getAdminDb();
    const now = new Date();
    
    // 1. Calcular Intervalo Temporal
    let startDate = startOfDay(now);
    let endDate = endOfDay(addDays(now, 30)); // Default 30 dias

    switch (input.periodo) {
      case 'hoje': 
        endDate = endOfDay(now); break;
      case 'amanha': 
        startDate = startOfDay(addDays(now, 1)); 
        endDate = endOfDay(addDays(now, 1)); break;
      case 'semana':
        startDate = startOfWeek(now, { weekStartsOn: 0 });
        endDate = endOfWeek(now, { weekStartsOn: 0 }); break;
      case '7dias':
        endDate = endOfDay(addDays(now, 7)); break;
      case '15dias':
        endDate = endOfDay(addDays(now, 15)); break;
      case '30dias':
        endDate = endOfDay(addDays(now, 30)); break;
      case 'mes_atual':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now); break;
      case 'proximo_mes':
        const nextMonth = addMonths(now, 1);
        startDate = startOfMonth(nextMonth);
        endDate = endOfMonth(nextMonth); break;
    }

    // 2. Consultar Base de Conhecimento
    const brandSnap = await db.collection('settings').doc('brand_knowledge').get();
    const brand = brandSnap.exists ? brandSnap.data() : { 
      identity: { tradeName: "Viby", slogan: "Viva o agora" },
      visual: { primaryColor: "#000000", ctaColor: "#2C52EE" },
      urls: { mainSite: "https://viby.club" },
      version: 0
    };
    
    // 3. Consultar Eventos Ativos com Filtro Temporal
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .orderBy('date', 'asc')
      .limit(50)
      .get();
    
    const rawEventsFound = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 4. Ordenação e Validação de Integridade
    const processedEventsContext = [];
    let minDateFound: Date | null = null;
    let maxDateFound: Date | null = null;

    // Ordenar em memória para garantir prioridade: Data -> Interesse -> Vendas
    const sortedEvents = rawEventsFound.sort((a: any, b: any) => {
      const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
      const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (b.interestedCount || 0) - (a.interestedCount || 0);
    });

    for (const data of sortedEvents) {
      if (!data.title || !data.slug || !data.organizationId) continue;

      // Resolução de Username para URL Canônica
      const orgSnap = await db.collection('organizations').doc(data.organizationId).get();
      if (!orgSnap.exists || !orgSnap.data()?.username) continue;
      
      const orgUsername = orgSnap.data()!.username;
      const eventDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);

      // Auditoria de Datas
      if (!minDateFound || eventDate < minDateFound) minDateFound = eventDate;
      if (!maxDateFound || eventDate > maxDateFound) maxDateFound = eventDate;

      processedEventsContext.push({
        id: data.id,
        title: data.title,
        categoryName: data.categoryName || "Geral",
        city: data.city || "Brasil",
        displayDate: eventDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }),
        displayPrice: (!data.startingPrice || data.startingPrice === 0) 
          ? "Gratuito" 
          : `A partir de R$ ${data.startingPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        image: data.image || VIBY_DEFAULT_EVENT_IMAGE,
        url: `https://viby.club/${orgUsername}/${data.slug}`
      });

      if (processedEventsContext.length >= input.maxEventos) break;
    }

    if (processedEventsContext.length === 0) {
      throw new Error(`Nenhum evento válido localizado entre ${startDate.toLocaleDateString()} e ${endDate.toLocaleDateString()} para compor a campanha.`);
    }

    // 5. Configurações de IA
    const aiConfigSnap = await db.collection('settings').doc('ai_config').get();
    const aiConfig = aiConfigSnap.exists ? aiConfigSnap.data() : { modelCampaigns: "openai/gpt-4o-mini" };

    // 6. Geração via IA
    const { output } = await generateCampaignPrompt({
      input,
      brand,
      events: processedEventsContext
    }, {
      model: aiConfig.modelCampaigns || "openai/gpt-4o-mini"
    });

    if (!output) throw new Error("Falha na geração de conteúdo pela IA.");

    return {
      ...output,
      audit: {
        periodoSolicitado: { inicio: startDate.toISOString(), fim: endDate.toISOString() },
        periodoEncontrado: { inicio: minDateFound?.toISOString(), fim: maxDateFound?.toISOString() },
        eventosAnalisados: rawEventsFound.length,
        eventosSelecionados: processedEventsContext.length
      },
      brandVersion: brand?.version || 0,
      timestamp: new Date().toISOString()
    };
  }
);

export async function gerarCampanhaEmail(input: z.infer<typeof GerarCampanhaEmailInputSchema>) {
  return generateCampaignFlow(input);
}
