import type { CommunityConfig } from './types';

export type CurrencyConfig = Pick<CommunityConfig, 'currency_code' | 'currency_locale' | 'currency_decimals'>;

export function formatCurrency(n: number, config?: CurrencyConfig | null): string {
  const decimals = config?.currency_decimals ?? 0;
  return new Intl.NumberFormat(config?.currency_locale ?? 'id-ID', {
    style: 'currency',
    currency: config?.currency_code ?? 'IDR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}
