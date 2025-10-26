import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const bgImage = PlaceHolderImages.find(img => img.id === 'login-background');
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4">
       {bgImage && (
             <Image
                src={bgImage.imageUrl}
                alt={bgImage.description}
                fill
                className="object-cover"
                data-ai-hint={bgImage.imageHint}
              />
          )}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="relative z-10 w-full">
        {children}
      </div>
    </div>
  );
}
