'use server';
/**
 * @fileOverview Um assistente de IA para gerar descrições criativas e envolventes para eventos.
 *
 * - gerarDescricaoEvento - Uma função que manipula o processo de geração de descrição de evento.
 * - GerarDescricaoEventoInput - O tipo de entrada para a função gerarDescricaoEvento.
 * - GerarDescricaoEventoOutput - O tipo de retorno para a função gerarDescricaoEvento.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GerarDescricaoEventoInputSchema = z.object({
  nomeEvento: z.string().describe('O nome do evento.'),
  tipoEvento: z.string().describe('O tipo de evento (ex: concerto, feira, workshop).'),
  dataEvento: z.string().describe('A data ou período em que o evento ocorrerá.'),
  localEvento: z.string().describe('O local do evento (pode ser online ou um endereço físico).'),
  publicoAlvo: z.string().describe('O público-alvo principal do evento.'),
  palavrasChave: z
    .array(z.string())
    .describe('Uma lista de palavras-chave ou destaques importantes do evento.'),
});
export type GerarDescricaoEventoInput = z.infer<typeof GerarDescricaoEventoInputSchema>;

const GerarDescricaoEventoOutputSchema = z.object({
  descricao: z.string().describe('A descrição criativa e envolvente do evento.'),
});
export type GerarDescricaoEventoOutput = z.infer<typeof GerarDescricaoEventoOutputSchema>;

export async function gerarDescricaoEvento(
  input: GerarDescricaoEventoInput
): Promise<GerarDescricaoEventoOutput> {
  return gerarDescricaoEventoFlow(input);
}

const gerarDescricaoEventoPrompt = ai.definePrompt({
  name: 'gerarDescricaoEventoPrompt',
  input: {schema: GerarDescricaoEventoInputSchema},
  output: {schema: GerarDescricaoEventoOutputSchema},
  prompt: `Você é um copywriter criativo e especialista em marketing de eventos.
Sua tarefa é criar uma descrição de evento super envolvente, atraente e persuasiva com um tom entusiasmado, destacando os pontos fortes e o que o público pode esperar.
Inclua um forte apelo à ação para que as pessoas queiram participar.
Certifique-se de que a descrição tenha um tom amigável e convidativo, focando nos benefícios para o público.

Detalhes do Evento:
Nome: {{{nomeEvento}}}
Tipo: {{{tipoEvento}}}
Data: {{{dataEvento}}}
Local: {{{localEvento}}}
Público-alvo: {{{publicoAlvo}}}
Destaques: {{#each palavrasChave}}- {{{this}}}\n{{/each}}

Gerar uma descrição para o evento:`,
});

const gerarDescricaoEventoFlow = ai.defineFlow(
  {
    name: 'gerarDescricaoEventoFlow',
    inputSchema: GerarDescricaoEventoInputSchema,
    outputSchema: GerarDescricaoEventoOutputSchema,
  },
  async input => {
    const {output} = await gerarDescricaoEventoPrompt(input);
    return output!;
  }
);
