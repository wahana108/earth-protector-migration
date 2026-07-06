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
