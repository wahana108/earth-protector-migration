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
import { getCommunityConfig } from "@/lib/community-config";
import { maybeAutoRecalculate } from "@/lib/projects";
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
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isModerator: boolean;
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
      pending_seller_actions: (data.pending_seller_actions as number) ?? 0,
      pending_buyback_actions: (data.pending_buyback_actions as number) ?? 0,
      total_poin_pending: (data.total_poin_pending as number) ?? 0,
      badge_kontributor: (data.badge_kontributor as boolean) ?? false,
      total_kontribusi: (data.total_kontribusi as number) ?? 0,
      lapak_aktif: (data.lapak_aktif as boolean) ?? true,
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
  // User baru mengubah N komunitas → kuota Fibonacci bisa berubah
  maybeAutoRecalculate().catch(() => {});

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
    badge_kontributor: false,
    total_kontribusi: 0,
    lapak_aktif: true,
  };
}

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? '';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userState) => {
      setFirebaseUser(userState);
      if (userState) {
        const appUser = await fetchUserProfile(userState);
        setUser(appUser);

        const email = userState.email ?? '';
        const superAdmin = email === SUPER_ADMIN_EMAIL;
        setIsSuperAdmin(superAdmin);
        if (superAdmin) {
          setIsAdmin(true);
          setIsModerator(true);
        } else {
          try {
            const config = await getCommunityConfig();
            const adminFlag = (config?.admin_emails ?? []).includes(email);
            const modFlag = adminFlag || (config?.moderator_emails ?? []).includes(email);
            setIsAdmin(adminFlag);
            setIsModerator(modFlag);
          } catch {
            setIsAdmin(false);
            setIsModerator(false);
          }
        }

        document.cookie = "__session=1; path=/; SameSite=Lax";
      } else {
        setUser(null);
        setIsSuperAdmin(false);
        setIsAdmin(false);
        setIsModerator(false);
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
    isSuperAdmin,
    isAdmin,
    isModerator,
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
