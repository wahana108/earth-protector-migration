// Lapisan tampilan MURNI — tidak menulis apapun ke neraca.
// Menghitung nilai Rupiah-hari-ini dari sebuah harga yang tercatat (kekal),
// dengan compounding inflasi (pct > 0) atau deflasi (pct < 0) tahunan.

export type InflationEntry = { tahun: number; pct: number };

export function hargaEfektifTampilan(
  hargaDitetapkan: number,
  tanggalDibuat: Date,
  inflationHistory: InflationEntry[] | undefined,
): number {
  const tahunDibuat = tanggalDibuat.getFullYear();
  const tahunSekarang = new Date().getFullYear();
  const history = inflationHistory ?? [];

  let faktor = 1;
  for (let t = tahunDibuat; t < tahunSekarang; t++) {
    const pct = history.find(h => h.tahun === t)?.pct ?? 0;
    faktor *= 1 + pct / 100;
  }

  return hargaDitetapkan * faktor;
}
