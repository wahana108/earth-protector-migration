import { hargaEfektifTampilan, type InflationEntry } from '@/lib/inflation';
import { formatCurrency, type CurrencyConfig } from '@/lib/format-currency';

type HargaEfektifInfoProps = {
  harga: number;
  createdAt: Date;
  inflationHistory: InflationEntry[] | undefined;
  currency?: CurrencyConfig | null;
  className?: string;
};

// Info MURNI TAMPILAN — estimasi nilai hari ini dari sebuah harga
// tercatat. Tidak pernah dipakai untuk menghitung/menulis neraca.
// Gerbang inflation_enabled diterapkan di sumber data (lihat
// effectiveInflationHistory di lib/inflation.ts) — saat nonaktif,
// inflationHistory yang diterima di sini sudah berupa array kosong.
export function HargaEfektifInfo({ harga, createdAt, inflationHistory, currency, className }: HargaEfektifInfoProps) {
  if (!inflationHistory || inflationHistory.length === 0) return null;
  const efektif = hargaEfektifTampilan(harga, createdAt, inflationHistory);
  if (Math.round(efektif) === Math.round(harga)) return null;

  return (
    <p className={className ?? 'text-[11px] text-muted-foreground italic'}>
      ≈ {formatCurrency(efektif, currency)} setara nilai hari ini
    </p>
  );
}
