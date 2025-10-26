'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  getPersonalizedNftRecommendations,
  PersonalizedNftRecommendationsOutput,
} from '@/ai/flows/personalized-nft-recommendations';
import { NftCard } from '@/components/nft-card';
import { getNfts } from '@/lib/placeholder-data';
import type { NFT } from '@/lib/types';

const FormSchema = z.object({
  userPreferences: z
    .string()
    .min(10, { message: 'Please describe your interests in at least 10 characters.' })
    .max(500, { message: 'Your description cannot exceed 500 characters.' }),
});

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<PersonalizedNftRecommendationsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const allNfts = getNfts();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      userPreferences: '',
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    setRecommendations(null);
    try {
      const result = await getPersonalizedNftRecommendations({
        userPreferences: data.userPreferences,
        nftCategories: 'Reforestation, Ocean Cleanup, Wildlife Conservation',
      });
      setRecommendations(result);
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      // You could show an error toast here
    } finally {
      setIsLoading(false);
    }
  }

  const recommendedNfts = recommendations?.recommendations.map(recTitle => 
    allNfts.find(nft => nft.title.toLowerCase().includes(recTitle.toLowerCase()))
  ).filter(Boolean) as NFT[] || [];

  return (
    <MainLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl font-headline font-bold mb-2">AI-Powered Recommendations</h1>
          <p className="text-muted-foreground">
            Tell us what you like, and our AI will curate a personalized list of NFTs and vendors just for you.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Describe Your Interests</CardTitle>
            <CardDescription>
              What kind of art do you enjoy? Are you passionate about a specific cause like oceans or forests? Mention artists or styles you like.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="userPreferences"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Preferences</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., 'I love minimalist art, nature photography, and I'm very passionate about saving elephants and marine life. I've collected pieces related to ocean conservation before.'"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  Generate My Recommendations
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {isLoading && (
            <div className="text-center p-8 space-y-4">
                <Sparkles className="mx-auto h-12 w-12 text-primary animate-pulse" />
                <p className="text-muted-foreground">Our AI is crafting your recommendations...</p>
            </div>
        )}

        {recommendations && (
          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-headline font-semibold mb-4">Recommended NFTs for You</h2>
              {recommendedNfts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recommendedNfts.map((nft) => (
                    <NftCard key={nft.id} nft={nft} />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Could not find specific NFTs matching the recommendations, but check out the top vendors below!</p>
              )}
            </section>
            
            <section>
              <h2 className="text-2xl font-headline font-semibold mb-4">Top Vendors to Check Out</h2>
              <Card>
                <CardContent className="p-6">
                    <ul className="list-disc list-inside space-y-2">
                        {recommendations.topVendors.map((vendor, index) => (
                            <li key={index} className="text-lg">{vendor}</li>
                        ))}
                    </ul>
                </CardContent>
              </Card>
            </section>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
