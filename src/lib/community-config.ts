import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { CommunityConfig } from './types';

const COLLECTION = 'community_config';
const DOC_ID = 'v1';

export const DEFAULT_COMMUNITY_CONFIG: Omit<CommunityConfig, 'updated_at' | 'updated_by'> = {
  harga_dasar: 100000,
  batas_atas: 150000,
  nilai_minimum_project: 3000000,
  nilai_maksimum_project: 10000000,
  minimum_buyback_pct: 50,
  fee_project_pct: { min: 2, max: 5 },
  fee_trigger_per_nft: 10,
  fee_infrastruktur_pct: 50,
  minimum_top_developer: 30,
  minimum_soldNfts_top_developer: 24,
  kapasitas_pool_minimum: 90,
  max_nft_in_pool_per_developer: 3,
  minimum_nft_pool_untuk_validasi: 90,
  minimum_holding_days: 7,
  purchase_autoclose_days: 7,
  max_projects_per_user: 10,
  min_realisasi_pct_untuk_create: 20,
  max_transactions_per_user_per_day: 20,
  max_projects_per_user_per_day: 2,
  max_comments_per_user_per_day: 30,
  max_projects_global_per_day: 20,
  max_comments_global_per_day: 300,
  ai_governance_enabled: false,
  ai_review_history_limit: 50,
  ai_review_history_days: 50,
  ai_anomali_divisor: 10,
  ai_anomali_min_skor: 30,
  ai_review_revert_days: 7,
  ai_auto_mode_enabled: false,
  ai_auto_interval_days: 30,
  ai_auto_max_devs_per_run: 10,
  super_admin_email: process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? '',
  admin_emails: [],
  moderator_emails: [],
  fase_aktif: 1,
  ai_provider: 'gemini',
  ai_anomali_threshold: { flag: 1, invalid: 100 },
};

export async function getCommunityConfig(): Promise<CommunityConfig | null> {
  const ref = doc(db, COLLECTION, DOC_ID);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    ...data,
    updated_at: (data.updated_at as Timestamp)?.toDate() ?? new Date(),
  } as CommunityConfig;
}

export async function seedCommunityConfig(adminUid: string): Promise<void> {
  const ref = doc(db, COLLECTION, DOC_ID);
  await setDoc(ref, {
    ...DEFAULT_COMMUNITY_CONFIG,
    updated_at: serverTimestamp(),
    updated_by: adminUid,
  });
}

export async function updateCommunityConfig(
  adminUid: string,
  updates: Partial<Omit<CommunityConfig, 'updated_at' | 'updated_by'>>
): Promise<void> {
  const ref = doc(db, COLLECTION, DOC_ID);
  await updateDoc(ref, {
    ...updates,
    updated_at: serverTimestamp(),
    updated_by: adminUid,
  });
}
