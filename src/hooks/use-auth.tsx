"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { User } from "@/lib/types";
import {
  signInWithEmail,
  signUpWithEmail,
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((userState) => {
      setFirebaseUser(userState);
      if (userState) {
        // In a real app, you would fetch the user profile from Firestore here
        // For this prototype, we'll create a mock user object
        const appUser: User = {
            id: userState.uid,
            email: userState.email,
            displayName: userState.displayName || userState.email?.split('@')[0] || 'Anonymous',
            photoURL: userState.photoURL || `https://picsum.photos/seed/${userState.uid}/100/100`,
            createdAt: new Date(userState.metadata.creationTime || Date.now()),
        };
        setUser(appUser);
      } else {
        setUser(null);
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
    signOut: signOutUser,
  };

  return (
    <AuthContext.Provider value={value}>
        {/* Shows a full-page skeleton loader while auth state is resolving */}
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
    )
}
