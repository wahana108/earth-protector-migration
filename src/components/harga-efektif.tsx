import { hargaEfektifTampilan, type InflationEntry } from '@/lib/inflation';

function formatIDR(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

type HargaEfektifInfoProps = {
  harga: number;
  createdAt: Date;
  inflationHistory: InflationEntry[] | undefined;
  className?: string;
};

// Info MURNI TAMPILAN — estimasi nilai Rupiah hari ini dari sebuah harga
// tercatat. Tidak pernah dipakai untuk menghitung/menulis neraca.
// Gerbang inflation_enabled diterapkan di sumber data (lihat
// effectiveInflationHistory di lib/inflation.ts) — saat nonaktif,
// inflationHistory yang diterima di sini sudah berupa array kosong.
export function HargaEfektifInfo({ harga, createdAt, inflationHistory, className }: HargaEfektifInfoProps) {
  if (!inflationHistory || inflationHistory.length === 0) return null;
  const efektif = hargaEfektifTampilan(harga, createdAt, inflationHistory);
  if (Math.round(efektif) === Math.round(harga)) return null;

  return (
    <p className={className ?? 'text-[11px] text-muted-foreground italic'}>
      ≈ {formatIDR(efektif)} setara nilai hari ini
    </p>
  );
}
