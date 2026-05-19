'use server';
/**
 * @fileOverview Um fluxo Genkit para gerar uma proposta comercial simplificada para eventos.
 *
 * - gerarPropostaComercialSimplificada - Uma função que aciona o fluxo de geração de proposta.
 * - GerarPropostaComercialSimplificadaInput - O tipo de entrada para a função.
 * - GerarPropostaComercialSimplificadaOutput - O tipo de retorno para a função.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GerarPropostaComercialSimplificadaInputSchema = z.object({
  nomeEvento: z.string().describe('O nome do evento.'),
  dataEvento: z.string().describe('A data em que o evento ocorrerá.'),
  localEvento: z.string().describe('O local onde o evento será realizado.'),
  publicoAlvo: z.string().describe('O público-alvo do evento.'),
  beneficiosPatrocinio: z
    .string()
    .describe('Os benefícios oferecidos aos potenciais patrocinadores ou parceiros.'),
  informacoesAdicionais: z
    .string()
    .optional()
    .describe('Quaisquer informações adicionais relevantes para a proposta.'),
});
export type GerarPropostaComercialSimplificadaInput = z.infer<
  typeof GerarPropostaComercialSimplificadaInputSchema
>;

const GerarPropostaComercialSimplificadaOutputSchema = z.object({
  propostaComercial: z
    .string()
    .describe('O rascunho da proposta comercial gerada.'),
});
export type GerarPropostaComercialSimplificadaOutput = z.infer<
  typeof GerarPropostaComercialSimplificadaOutputSchema
>;

export async function gerarPropostaComercialSimplificada(
  input: GerarPropostaComercialSimplificadaInput
): Promise<GerarPropostaComercialSimplificadaOutput> {
  return gerarPropostaComercialSimplificadaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'gerarPropostaComercialSimplificadaPrompt',
  input: {schema: GerarPropostaComercialSimplificadaInputSchema},
  output: {schema: GerarPropostaComercialSimplificadaOutputSchema},
  prompt: `Você é um assistente de marketing de eventos e sua tarefa é gerar um rascunho de proposta comercial para um evento. Esta proposta será usada por um promotor de eventos para abordar potenciais patrocinadores ou parceiros.

Use as seguintes informações para criar a proposta:

Nome do Evento: {{{nomeEvento}}}
Data do Evento: {{{dataEvento}}}
Local do Evento: {{{localEvento}}}
Público-alvo: {{{publicoAlvo}}}
Benefícios de Patrocínio: {{{beneficiosPatrocinio}}}

{{#if informacoesAdicionais}}
Informações Adicionais: {{{informacoesAdicionais}}}
{{/if}}

Escreva uma proposta comercial clara, concisa e persuasiva. A proposta deve incluir:
1. Uma breve introdução sobre o evento e seus objetivos.
2. Detalhes sobre o público-alvo e o alcance esperado.
3. Uma seção destacando os benefícios claros para o patrocinador/parceiro.
4. Um chamado à ação para entrar em contato para discutir uma parceria.

O tom deve ser profissional e convidativo. Formate a saída como uma única string para o campo 'propostaComercial'.`,
});

const gerarPropostaComercialSimplificadaFlow = ai.defineFlow(
  {
    name: 'gerarPropostaComercialSimplificadaFlow',
    inputSchema: GerarPropostaComercialSimplificadaInputSchema,
    outputSchema: GerarPropostaComercialSimplificadaOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
