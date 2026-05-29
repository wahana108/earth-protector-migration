"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { User } from "@/lib/types";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOutUser,
  resendEmailVerification,
  AuthCredentials,
} from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  emailVerified: boolean;
  signIn: (credentials: AuthCredentials) => Promise<FirebaseUser>;
  signUp: (credentials: AuthCredentials) => Promise<FirebaseUser>;
  signInWithGoogle: () => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(firebaseUser: FirebaseUser): Promise<User> {
  const userRef = doc(db, "users", firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      id: firebaseUser.uid,
      email: data.email ?? firebaseUser.email,
      displayName: data.displayName ?? firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "Anonymous",
      photoURL: data.photoURL ?? firebaseUser.photoURL,
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
      totalLikes: data.totalLikes ?? 0,
      soldNfts: data.soldNfts ?? 0,
      buybackCount: data.buybackCount ?? 0,
      isTopDeveloper: data.isTopDeveloper ?? false,
    };
  }

  // Doc missing — covers race condition between onAuthStateChanged and
  // createUserDocumentIfNotExists in auth.ts, or a silent creation failure.
  // Creating here is safe: isMe(uid) rule passes because the user IS authenticated.
  const defaultData = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Anonymous",
    photoURL: firebaseUser.photoURL ?? null,
    createdAt: serverTimestamp(),
    totalLikes: 0,
    soldNfts: 0,
    buybackCount: 0,
    isTopDeveloper: false,
  };
  await setDoc(userRef, defaultData);

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: defaultData.displayName,
    photoURL: defaultData.photoURL,
    createdAt: new Date(),
    totalLikes: 0,
    soldNfts: 0,
    buybackCount: 0,
    isTopDeveloper: false,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userState) => {
      setFirebaseUser(userState);
      if (userState) {
        const appUser = await fetchUserProfile(userState);
        setUser(appUser);
        document.cookie = "__session=1; path=/; SameSite=Lax";
      } else {
        setUser(null);
        document.cookie = "__session=; path=/; Max-Age=0";
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    firebaseUser,
    loading,
    emailVerified: firebaseUser?.emailVerified ?? false,
    signIn: signInWithEmail,
    signUp: signUpWithEmail,
    signInWithGoogle,
    signOut: signOutUser,
    resendVerificationEmail: resendEmailVerification,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <AuthLoader /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

function AuthLoader() {
  return (
    <div className="w-full h-screen flex flex-col">
      <header className="p-4 border-b flex justify-between items-center">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </header>
      <div className="flex flex-1">
        <div className="w-64 p-4 border-r">
          <Skeleton className="h-8 w-full mb-4" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full mb-2" />
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
