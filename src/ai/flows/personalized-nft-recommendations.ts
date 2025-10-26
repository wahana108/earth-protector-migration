'use server';

/**
 * @fileOverview A personalized NFT recommendation AI agent.
 *
 * - getPersonalizedNftRecommendations - A function that generates personalized NFT recommendations based on user preferences.
 * - PersonalizedNftRecommendationsInput - The input type for the getPersonalizedNftRecommendations function.
 * - PersonalizedNftRecommendationsOutput - The return type for the getPersonalizedNftRecommendations function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizedNftRecommendationsInputSchema = z.object({
  userPreferences: z
    .string()
    .describe(
      'A description of the user\u0027s past interactions, likes, and preferences related to NFTs.'
    ),
  nftCategories: z.string().describe('A comma-separated list of available NFT categories.'),
});
export type PersonalizedNftRecommendationsInput = z.infer<
  typeof PersonalizedNftRecommendationsInputSchema
>;

const PersonalizedNftRecommendationsOutputSchema = z.object({
  recommendations: z
    .array(z.string())
    .describe('A list of personalized NFT recommendations based on user preferences.'),
  topVendors: z
    .array(z.string())
    .describe('A list of top NFT vendors based on user preferences.'),
});
export type PersonalizedNftRecommendationsOutput = z.infer<
  typeof PersonalizedNftRecommendationsOutputSchema
>;

export async function getPersonalizedNftRecommendations(
  input: PersonalizedNftRecommendationsInput
): Promise<PersonalizedNftRecommendationsOutput> {
  return personalizedNftRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedNftRecommendationsPrompt',
  input: {schema: PersonalizedNftRecommendationsInputSchema},
  output: {schema: PersonalizedNftRecommendationsOutputSchema},
  prompt: `You are an expert NFT recommendation engine. Based on the user\u0027s preferences and available NFT categories, you will provide personalized NFT recommendations and a list of top vendors.

User Preferences: {{{userPreferences}}}
NFT Categories: {{{nftCategories}}}

Provide recommendations that align with the user\u0027s interests and suggest top vendors known for those types of NFTs.

Output in JSON format:
${JSON.stringify(PersonalizedNftRecommendationsOutputSchema.shape)}`,
});

const personalizedNftRecommendationsFlow = ai.defineFlow(
  {
    name: 'personalizedNftRecommendationsFlow',
    inputSchema: PersonalizedNftRecommendationsInputSchema,
    outputSchema: PersonalizedNftRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
