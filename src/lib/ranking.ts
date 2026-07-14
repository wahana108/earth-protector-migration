// lapak_aktif undefined/true = aktif (default ON) — user lama tanpa field dianggap aktif.
// Post-fetch check saja, JANGAN pakai where('lapak_aktif','!=',false) di query:
// inequality Firestore hanya mengembalikan dokumen yang MEMILIKI field itu,
// mengecualikan semua user lama tanpa field secara diam-diam.
export function isLapakAktif(data: { lapak_aktif?: boolean } | Record<string, unknown> | undefined | null): boolean {
  return (data as { lapak_aktif?: boolean } | undefined | null)?.lapak_aktif !== false;
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
