import { genkit, z } from 'genkit';
import { openai } from 'genkitx-openai';

/**
 * @fileOverview Configuração central do Genkit v1.x utilizando OpenAI (ChatGPT).
 */

export const ai = genkit({
  plugins: [
    openai(),
  ],
  model: 'openai/gpt-4o', // Define o GPT-4o como modelo padrão para o projeto
});

export { z };