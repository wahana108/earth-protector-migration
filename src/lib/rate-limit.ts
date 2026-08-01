import { db } from './firebase';
import { doc, getDoc, DocumentReference } from 'firebase/firestore';

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

// WITA = UTC+8 (Asia/Makassar). 'sv-SE' locale menghasilkan format YYYY-MM-DD.
export function getTodayString(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' });
}

type DailyUsage = {
  date: string;
  transactions: number;
  projects: number;
  comments: number;
  reports: number;
  claims: number;
};

type UsageField = keyof Omit<DailyUsage, 'date'>;

// Cek dan increment user daily usage dalam transaksi atau batch.
// userData = data dokumen user yang sudah di-fetch pemanggil (0 read tambahan).
// limit <= 0 → unlimited, tidak melakukan apapun.
// Throws RateLimitError jika usage[field] >= limit.
// Menulis daily_usage baru ke writer (Transaction atau WriteBatch).
// Reset lazy: jika daily_usage.date != hari ini, semua counter dianggap 0.
export function checkAndIncrementUserUsage(
  writer: { update(ref: DocumentReference, data: Record<string, unknown>): unknown },
  userRef: DocumentReference,
  userData: Record<string, unknown>,
  field: UsageField,
  limit: number,
): void {
  if (limit <= 0) return;

  const today = getTodayString();
  const raw = userData.daily_usage as Partial<DailyUsage> | undefined;
  const usage: DailyUsage =
    !raw || raw.date !== today
      ? { date: today, transactions: 0, projects: 0, comments: 0, reports: 0, claims: 0 }
      : { transactions: 0, projects: 0, comments: 0, reports: 0, claims: 0, ...raw, date: today };

  if (usage[field] >= limit) {
    const label: Record<UsageField, string> = {
      transactions: 'transaksi',
      projects: 'project',
      comments: 'komentar',
      reports: 'laporan',
      claims: 'klaim',
    };
    throw new RateLimitError(
      `Batas ${label[field]} harian tercapai (${limit}/hari). Coba lagi besok.`,
    );
  }

  writer.update(userRef, { daily_usage: { ...usage, [field]: usage[field] + 1 } });
}

// Cek global daily limit dari daily_stats/{today}.
// limit <= 0 → no-op.
// Throws RateLimitError jika current >= limit.
//
// TRADE-OFF SADAR: read dilakukan di luar batch/transaction → ada race condition
// minimal (dua request bersamaan bisa melewati limit 1-2 unit). Ini diterima
// sebagai proteksi kasar; full runTransaction akan menambah kompleksitas signifikan
// untuk manfaat yang tidak sebanding pada use case ini.
export async function checkGlobalDailyLimit(
  field: 'projects' | 'comments' | 'reports',
  limit: number,
): Promise<void> {
  if (limit <= 0) return;

  const snap = await getDoc(doc(db, 'daily_stats', getTodayString()));
  const current = snap.exists() ? ((snap.data()[field] as number) ?? 0) : 0;

  if (current >= limit) {
    const label = field === 'projects' ? 'project komunitas' : field === 'comments' ? 'komentar komunitas' : 'laporan komunitas';
    throw new RateLimitError(
      `Batas ${label} harian tercapai. Ini melindungi kapasitas node. Coba lagi besok.`,
    );
  }
}
