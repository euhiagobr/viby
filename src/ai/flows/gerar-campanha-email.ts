
'use server';
/**
 * @fileOverview Fluxo Genkit para geração de campanhas de e-mail marketing.
 * Consome a Base de Conhecimento Permanente e dados reais da plataforma.
 */

import { ai, z } from '@/ai/genkit';
import { getAdminDb } from '@/lib/firebase/admin';

const GerarCampanhaEmailInputSchema = z.object({
  objetivo: z.string(),
  públicoBase: z.string(),
  filtros: z.any().optional(),
  tom: z.string().default('amigável'),
});

const GerarCampanhaEmailOutputSchema = z.object({
  subject: z.string(),
  preheader: z.string(),
  contentHtml: z.string(),
  selectedEventIds: z.array(z.string()),
  brandVersion: z.number()
});

export async function gerarCampanhaEmail(input: z.infer<typeof GerarCampanhaEmailInputSchema>) {
  const db = getAdminDb();
  
  // 1. Ler Base de Conhecimento da Marca
  const brandSnap = await db.collection('settings').doc('brand_knowledge').get();
  const brand = brandSnap.exists ? brandSnap.data() : null;
  
  // 2. Ler Configurações de IA
  const aiConfigSnap = await db.collection('settings').doc('ai_config').get();
  const aiConfig = aiConfigSnap.exists ? aiConfigSnap.data() : { globalBasePrompt: "" };

  // 3. Consultar Eventos Reais (Contexto)
  const eventsSnap = await db.collection('events')
    .where('status', '==', 'Ativo')
    .limit(10)
    .get();
  
  const eventsContext = eventsSnap.docs.map(d => ({
    id: d.id,
    title: d.data().title,
    description: d.data().description,
    city: d.data().city,
    url: `https://viby.club/eventos/${d.data().slug || d.id}`
  }));

  const prompt = `
    ${aiConfig.globalBasePrompt}

    DADOS DA MARCA:
    Nome: ${brand?.identity?.tradeName || "Viby"}
    Slogan: ${brand?.identity?.slogan || ""}
    Cores: Primária ${brand?.visual?.primaryColor}, CTA ${brand?.visual?.ctaColor}
    Links: ${brand?.urls?.mainSite}

    CONTEXTO DA CAMPANHA:
    Objetivo: ${input.objetivo}
    Público Alvo: ${input.públicoBase}
    Tom de Voz: ${input.tom}

    EVENTOS REAIS DISPONÍVEIS (SELECIONE OS MAIS RELEVANTES):
    ${JSON.stringify(eventsContext)}

    REQUISITOS:
    - Retorne um HTML responsivo e moderno.
    - Use as cores e logos oficiais.
    - O CTA deve ser impactante.
    - NÃO invente dados. Use apenas os eventos listados acima.
  `;

  const response = await ai.generate({
    prompt,
    output: { schema: GerarCampanhaEmailOutputSchema }
  });

  return {
    ...response.output,
    brandVersion: brand?.version || 0
  };
}
