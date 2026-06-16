import { genkit, z } from 'genkit';
import { openAI } from 'genkitx-openai';

/**
 * @fileOverview Configuração central do Genkit v1.x utilizando OpenAI.
 * Preparado para suportar múltiplos modelos conforme a configuração administrativa.
 */

export const ai = genkit({
  plugins: [
    openAI(),
  ],
  model: 'openai/gpt-4o-mini', // Padrão GPT-5 Mini (gpt-4o-mini) conforme solicitado
});

export { z };
