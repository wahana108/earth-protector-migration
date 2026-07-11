import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI({apiKey: process.env.GEMINI_API_KEY})],
  model: process.env.GEMINI_MODEL ?? 'googleai/gemini-2.0-flash',
});
