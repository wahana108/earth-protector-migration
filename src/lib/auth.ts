import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { app, db, googleProvider } from "./firebase";

export type AuthCredentials = {
  email: string;
  password: string;
};

const auth = getAuth(app);

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

export async function signUpWithEmail({ email, password }: AuthCredentials) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { user } = userCredential;
    await createUserDocumentIfNotExists(user.uid, {
      email: user.email,
      displayName: user.displayName || email.split("@")[0],
      photoURL: user.photoURL,
    });
    return user;
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign up.");
  }
}

export async function signInWithEmail({ email, password }: AuthCredentials) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(error.message || "Failed to sign in.");
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
