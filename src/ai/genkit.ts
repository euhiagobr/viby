
import { genkit, z } from 'kit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * @fileOverview Configuração central do Genkit v1.x.
 */

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});

export { z };
