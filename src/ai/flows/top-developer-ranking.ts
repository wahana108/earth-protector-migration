'use server';

/**
 * @fileOverview An AI agent for calculating and displaying a ranking of top developers based on their contributions.
 *
 * - calculateTopDevelopers - A function that calculates the top developers and stores the results in Firestore.
 * - CalculateTopDevelopersInput - The input type for the calculateTopDevelopers function (currently empty).
 * - CalculateTopDevelopersOutput - The return type for the calculateTopDevelopers function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { getFirestore, collection, getDocs, setDoc, doc } from 'firebase/firestore';
import {db} from '@/lib/firebase';

const CalculateTopDevelopersInputSchema = z.object({});
export type CalculateTopDevelopersInput = z.infer<typeof CalculateTopDevelopersInputSchema>;

const CalculateTopDevelopersOutputSchema = z.array(
  z.object({
    developerId: z.string().describe('The ID of the developer.'),
    contributionScore: z.number().describe('The contribution score of the developer.'),
  })
).describe('A list of top developers ranked by their contribution score.');
export type CalculateTopDevelopersOutput = z.infer<typeof CalculateTopDevelopersOutputSchema>;

export async function calculateTopDevelopers(input: CalculateTopDevelopersInput): Promise<CalculateTopDevelopersOutput> {
  return calculateTopDevelopersFlow(input);
}

const calculateTopDevelopersFlow = ai.defineFlow(
  {
    name: 'calculateTopDevelopersFlow',
    inputSchema: CalculateTopDevelopersInputSchema,
    outputSchema: CalculateTopDevelopersOutputSchema,
  },
  async () => {
    // Fetch data from Firestore collections (nfts, transactions, likes).
    const nftsCollection = collection(db, 'nfts');
    const nftsSnapshot = await getDocs(nftsCollection);
    const nfts = nftsSnapshot.docs.map(doc => doc.data());

    const transactionsCollection = collection(db, 'transactions');
    const transactionsSnapshot = await getDocs(transactionsCollection);
    const transactions = transactionsSnapshot.docs.map(doc => doc.data());

    const likesCollection = collection(db, 'likes'); // This might need to be adjusted since likes are in subcollections

    // Aggregate contribution scores for each developer.
    const developerScores: { [developerId: string]: number } = {};

    // Calculate scores based on NFT creation, likes received, and transaction volume.
    nfts.forEach((nft: any) => {
      const creatorId = nft.creatorId;
      if (creatorId) {
        developerScores[creatorId] = (developerScores[creatorId] || 0) + 1; // NFT creation score
      }
    });

    // Add scores based on likes received (adjust to fetch likes from subcollections).
    for (const nftDoc of nftsSnapshot.docs) {
        const likesSnapshot = await getDocs(collection(db, `nfts/${nftDoc.id}/likes`));
        const likeCount = likesSnapshot.size;
        const creatorId = nftDoc.data()?.creatorId;
        if (creatorId) {
            developerScores[creatorId] = (developerScores[creatorId] || 0) + likeCount * 0.5; // Like received score
        }
    }

    transactions.forEach((transaction: any) => {
      const sellerId = transaction.sellerId;
      if (sellerId) {
        developerScores[sellerId] = (developerScores[sellerId] || 0) + 0.2; // Transaction volume score
      }
    });

    // Convert to a ranked list.
    const rankedDevelopers = Object.entries(developerScores)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .map(([developerId, contributionScore]) => ({
        developerId,
        contributionScore,
      }));

    // Store the results in a new Firestore collection (topDevelopers).
    const topDevelopersCollection = collection(db, 'topDevelopers');
    for (const developer of rankedDevelopers) {
      await setDoc(doc(topDevelopersCollection, developer.developerId), developer);
    }

    return rankedDevelopers;
  }
);


const prompt = ai.definePrompt({
    name: 'topDeveloperRankingPrompt',
    prompt: `You are an AI assistant helping to rank top developers based on their contributions.
    Calculate the contribution score for each developer based on NFT creation, likes received, and transaction volume.
    Return a ranked list of developers with their contribution scores.
    Store the results in a new Firestore collection called 'topDevelopers'.`,
});


