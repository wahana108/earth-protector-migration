/**
 * Verifikasi manual end-to-end alur verified-signup terhadap emulator.
 * Menguji fungsi ASLI di src/lib/auth.ts (bukan mock).
 * Env vars (NEXT_PUBLIC_USE_EMULATOR dll) di-set lewat shell SEBELUM
 * menjalankan script ini (lihat perintah run), bukan di dalam file —
 * ESM static import di-hoist sehingga assignment process.env di sini
 * akan terlambat untuk mempengaruhi src/lib/firebase.ts.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from '../src/lib/firebase';
import {
  signUpWithEmail, signInWithEmail, UnverifiedEmailError, resendVerificationEmailFor,
} from '../src/lib/auth';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';

initializeApp({ projectId: 'migration-earth-project' });
const adminAuth = getAdminAuth();
const adminDb = getAdminFirestore();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  OK: ${msg}`);
}

async function main() {
  const email = `test-${Date.now()}@example.com`;
  const password = 'password123';

  console.log('\n1. Sign up (unverified) — dokumen users/{uid} TIDAK boleh dibuat');
  const signedUpUser = await signUpWithEmail({ email, password });
  assert(!!signedUpUser.uid, 'signUp mengembalikan user');
  assert(auth.currentUser === null, 'signUp melakukan signOut (currentUser null)');

  let docSnap = await adminDb.collection('users').doc(signedUpUser.uid).get();
  assert(!docSnap.exists, 'dokumen users/{uid} belum ada setelah signup (belum verified)');

  console.log('\n2. Login sebelum verifikasi — harus UnverifiedEmailError + signOut');
  let threw = false;
  try {
    await signInWithEmail({ email, password });
  } catch (err) {
    threw = err instanceof UnverifiedEmailError;
  }
  assert(threw, 'signInWithEmail melempar UnverifiedEmailError');
  assert(auth.currentUser === null, 'signOut lagi setelah gagal login unverified');

  docSnap = await adminDb.collection('users').doc(signedUpUser.uid).get();
  assert(!docSnap.exists, 'dokumen users/{uid} MASIH belum ada setelah percobaan login unverified');

  console.log('\n3. Resend verification (self-contained, tanpa currentUser)');
  await resendVerificationEmailFor({ email, password });
  assert(auth.currentUser === null, 'signOut lagi setelah resend');
  console.log('  OK: resend tidak melempar error');

  console.log('\n4. Verifikasi email via Admin SDK (simulasi klik link)');
  await adminAuth.updateUser(signedUpUser.uid, { emailVerified: true });
  console.log('  OK: emailVerified di-set true');

  console.log('\n5. Login setelah verified — sesi harus tetap aktif (tidak di-signOut)');
  const loggedInUser = await signInWithEmail({ email, password });
  assert(loggedInUser.uid === signedUpUser.uid, 'login berhasil, uid sama');
  assert(auth.currentUser?.uid === signedUpUser.uid, 'sesi tetap aktif (verified, tidak di-signOut)');
  await signOut(auth);

  console.log('\n6. Rules: create dokumen langsung via Firestore SDK dengan token belum verified harus DITOLAK');
  const email2 = `test2-${Date.now()}@example.com`;
  const password2 = 'password123';
  await adminAuth.createUser({ email: email2, password: password2, emailVerified: false });
  const cred2 = await signInWithEmailAndPassword(auth, email2, password2);
  let denied = false;
  try {
    await setDoc(doc(db, 'users', cred2.user.uid), { uid: cred2.user.uid, email: email2 });
  } catch (err: any) {
    denied = err.code === 'permission-denied';
  }
  assert(denied, 'setDoc users/{uid} DITOLAK rules saat token email_verified=false');
  await signOut(auth);

  console.log('\n7. Rules: create dokumen setelah verified + relogin — HARUS DIIZINKAN (mensimulasikan fetchUserProfile fallback)');
  await adminAuth.updateUser(cred2.user.uid, { emailVerified: true });
  const cred2b = await signInWithEmailAndPassword(auth, email2, password2);
  await setDoc(doc(db, 'users', cred2b.user.uid), { uid: cred2b.user.uid, email: email2 });
  const docSnap2 = await getDoc(doc(db, 'users', cred2b.user.uid));
  assert(docSnap2.exists(), 'setDoc users/{uid} DIIZINKAN setelah email_verified=true (token direfresh via relogin)');

  console.log('\nSemua pengecekan lolos.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
