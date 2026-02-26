
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, collection, query, limit, getDocs } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  isAuthReady: boolean;
}

export interface FirebaseContextState {
  areServicesAvailable: boolean; 
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null; 
  user: User | null;
  isUserLoading: boolean; 
  userError: Error | null;
  isAuthReady: boolean;
}

export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  isAuthReady: boolean;
}

export interface UserHookResult { 
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  isAuthReady: boolean;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true,
    userError: null,
    isAuthReady: false,
  });

  // 1. Diagnóstico de Identidad de Proyecto (CRÍTICO PARA DEBUG)
  useEffect(() => {
    if (firebaseApp) {
      console.log(
        "%c[Firebase Runtime] IDENTIDAD DE PROYECTO:",
        "background: #1E3A8A; color: #fff; padding: 4px; font-weight: bold;",
        {
          projectId: firebaseApp.options.projectId,
          appId: firebaseApp.options.appId,
          authDomain: firebaseApp.options.authDomain
        }
      );
    }
  }, [firebaseApp]);

  // 2. Suscripción a Estado de Autenticación
  useEffect(() => {
    if (!auth) {
      setUserAuthState(prev => ({ ...prev, isUserLoading: false, userError: new Error("Auth service missing."), isAuthReady: true }));
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        console.log("[Firebase Auth] Usuario detectado:", firebaseUser?.uid || "Ninguno");
        setUserAuthState({ 
          user: firebaseUser, 
          isUserLoading: false, 
          userError: null, 
          isAuthReady: true 
        });
      },
      (error) => {
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ 
          user: null, 
          isUserLoading: false, 
          userError: error, 
          isAuthReady: true 
        });
      }
    );
    return () => unsubscribe();
  }, [auth]);

  // 3. Test de Conectividad a /orders (Validación de Reglas)
  useEffect(() => {
    if (userAuthState.isAuthReady && userAuthState.user && firestore) {
      const testConnectivity = async () => {
        try {
          const testQuery = query(collection(firestore, 'orders'), limit(1));
          await getDocs(testQuery);
          console.log("%c[Firebase Debug] CONECTIVIDAD EXITOSA: Reglas OK para /orders", "color: #10B981; font-weight: bold;");
        } catch (e: any) {
          console.error("%c[Firebase Debug] CONECTIVIDAD FALLIDA: Reglas bloqueadas", "color: #F43F5E; font-weight: bold;", {
            code: e.code,
            message: e.message,
            projectId: firebaseApp.options.projectId
          });
        }
      };
      testConnectivity();
    }
  }, [userAuthState.isAuthReady, userAuthState.user, firestore, firebaseApp.options.projectId]);

  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
      isAuthReady: userAuthState.isAuthReady
    };
  }, [firebaseApp, firestore, auth, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
    throw new Error('Firebase core services not available.');
  }
  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
    isAuthReady: context.isAuthReady
  };
};

export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  return memoized;
}

export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError, isAuthReady } = useFirebase();
  return { user, isUserLoading, userError, isAuthReady };
};
