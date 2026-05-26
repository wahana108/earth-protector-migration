"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { User } from "@/lib/types";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOutUser,
  AuthCredentials,
} from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (credentials: AuthCredentials) => Promise<FirebaseUser>;
  signUp: (credentials: AuthCredentials) => Promise<FirebaseUser>;
  signInWithGoogle: () => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
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
    };
  }

  return {
    id: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Anonymous",
    photoURL: firebaseUser.photoURL || `https://picsum.photos/seed/${firebaseUser.uid}/100/100`,
    createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
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
    signIn: signInWithEmail,
    signUp: signUpWithEmail,
    signInWithGoogle,
    signOut: signOutUser,
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
