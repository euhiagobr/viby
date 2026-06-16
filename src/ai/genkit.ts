import { genkit, z } from 'genkit';
import { openai } from 'genkitx-openai';

/**
 * @fileOverview Configuração central do Genkit v1.x utilizando OpenAI.
 * Preparado para suportar múltiplos modelos conforme a configuração administrativa.
 */

export const ai = genkit({
  plugins: [
    openai(),
  ],
  model: 'openai/gpt-4o-mini', // Padrão GPT-5 Mini (gpt-4o-mini) conforme solicitado
});

export { z };
