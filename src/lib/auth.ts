import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { app, db, googleProvider } from "./firebase";

export type AuthCredentials = {
  email: string;
  password: string;
};

const auth = getAuth(app);

// Dilempar saat login berhasil secara kredensial tapi email belum
// diverifikasi. instanceof-checked di form login, bukan pesan generik.
export class UnverifiedEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnverifiedEmailError";
  }
}

async function createUserDocumentIfNotExists(uid: string, data: {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}) {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      createdAt: serverTimestamp(),
      totalLikes: 0,
      soldNfts: 0,
      buybackCount: 0,
      isTopDeveloper: false,
    });
  }
}

// Dokumen users/{uid} SENGAJA belum dibuat di sini — dibuat otomatis saat
// login pertama SETELAH email terverifikasi (lihat fetchUserProfile
// fallback di use-auth.tsx). Ini menutup celah spam: pendaftar yang tidak
// pernah verifikasi tidak pernah punya dokumen, tidak pernah ikut terhitung
// di totalUsers/kuota Fibonacci.
export async function signUpWithEmail({ email, password }: AuthCredentials) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { user } = userCredential;
    await sendEmailVerification(user);
    await signOut(auth);
    return user;
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign up.");
  }
}

export async function signInWithEmail({ email, password }: AuthCredentials) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const { user } = userCredential;
    if (!user.emailVerified) {
      await signOut(auth);
      throw new UnverifiedEmailError(
        "Email belum diverifikasi. Cek inbox Anda atau kirim ulang email verifikasi."
      );
    }
    return user;
  } catch (error: any) {
    if (error instanceof UnverifiedEmailError) throw error;
    throw new Error(error.message || "Failed to sign in.");
  }
}

// Dipakai tombol "Kirim ulang" di layar login unverified — sesi sebelumnya
// sudah di-signOut oleh signInWithEmail, jadi tidak ada auth.currentUser untuk
// dipakai ulang; login sebentar, kirim verifikasi, signOut lagi.
export async function resendVerificationEmailFor({ email, password }: AuthCredentials): Promise<void> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  try {
    await sendEmailVerification(userCredential.user);
  } finally {
    await signOut(auth);
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    // auth/user-not-found disembunyikan demi privasi — pesan generik tetap
    // "berhasil terkirim" ke pemanggil terlepas dari status pendaftaran email.
    if (error.code === "auth/user-not-found") return;
    throw new Error(error.message || "Failed to send password reset email.");
  }
}

export async function signInWithGoogle() {
  try {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const { user } = userCredential;
    await createUserDocumentIfNotExists(user.uid, {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    });
    return user;
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign in with Google.");
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign out.");
  }
}

export async function resendEmailVerification(): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Tidak ada user yang login.');
  await sendEmailVerification(currentUser);
}
