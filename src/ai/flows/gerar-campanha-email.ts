
'use server';
/**
 * @fileOverview Fluxo Genkit para geração inteligente de campanhas de e-mail marketing.
 * Utiliza a Base de Conhecimento Permanente da Viby configurada em Firestore.
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
  contentHtml: z.string().describe('Corpo do e-mail em HTML responsivo seguindo o design Viby.'),
  selectedEventIds: z.array(z.string()).describe('IDs dos eventos selecionados pela IA.')
});

export async function gerarCampanhaEmail(input: z.infer<typeof GerarCampanhaEmailInputSchema>) {
  return gerarCampanhaEmailFlow(input);
}

const prompt = ai.definePrompt({
  name: 'gerarCampanhaEmailPrompt',
  model: 'openai/gpt-4o',
  input: { 
    schema: GerarCampanhaEmailInputSchema.extend({ 
      eventsContext: z.array(z.any()),
      aiConfig: z.any() 
    }) 
  },
  output: { schema: GerarCampanhaEmailOutputSchema },
  prompt: `{{{aiConfig.globalBasePrompt}}}

DIRETRIZES DA MARCA:
{{{aiConfig.brandDescription}}}

TOM DE VOZ DESEJADO:
- Usar: {{#each aiConfig.toneOfVoice.do}} {{{this}}}, {{/each}}
- Evitar: {{#each aiConfig.toneOfVoice.dont}} {{{this}}}, {{/each}}

INSTRUÇÕES DE DESIGN VIBY:
- Cores: Primária (#000000), Secundária (#2C52EE).
- Layout moderno, limpo e responsivo.
- Botões de CTA: fundo #2C52EE, texto branco, cantos arredondados (12px).
- Logo: https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media

CONTEXTO DA CAMPANHA:
Objetivo: {{{objetivo}}}
Público Alvo: {{{publicoAlvo}}}
Tom Selecionado: {{{tom}}}

EVENTOS REAIS DISPONÍVEIS (Selecione até {{{maxEventos}}} mais relevantes):
{{#each eventsContext}}
- ID: {{id}}, Título: {{title}}, Categoria: {{categoryName}}, Cidade: {{city}}, Preço: {{startingPrice}}
{{/each}}

REQUISITOS DO HTML:
1. Cabeçalho com logo Viby.
2. Título (H1) em negrito e itálico seguindo a identidade.
3. Texto envolvente conectando os objetivos da marca aos interesses do público.
4. Blocos de eventos selecionados com Imagem, Título e Local.
5. Chamado para ação (CTA) principal.

Gere o assunto, preheader, os IDs selecionados e o HTML completo.`
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
      
      console.log("[SERVER-AI] Carregando Base de Conhecimento...");
      const configSnap = await db.collection('settings').doc('ai_config').get();
      const aiConfig = configSnap.exists ? configSnap.data() : {
        brandDescription: "Plataforma de eventos Viby.",
        globalBasePrompt: "Você é a IA oficial da Viby.",
        toneOfVoice: { do: ["amigável"], dont: ["robótico"] }
      };

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
          startingPrice: data.startingPrice || 0
        };
      });

      if (eventsContext.length === 0) {
        throw new Error("Não há eventos ativos na plataforma para gerar a campanha.");
      }

      console.log(`[SERVER-AI] Contexto carregado com ${eventsContext.length} eventos. Chamando GPT-4o...`);

      const { output } = await prompt({ ...input, eventsContext, aiConfig });
      
      if (!output) {
        throw new Error("O modelo de IA não retornou uma saída válida.");
      }

      console.log("[SERVER-AI] Geração concluída com sucesso via OpenAI.");
      return output;
    } catch (err: any) {
      console.error("[SERVER-AI-ERROR] Falha no fluxo:", err);
      throw err;
    }
  }
);
