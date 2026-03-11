
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

/**
 * Inicializa la instancia de Firebase garantizando un Singleton.
 * Se prefiere la configuración explícita para evitar errores de conexión
 * en entornos de pre-visualización de Workstations.
 */
export function initializeFirebase() {
  let app: FirebaseApp;

  if (!getApps().length) {
    // Siempre usar la configuración explícita para máxima estabilidad
    app = initializeApp(firebaseConfig);
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
