
'use server';
/**
 * @fileOverview Fluxo Genkit para geração de campanhas de marketing utilizando dados reais da Viby.
 * Mapeado conforme auditoria de schema e configurado com GPT-5 Mini (gpt-4o-mini).
 */

import { ai, z } from '@/ai/genkit';
import { getAdminDb } from '@/lib/firebase/admin';

const GerarCampanhaEmailInputSchema = z.object({
  objetivo: z.string().describe("Objetivo da campanha (ex: reativar compradores inativos)."),
  publicoAlvo: z.string().describe("Descrição do segmento de público (auditado)."),
  tom: z.string().describe("Tom da comunicação (amigável, moderno, urgente)."),
  maxEventos: z.number().default(3).describe("Quantidade de eventos reais para recomendar.")
});

const GerarCampanhaEmailOutputSchema = z.object({
  subject: z.string().describe("Assunto do e-mail."),
  preheader: z.string().describe("Texto de pré-cabeçalho."),
  contentHtml: z.string().describe("Código HTML completo do corpo do e-mail."),
  selectedEventIds: z.array(z.string()).describe("IDs dos eventos reais selecionados pela IA."),
  reasoning: z.string().describe("Explicação da estratégia de recomendação utilizada.")
});

export async function gerarCampanhaEmail(input: z.infer<typeof GerarCampanhaEmailInputSchema>) {
  const db = getAdminDb();
  
  // 1. Consultar Base de Conhecimento Permanente da Marca
  const brandSnap = await db.collection('settings').doc('brand_knowledge').get();
  const brand = brandSnap.exists ? brandSnap.data() : null;
  
  // 2. Consultar Configurações de IA (Modelos)
  const aiConfigSnap = await db.collection('settings').doc('ai_config').get();
  const aiConfig = aiConfigSnap.exists ? aiConfigSnap.data() : { globalBasePrompt: "" };

  // 3. Consultar Eventos Reais (Mapeado via Auditoria)
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
      category: data.categoryName,
      city: data.city,
      interested: data.interestedCount || 0,
      sold: data.ingressosVendidos || 0,
      url: `https://viby.club/eventos/${data.slug || d.id}`
    };
  });

  const prompt = `
    Você é a IA oficial da Viby. Sua missão é gerar campanhas de Email Marketing de alta conversão.
    Utilize o modelo de linguagem configurado: ${aiConfig.modelCampaigns || "gpt-4o-mini"}.

    DIRETRIZES DA MARCA:
    - Nome: ${brand?.identity?.tradeName || "Viby"}
    - Slogan: ${brand?.identity?.slogan || ""}
    - Cores Oficiais: Primária ${brand?.visual?.primaryColor}, CTA ${brand?.visual?.ctaColor}
    - Links Oficiais: Site ${brand?.urls?.mainSite}

    CONTEXTO DA CAMPANHA:
    - Objetivo: ${input.objetivo}
    - Público-Alvo: ${input.publicoAlvo}
    - Tom de Voz Sugerido: ${input.tom}

    EVENTOS REAIS DISPONÍVEIS NA VIBY (SELECIONE OS MAIS RELEVANTES PARA ESTE PÚBLICO):
    ${JSON.stringify(eventsContext)}

    REQUISITOS TÉCNICOS:
    - O conteúdo HTML deve ser moderno, responsivo e limpo.
    - Utilize as cores da marca em botões e destaques.
    - É PROIBIDO inventar eventos, datas ou locais. Use apenas o contexto acima.
    - Se o público for de uma cidade específica, priorize eventos naquela cidade.
    - Retorne apenas dados finais processados. Não inclua tags de template como {{variable}}.
  `;

  const response = await ai.generate({
    prompt,
    output: { schema: GerarCampanhaEmailOutputSchema }
  });

  return {
    ...response.output,
    brandVersion: brand?.version || 0,
    timestamp: new Date().toISOString()
  };
}
