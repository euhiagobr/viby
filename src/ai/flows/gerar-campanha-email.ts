
'use server';
/**
 * @fileOverview Fluxo Genkit para geração inteligente de campanhas de e-mail marketing.
 * Utiliza o modelo configurado (GPT-4o Mini por padrão) e consome a base de conhecimento da marca.
 */

import { ai, z } from '@/ai/genkit';
import { getAdminDb } from '@/lib/firebase/admin';

const GerarCampanhaEmailInputSchema = z.object({
  objetivo: z.string().describe('Objetivo da campanha (ex: reativar compradores inativos).'),
  publicoAlvo: z.string().describe('Descrição do segmento de público.'),
  tom: z.string().describe('Tom da comunicação (profissional, amigável, urgente).'),
  maxEventos: z.number().default(3).describe('Quantidade máxima de eventos para destacar.')
});

const GerarCampanhaEmailOutputSchema = z.object({
  subject: z.string().describe('Assunto do e-mail impactante.'),
  preheader: z.string().describe('Texto de apoio que aparece na notificação.'),
  contentHtml: z.string().describe('Corpo do e-mail em HTML responsivo seguindo o design oficial.'),
  selectedEventIds: z.array(z.string()).describe('IDs dos eventos selecionados pela IA.'),
  brandVersion: z.number().describe('Versão da base de conhecimento da marca utilizada.')
});

export async function gerarCampanhaEmail(input: z.infer<typeof GerarCampanhaEmailInputSchema>) {
  return gerarCampanhaEmailFlow(input);
}

const gerarCampanhaEmailPrompt = ai.definePrompt({
  name: 'gerarCampanhaEmailPrompt',
  input: {
    schema: z.object({
      objetivo: z.string(),
      publicoAlvo: z.string(),
      tom: z.string(),
      maxEventos: z.number(),
      brand: z.any(),
      aiConfig: z.any(),
      eventsContext: z.array(z.any())
    })
  },
  output: { schema: GerarCampanhaEmailOutputSchema },
  prompt: `
{{aiConfig.globalBasePrompt}}

VOCÊ DEVE GERAR O CONTEÚDO FINAL. 
NUNCA INCLUA TAGS COMO {{{brand...}}} OU {{title}} NO SEU OUTPUT. 
SUBSTITUA TODOS OS PLACEHOLDERS PELOS VALORES REAIS ABAIXO.

IDENTIDADE DA MARCA:
Nome: {{brand.identity.tradeName}}
Slogan: {{brand.identity.slogan}}
Descrição: {{brand.identity.shortDescription}}

VISUAL E LOGO:
Cor Primária: {{brand.visual.primaryColor}}
Cor do CTA: {{brand.visual.ctaColor}}
Logo URL: {{brand.logos.main}}

CONTATOS REAIS (USAR APENAS ESTES):
Suporte: {{brand.contacts.emails.support}}
WhatsApp: {{brand.contacts.whatsapp.number}}
Instagram: {{brand.contacts.social.instagram}}
Site: {{brand.urls.mainSite}}

CONTEXTO DA CAMPANHA:
Objetivo: {{objetivo}}
Público: {{publicoAlvo}}
Tom: {{tom}}

EVENTOS DISPONÍVEIS (SELECIONE OS {{maxEventos}} MAIS RELEVANTES):
{{#each eventsContext}}
- ID: {{id}}, Título: {{title}}, Cidade: {{city}}, Preço: {{startingPrice}}, Link: {{url}}
{{/each}}

REQUISITOS DO OUTPUT:
1. "contentHtml" deve ser um HTML completo, responsivo e com os dados populados.
2. Use a logo da marca em <img src="{{brand.logos.main}}">.
3. Botões devem ter a cor {{brand.visual.ctaColor}}.
4. Inclua links reais dos eventos selecionados.
5. Retorne os "selectedEventIds" que você usou no HTML.
6. A "brandVersion" deve ser {{brand.version}}.
  `
});

const gerarCampanhaEmailFlow = ai.defineFlow(
  {
    name: 'gerarCampanhaEmailFlow',
    inputSchema: GerarCampanhaEmailInputSchema,
    outputSchema: GerarCampanhaEmailOutputSchema,
  },
  async (input) => {
    try {
      const db = getAdminDb();
      
      console.log("[SERVER-AI] Carregando Configurações e Base de Conhecimento...");
      
      const [aiConfigSnap, brandSnap] = await Promise.all([
        db.collection('settings').doc('ai_config').get(),
        db.collection('settings').doc('brand_knowledge').get()
      ]);

      if (!brandSnap.exists) {
        throw new Error("Base de conhecimento da marca não configurada.");
      }

      const aiConfig = aiConfigSnap.exists ? aiConfigSnap.data() : {
        globalBasePrompt: "Você é a IA oficial da Viby."
      };
      
      const brand = brandSnap.data()!;

      console.log("[SERVER-AI] Buscando eventos ativos...");
      const eventsSnap = await db.collection('events')
        .where('status', '==', 'Ativo')
        .orderBy('date', 'asc')
        .limit(20)
        .get();
      
      const eventsContext = eventsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          categoryName: data.categoryName || "Evento",
          city: data.city || "Brasil",
          startingPrice: data.startingPrice || 0,
          url: `https://viby.club/${data.organizer?.username || 'evento'}/${data.slug || d.id}`
        };
      });

      if (eventsContext.length === 0) {
        throw new Error("Não há eventos ativos para gerar a campanha.");
      }

      console.log(`[SERVER-AI] Chamando modelo de IA para geração final...`);

      const { output } = await gerarCampanhaEmailPrompt({
        ...input,
        brand,
        aiConfig,
        eventsContext
      });
      
      if (!output) {
        throw new Error("A IA falhou ao gerar o conteúdo.");
      }

      console.log("[SERVER-AI] Campanha gerada com sucesso.");
      return output;
    } catch (err: any) {
      console.error("[SERVER-AI-ERROR] Falha no fluxo:", err.message);
      throw err;
    }
  }
);
