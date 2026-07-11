import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { ServiceAccount } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) return getApp();

  const keyBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!keyBase64) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY tidak ditemukan. ' +
      'Set env var dengan base64(JSON) dari Firebase console → Project Settings → Service Accounts → Generate new private key.',
    );
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(
      Buffer.from(keyBase64, 'base64').toString('utf-8'),
    ) as ServiceAccount;
  } catch {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY gagal di-parse. ' +
      'Pastikan formatnya base64(JSON service account) — bukan plain JSON, plain text, atau string lain.',
    );
  }

  return initializeApp({ credential: cert(serviceAccount) });
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
