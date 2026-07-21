/**
 * One-off read-only audit: hitung nft_units dengan harga_jual == harga_dasar
 * (community_config/v1) saat ini. Tidak mengubah data apa pun.
 *
 * Jalankan: npx tsx scripts/count-nft-at-harga-dasar.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Paksa Admin SDK menyasar Firestore PRODUCTION, bukan emulator lokal
// (script ini butuh baca data production untuk audit).
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const keyBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!keyBase64) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak ditemukan di .env.local');
}
const serviceAccount = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  console.log(`Menghubungi project: ${serviceAccount.project_id}\n`);

  const configSnap = await db.collection('community_config').doc('v1').get();
  if (!configSnap.exists) throw new Error('community_config/v1 tidak ditemukan');
  const hargaDasar = configSnap.data()!.harga_dasar;
  console.log(`harga_dasar saat ini: ${hargaDasar}\n`);

  const totalSnap = await db.collection('nft_units').count().get();
  const atHargaDasarSnap = await db.collection('nft_units')
    .where('harga_jual', '==', hargaDasar)
    .count()
    .get();

  console.log(`Total nft_units: ${totalSnap.data().count}`);
  console.log(`nft_units dengan harga_jual == harga_dasar (${hargaDasar}): ${atHargaDasarSnap.data().count}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
