// lapak_aktif undefined/true = aktif (default ON) — user lama tanpa field dianggap aktif.
// suspended_by_admin = true mengalahkan lapak_aktif — suspend admin selalu menang,
// bahkan jika user memaksa lapak_aktif=true (mis. lewat console). Semua titik yang
// memakai isLapakAktif() (projects/explore/FIFO/buy guard/ranking/AI review/
// top-developers) otomatis ikut menghormati suspend tanpa perubahan tambahan.
// Post-fetch check saja, JANGAN pakai where('lapak_aktif','!=',false) di query:
// inequality Firestore hanya mengembalikan dokumen yang MEMILIKI field itu,
// mengecualikan semua user lama tanpa field secara diam-diam.
type LapakData = { lapak_aktif?: boolean; suspended_by_admin?: boolean } | Record<string, unknown> | undefined | null;

export function isLapakAktif(data: LapakData): boolean {
  const d = data as { lapak_aktif?: boolean; suspended_by_admin?: boolean } | undefined | null;
  return d?.lapak_aktif !== false && d?.suspended_by_admin !== true;
}

// Khusus untuk guard SISI AKTOR (beli/validasi/buyback/komentar/create project) —
// SENGAJA hanya cek suspend, BUKAN lapak_aktif: mematikan lapak sendiri tidak boleh
// menghalangi diri sendiri bertransaksi sebagai pembeli/komentator/dst di tempat lain.
export function isSuspended(data: LapakData): boolean {
  return (data as { suspended_by_admin?: boolean } | undefined | null)?.suspended_by_admin === true;
}

export function calculateEffectiveBuyback(
  buybackCount: number,
  totalPoin: number,
  hargaDasar: number,
): number {
  const penalty = totalPoin < 0
    ? Math.floor(Math.abs(totalPoin) / hargaDasar)
    : 0;
  return Math.max(0, buybackCount - penalty);
}

// Jumlahkan deret Fibonacci dari awal, berhenti saat total + next > n.
// largest = bilangan Fibonacci terbesar yang masuk = kuota top developer.
export function fibonacciLargestAndSum(n: number): {
  largest: number;
  totalSum: number;
  sequence: number[];
} {
  if (n < 1) return { largest: 0, totalSum: 0, sequence: [] };
  if (n < 2) return { largest: 1, totalSum: 1, sequence: [1] };
  const sequence = [1, 1];
  let total = 2;
  while (true) {
    const next = sequence[sequence.length - 1] + sequence[sequence.length - 2];
    if (total + next > n) break;
    sequence.push(next);
    total += next;
  }
  return { largest: sequence[sequence.length - 1], totalSum: total, sequence };
}
