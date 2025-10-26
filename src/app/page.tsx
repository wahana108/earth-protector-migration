import Image from 'next/image';
import Link from 'next/link';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NftCard } from '@/components/nft-card';
import { getNfts } from '@/lib/placeholder-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ArrowRight, Leaf, Sprout, Recycle } from 'lucide-react';

export default function HomePage() {
  const allNfts = getNfts();
  const featuredNfts = allNfts.slice(0, 4);

  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-background');

  const categories = [
    { name: 'Reforestation', icon: <Leaf className="w-8 h-8 text-primary" />, description: 'NFTs funding tree planting projects worldwide.' },
    { name: 'Ocean Cleanup', icon: <Recycle className="w-8 h-8 text-primary" />, description: 'Support initiatives to clean our polluted seas.' },
    { name: 'Wildlife Conservation', icon: <Sprout className="w-8 h-8 text-primary" />, description: 'Protect endangered species and their habitats.' },
  ];

  return (
    <MainLayout>
      <div className="flex flex-col gap-16">
        <section className="relative rounded-xl overflow-hidden min-h-[400px] md:min-h-[500px] flex items-center justify-center text-center p-4">
          {heroImage && (
             <Image
                src={heroImage.imageUrl}
                alt={heroImage.description}
                fill
                className="object-cover"
                data-ai-hint={heroImage.imageHint}
                priority
              />
          )}
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 text-white max-w-3xl flex flex-col items-center gap-6">
            <h1 className="text-4xl md:text-6xl font-headline font-bold !leading-tight">
              Invest in Our Planet, One NFT at a Time
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80">
              Discover, collect, and trade unique digital assets that represent real-world environmental action. Your collection makes a difference.
            </p>
            <div className="flex gap-4">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/explore">
                  Start Exploring
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/create">Create Impact</Link>
              </Button>
            </div>
          </div>
        </section>

        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-headline font-semibold">Featured NFTs</h2>
            <Button asChild variant="link" className="text-accent-foreground">
              <Link href="/explore">View All <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredNfts.map((nft) => (
              <NftCard key={nft.id} nft={nft} />
            ))}
          </div>
        </section>

        <section>
           <h2 className="text-3xl font-headline font-semibold text-center mb-8">Impact Categories</h2>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {categories.map((category) => (
              <Card key={category.name} className="bg-card/80 backdrop-blur-sm border-2 border-primary/10 hover:border-primary/30 transition-all duration-300 transform hover:-translate-y-1 shadow-lg hover:shadow-primary/20">
                <CardContent className="p-6 flex flex-col items-center text-center gap-4">
                  <div className="p-4 bg-secondary rounded-full">
                    {category.icon}
                  </div>
                  <h3 className="text-xl font-headline font-semibold">{category.name}</h3>
                  <p className="text-muted-foreground">{category.description}</p>
                   <Button variant="outline" className="mt-2" asChild>
                    <Link href={`/explore?category=${category.name}`}>View Collection</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
           </div>
        </section>
      </div>
    </MainLayout>
  );
}
