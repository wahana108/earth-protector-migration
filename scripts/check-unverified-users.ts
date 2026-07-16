/**
 * One-off read-only check: user Firebase Auth production dengan emailVerified
 * false, dan apakah mereka sudah punya dokumen users/{uid} di Firestore.
 * Tidak mengubah data apa pun.
 *
 * Jalankan: npx tsx scripts/check-unverified-users.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Paksa Admin SDK menyasar Firestore PRODUCTION, bukan emulator lokal
// (script ini butuh baca data production untuk audit).
delete process.env.FIRESTORE_EMULATOR_HOST;
delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const keyBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!keyBase64) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak ditemukan di .env.local');
}
const serviceAccount = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

async function main() {
  console.log(`Menghubungi project: ${serviceAccount.project_id}\n`);

  let unverified: { uid: string; email: string | undefined; createdAt: string | undefined }[] = [];
  let pageToken: string | undefined;
  let totalAuthUsers = 0;

  do {
    const page = await auth.listUsers(1000, pageToken);
    totalAuthUsers += page.users.length;
    for (const u of page.users) {
      if (!u.emailVerified && u.providerData.some(p => p.providerId === 'password')) {
        unverified.push({ uid: u.uid, email: u.email, createdAt: u.metadata.creationTime });
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);

  console.log(`Total user Firebase Auth: ${totalAuthUsers}`);
  console.log(`Total unverified (password provider): ${unverified.length}\n`);

  if (unverified.length > 0) {
    let withDoc = 0;
    let withoutDoc = 0;
    for (const u of unverified) {
      const snap = await db.collection('users').doc(u.uid).get();
      if (snap.exists) withDoc++; else withoutDoc++;
    }
    console.log(`  - punya dokumen users/{uid}: ${withDoc}`);
    console.log(`  - tanpa dokumen users/{uid}: ${withoutDoc}\n`);

    console.log('Daftar (uid, email, createdAt):');
    for (const u of unverified) {
      console.log(`  ${u.uid}  ${u.email ?? '(no email)'}  ${u.createdAt ?? ''}`);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
