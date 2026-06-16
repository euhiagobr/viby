
import { genkit, z } from 'genkit';
import { openAI } from 'genkitx-openai';

/**
 * @fileOverview Configuração central do Genkit utilizando OpenAI.
 * Modelo padrão: GPT-4o-Mini (conforme solicitação de arquitetura de baixo custo e alta qualidade).
 */

export const ai = genkit({
  plugins: [
    openAI({ apiKey: process.env.OPENAI_API_KEY }),
  ],
  model: 'openai/gpt-4o-mini',
});

export { z };
