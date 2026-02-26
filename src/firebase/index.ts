
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// IMPORTANTE: Garantiza una única instancia de Firebase para evitar conflictos de tokens
export function initializeFirebase() {
  let app: FirebaseApp;

  if (!getApps().length) {
    try {
      // Intento de inicialización vía App Hosting
      app = initializeApp();
    } catch (e) {
      // Fallback a config estático
      app = initializeApp(firebaseConfig);
    }
  } else {
    app = getApp();
  }

  return getSdks(app);
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
