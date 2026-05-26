'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusCircle, Loader2, ImageOff } from 'lucide-react';
import Link from 'next/link';

import { MainLayout } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { createNft } from '@/lib/firestore';
import type { NFTCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  imageUrl: z.string().url('Must be a valid URL'),
  impact: z.string().min(3, 'Impact must be at least 3 characters'),
  price: z.coerce.number().positive('Price must be greater than 0'),
  category: z.enum(['tree_planting', 'ocean_cleanup', 'wildlife_protection']),
});

type FormData = z.infer<typeof schema>;
type PreviewStatus = 'idle' | 'loading' | 'loaded' | 'error';

export default function CreatePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [previewUrl, setPreviewUrl] = useState('');
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const selectedCategory = watch('category');
  const imageUrlValue = watch('imageUrl');

  // Debounced image preview — 500ms after last keystroke
  useEffect(() => {
    if (!imageUrlValue) {
      setPreviewUrl('');
      setPreviewStatus('idle');
      return;
    }

    // Only attempt preview if it looks like a valid URL
    try {
      new URL(imageUrlValue);
    } catch {
      setPreviewUrl('');
      setPreviewStatus('idle');
      return;
    }

    setPreviewStatus('loading');
    const timer = setTimeout(() => {
      setPreviewUrl(imageUrlValue);
    }, 500);

    return () => clearTimeout(timer);
  }, [imageUrlValue]);

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setSubmitting(true);
    try {
      const nftId = await createNft({
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
        impact: data.impact,
        price: data.price,
        category: data.category as NFTCategory,
        createdBy: user.id,
      });
      setSuccess(true);
      reset();
      setTimeout(() => router.push(`/nft/${nftId}`), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto text-center py-16">
          <h2 className="text-2xl font-headline font-bold mb-2">Sign in required</h2>
          <p className="text-muted-foreground mb-4">You must be signed in to create an NFT.</p>
          <Button asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-headline font-bold mb-2">Create Impact NFT</h1>
          <p className="text-muted-foreground">
            Mint a new environmental impact NFT. It will be pending community validation before going live.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>NFT Details</CardTitle>
            <CardDescription>
              Fill in the details for your new environmental NFT.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="text-center py-8 space-y-2">
                <div className="text-4xl">🌱</div>
                <p className="text-lg font-semibold text-primary">NFT Created!</p>
                <p className="text-muted-foreground">Your NFT is pending validation. Redirecting to NFT page...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" placeholder="e.g. Amazon Reforestation" {...register('title')} />
                  {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the environmental impact of this NFT..."
                    rows={4}
                    {...register('description')}
                  />
                  {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input id="imageUrl" placeholder="https://..." {...register('imageUrl')} />
                  {errors.imageUrl && <p className="text-sm text-destructive">{errors.imageUrl.message}</p>}

                  {/* Image preview */}
                  {previewStatus !== 'idle' && (
                    <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                      {previewStatus === 'loading' && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {previewStatus === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <ImageOff className="h-8 w-8" />
                          <p className="text-sm">Could not load image. Check the URL.</p>
                        </div>
                      )}
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className={cn(
                            'h-full w-full object-cover transition-opacity duration-300',
                            previewStatus === 'loaded' ? 'opacity-100' : 'opacity-0'
                          )}
                          onLoad={() => setPreviewStatus('loaded')}
                          onError={() => setPreviewStatus('error')}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="impact">Impact Statement</Label>
                  <Input id="impact" placeholder="e.g. 100 trees planted" {...register('impact')} />
                  {errors.impact && <p className="text-sm text-destructive">{errors.impact.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (ETH)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="1.5"
                      {...register('price')}
                    />
                    {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={selectedCategory}
                      onValueChange={(v) => setValue('category', v as NFTCategory, { shouldValidate: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tree_planting">Reforestation</SelectItem>
                        <SelectItem value="ocean_cleanup">Ocean Cleanup</SelectItem>
                        <SelectItem value="wildlife_protection">Wildlife Conservation</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                  </div>
                </div>

                <Button type="submit" className="w-full gap-2" disabled={submitting}>
                  <PlusCircle className="h-5 w-5" />
                  {submitting ? 'Creating...' : 'Create NFT'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
