
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

const gerarCampanhaEmailFlow = ai.defineFlow(
  {
    name: 'gerarCampanhaEmailFlow',
    inputSchema: GerarCampanhaEmailInputSchema,
    outputSchema: GerarCampanhaEmailOutputSchema,
  },
  async (input) => {
    try {
      const db = getAdminDb();
      
      console.log("[SERVER-AI] Carregando Configurações e Base de Conhecimento da Marca...");
      
      const [aiConfigSnap, brandSnap] = await Promise.all([
        db.collection('settings').doc('ai_config').get(),
        db.collection('settings').doc('brand_knowledge').get()
      ]);

      if (!brandSnap.exists) {
        throw new Error("Base de conhecimento da marca não configurada. Por favor, preencha as informações em /admin/crm/ia/marca.");
      }

      const aiConfig = aiConfigSnap.exists ? aiConfigSnap.data() : {
        modelCampaigns: 'openai/gpt-4o-mini',
        globalBasePrompt: "Você é a IA oficial da Viby."
      };
      
      const brand = brandSnap.data()!;

      // Validação de dados obrigatórios conforme regra de Fallback
      if (!brand.logos?.main || !brand.visual?.primaryColor || !brand.contacts?.emails?.support) {
        throw new Error("Dados obrigatórios da marca ausentes (Logo, Cor ou Email Suporte). Geração bloqueada.");
      }

      const modelId = aiConfig.modelCampaigns || 'openai/gpt-4o-mini';

      console.log("[SERVER-AI] Buscando eventos reais para contexto...");
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
        throw new Error("Não há eventos ativos na plataforma para gerar a campanha.");
      }

      console.log(`[SERVER-AI] Chamando ${modelId} com Identidade da Marca v${brand.version}...`);

      const response = await ai.generate({
        model: modelId,
        input: { ...input, eventsContext, aiConfig, brand },
        output: { schema: GerarCampanhaEmailOutputSchema },
        prompt: `{{{aiConfig.globalBasePrompt}}}

IDENTIDADE DA MARCA (USAR APENAS ESTES DADOS):
Nome: {{{brand.identity.tradeName}}}
Slogan: {{{brand.identity.slogan}}}
Missão: {{{brand.identity.mission}}}
Descrição: {{{brand.identity.shortDescription}}}

CORES OFICIAIS (USAR NO HTML):
Primária: {{{brand.visual.primaryColor}}}
Secundária: {{{brand.visual.secondaryColor}}}
CTA: {{{brand.visual.ctaColor}}}
Fundo: {{{brand.visual.backgroundColor}}}
Texto: {{{brand.visual.textColor}}}

CONTATOS OFICIAIS (NUNCA INVENTAR):
Email Suporte: {{{brand.contacts.emails.support}}}
WhatsApp: {{{brand.contacts.whatsapp.number}}}
Instagram: {{{brand.contacts.social.instagram}}}
Site: {{{brand.urls.mainSite}}}

LOGO OFICIAL: {{{brand.logos.main}}}

DIRETRIZES DE TOM DE VOZ:
- Usar: Amigável, moderno, humano, positivo.
- Evitar: Robótico, agressivo, clickbait.

CONTEXTO DA CAMPANHA:
Objetivo: {{{objetivo}}}
Público Alvo: {{{publicoAlvo}}}
Tom Selecionado: {{{tom}}}

EVENTOS REAIS DISPONÍVEIS (Selecione até {{{maxEventos}}} mais relevantes):
{{#each eventsContext}}
- ID: {{id}}, Título: {{title}}, Categoria: {{categoryName}}, Cidade: {{city}}, Preço: {{startingPrice}}, Link: {{url}}
{{/each}}

REQUISITOS DO HTML:
1. Cabeçalho com logo oficial da marca.
2. Design limpo e responsivo usando as cores oficiais.
3. Botões de CTA com a cor {{{brand.visual.ctaColor}}}.
4. Rodapé padrão incluindo links de redes sociais e email de suporte.
5. Inserir link de descadastro (Unsubscribe) no final.

Gere o assunto, preheader, os IDs selecionados, a versão da marca utilizada ({{{brand.version}}}) e o HTML completo.`
      });
      
      const output = response.output;
      
      if (!output) {
        throw new Error("O modelo de IA não retornou uma saída válida.");
      }

      console.log("[SERVER-AI] Geração concluída com sucesso.");
      return {
        ...output,
        brandVersion: brand.version
      };
    } catch (err: any) {
      console.error("[SERVER-AI-ERROR] Falha no fluxo:", err);
      throw err;
    }
  }
);
