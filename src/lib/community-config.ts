import { db } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { CommunityConfig } from './types';

const COLLECTION = 'community_config';
const DOC_ID = 'v1';

export const DEFAULT_COMMUNITY_CONFIG: Omit<CommunityConfig, 'updated_at' | 'updated_by'> = {
  harga_dasar: 100000,
  batas_atas: 150000,
  nilai_minimum_project: 3000000,
  minimum_buyback_pct: 50,
  fee_project_pct: { min: 2, max: 5 },
  minimum_top_developer: 30,
  kapasitas_pool_minimum: 90,
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
