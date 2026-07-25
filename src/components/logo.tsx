import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      title="The Mother Earth Project"
      className={cn("flex items-center gap-2 text-xl font-bold font-headline text-foreground", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/tmep-logo.svg" alt="TMEP" className="w-8 h-8 rounded-full shrink-0" />
      <span className="truncate">TMEP</span>
    </Link>
  );
}
