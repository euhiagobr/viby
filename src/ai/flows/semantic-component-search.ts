'use server';
/**
 * @fileOverview Um fluxo Genkit para realizar buscas semânticas por componentes
 * em uma base de código, identificando arquivos relevantes com base em uma
 * descrição natural.
 *
 * - semanticComponentSearch - Uma função que executa a busca semântica.
 * - SemanticComponentSearchInput - O tipo de entrada para a função de busca.
 * - SemanticComponentSearchOutput - O tipo de retorno para a função de busca.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticComponentSearchInputSchema = z.object({
  searchQuery: z
    .string()
    .describe('A consulta em linguagem natural para o componente (ex: "public header", "main navigation").'),
  codebaseFiles: z
    .array(z.object({filePath: z.string(), fileContent: z.string()}))
    .describe('Uma lista de objetos, cada um contendo o caminho do arquivo e seu conteúdo.'),
});
export type SemanticComponentSearchInput = z.infer<typeof SemanticComponentSearchInputSchema>;

const SemanticComponentSearchOutputSchema = z.object({
  relevantFiles: z
    .array(
      z.object({
        filePath: z.string().describe('O caminho do arquivo relevante.'),
        reasoning: z
          .string()
          .describe('Uma explicação do porquê o arquivo é relevante para a consulta.'),
      })
    )
    .describe('Uma lista de arquivos que são semanticamente relevantes para a consulta.'),
});
export type SemanticComponentSearchOutput = z.infer<typeof SemanticComponentSearchOutputSchema>;

export async function semanticComponentSearch(
  input: SemanticComponentSearchInput
): Promise<SemanticComponentSearchOutput> {
  return semanticComponentSearchFlow(input);
}

const semanticComponentSearchPrompt = ai.definePrompt({
  name: 'semanticComponentSearchPrompt',
  input: {schema: SemanticComponentSearchInputSchema},
  output: {schema: SemanticComponentSearchOutputSchema},
  prompt: `Você é um assistente de análise de código. Sua tarefa é identificar arquivos de código relevantes
a partir de uma base de código fornecida com base em uma consulta de pesquisa semântica.

O usuário fornecerá uma consulta em linguagem natural para um componente (por exemplo, 'public header',
'main navigation', 'user authentication module') e uma lista de arquivos com seu conteúdo.
Seu objetivo é entender semanticamente a consulta e determinar quais arquivos têm maior probabilidade
de implementar ou definir esse componente.

Retorne um array JSON de objetos, onde cada objeto contém o 'filePath' de um arquivo relevante
e um 'reasoning' explicando por que ele é relevante para a consulta.
Se nenhum arquivo for relevante, retorne um array vazio.

Consulta de Pesquisa: {{{searchQuery}}}

Arquivos da Base de Código:
{{#each codebaseFiles}}
--- Arquivo: {{{filePath}}} ---
{{{fileContent}}}
--- Fim do Arquivo: {{{filePath}}} ---
{{/each}}`,
});

const semanticComponentSearchFlow = ai.defineFlow(
  {
    name: 'semanticComponentSearchFlow',
    inputSchema: SemanticComponentSearchInputSchema,
    outputSchema: SemanticComponentSearchOutputSchema,
  },
  async input => {
    const {output} = await semanticComponentSearchPrompt(input);
    return output!;
  }
);
