import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
  } from "firebase/auth";
  import { app } from "./firebase";
  
  export type AuthCredentials = {
    email: string;
    password: string;
  };
  
  const auth = getAuth(app);
  
  export async function signUpWithEmail({ email, password }: AuthCredentials) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // In a real app, you would also create a user profile document in Firestore here.
      return userCredential.user;
    } catch (error: any) {
      // You can add more specific error handling here
      throw new Error(error.message || 'Failed to sign up.');
    }
  }
  
  export async function signInWithEmail({ email, password }: AuthCredentials) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error: any) {
        throw new Error(error.message || 'Failed to sign in.');
    }
  }
  
  export async function signOutUser() {
    try {
      await signOut(auth);
    } catch (error: any) {
        throw new Error(error.message || 'Failed to sign out.');
    }
  }
  