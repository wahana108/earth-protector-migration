'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, User } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { NFT, User as UserType } from '@/lib/types';
import { CATEGORY_LABELS } from '@/lib/firestore';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from './ui/badge';

type NftCardProps = {
  nft: NFT;
  creator?: UserType;
};

export function NftCard({ nft, creator }: NftCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(nft.likes);

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
  };

  const categoryLabel = CATEGORY_LABELS[nft.category] ?? nft.category;

  return (
    <Card className="overflow-hidden group transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1">
      <CardHeader className="p-0">
        <Link href={`/nft/${nft.id}`} className="block relative aspect-[3/4] overflow-hidden">
          <Image
            src={nft.imageUrl}
            alt={nft.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </Link>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <h3 className="font-headline font-semibold text-lg leading-tight truncate pr-2">
            <Link href={`/nft/${nft.id}`} className="hover:text-primary transition-colors">{nft.title}</Link>
          </h3>
          {nft.forSale ? (
            <Badge variant="secondary" className="bg-primary/10 text-primary">{nft.price} ETH</Badge>
          ) : (
            <Badge variant="outline">Not for sale</Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Avatar className="h-6 w-6">
            {creator?.photoURL && <AvatarImage src={creator.photoURL} alt={creator.displayName || 'Creator'} />}
            <AvatarFallback>
              {creator?.displayName ? creator.displayName.charAt(0) : <User className="w-3 h-3" />}
            </AvatarFallback>
          </Avatar>
          <span>{creator?.displayName || 'Unknown Creator'}</span>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-between">
        <div className="text-sm text-muted-foreground">
          Category: <Link href={`/explore?category=${nft.category}`} className="hover:text-primary">{categoryLabel}</Link>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLike} aria-label="Like NFT">
          <Heart
            className={cn(
              'h-5 w-5',
              isLiked ? 'text-red-500 fill-current' : 'text-muted-foreground'
            )}
          />
          <span className="ml-2 text-sm text-muted-foreground">{likeCount}</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
