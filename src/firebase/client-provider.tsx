'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    const services = initializeFirebase();

    // ✅ Debug: confirm runtime Firebase project/environment
    // This helps detect "wrong project" / "wrong app" mismatches, the #1 cause of rules confusion.
    try {
      const { firebaseApp } = services;
      // Only log in development to avoid noisy production logs
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[FirebaseClientProvider] projectId:', firebaseApp.options.projectId);
        // eslint-disable-next-line no-console
        console.log('[FirebaseClientProvider] appId:', firebaseApp.options.appId);
        // eslint-disable-next-line no-console
        console.log('[FirebaseClientProvider] authDomain:', firebaseApp.options.authDomain);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[FirebaseClientProvider] Unable to log firebase app options:', err);
    }

    return services;
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}