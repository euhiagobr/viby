
'use server';
/**
 * @fileOverview Fluxo Genkit para geração inteligente de campanhas de e-mail marketing.
 * Seleciona eventos relevantes e compõe HTML responsivo baseado na identidade Viby.
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
  input: { schema: GerarCampanhaEmailInputSchema.extend({ eventsContext: z.array(z.any()) }) },
  output: { schema: GerarCampanhaEmailOutputSchema },
  prompt: `Você é o estrategista de marketing da Viby, uma plataforma líder em experiências culturais.
Sua tarefa é gerar uma campanha de e-mail marketing de alta conversão.

INSTRUÇÕES DE DESIGN:
- Use as cores da Viby: Primária (#000000), Secundária (#2C52EE).
- O layout deve ser limpo, moderno e responsivo.
- Botões de CTA devem ter fundo #2C52EE e texto branco, cantos arredondados (12px).
- Inclua a logo oficial (URL mock: https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media).

ESTRATÉGIA DE CONTEÚDO:
Objetivo: {{{objetivo}}}
Público: {{{publicoAlvo}}}
Tom: {{{tom}}}

EVENTOS DISPONÍVEIS (Selecione os {{{maxEventos}}} mais relevantes):
{{#each eventsContext}}
- ID: {{id}}, Título: {{title}}, Categoria: {{categoryName}}, Cidade: {{city}}, Preço: {{startingPrice}}
{{/each}}

REQUISITOS DO HTML:
1. Cabeçalho com logo centralizada.
2. Título (H1) em negrito e itálico (estilo Viby).
3. Texto de corpo envolvente.
4. Bloco de destaque para os eventos selecionados (Imagem, Título, Data, Cidade).
5. Botão de CTA principal.
6. Rodapé institucional com links de descadastro.

Gere o assunto, preheader, os IDs selecionados e o HTML completo.`
});

const gerarCampanhaEmailFlow = ai.defineFlow(
  {
    name: 'gerarCampanhaEmailFlow',
    inputSchema: GerarCampanhaEmailInputSchema,
    outputSchema: GerarCampanhaEmailOutputSchema,
  },
  async (input) => {
    const db = getAdminDb();
    const eventsSnap = await db.collection('events')
      .where('status', '==', 'Ativo')
      .limit(20)
      .get();
    
    const eventsContext = eventsSnap.docs.map(d => ({
      id: d.id,
      title: d.data().title,
      categoryName: d.data().categoryName,
      city: d.data().city,
      startingPrice: d.data().startingPrice
    }));

    const { output } = await prompt({ ...input, eventsContext });
    return output!;
  }
);
