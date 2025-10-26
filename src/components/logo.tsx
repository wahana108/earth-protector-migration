import { Leaf } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 text-xl font-bold font-headline text-foreground", className)}>
      <div className="p-2 bg-primary/20 rounded-lg">
        <Leaf className="w-5 h-5 text-primary" />
      </div>
      <span>Earth Sanctuary</span>
    </Link>
  );
}
