'use client';

import { ShieldCheck } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency, type CurrencyConfig } from '@/lib/format-currency';

interface ContributorBadgeProps {
  nilai: number;
  size?: 'sm' | 'md';
  currency?: CurrencyConfig | null;
}

export function ContributorBadge({ nilai, size = 'sm', currency }: ContributorBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const label = `Kontributor Infrastruktur · ${formatCurrency(nilai, currency)}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 cursor-default text-emerald-600" title={label}>
            <ShieldCheck className={iconSize} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
