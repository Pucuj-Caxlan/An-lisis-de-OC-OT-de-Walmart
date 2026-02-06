
'use client';

import React, { useEffect } from 'react';
import { useUser, useAuth } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { Loader2 } from 'lucide-react';

/**
 * Componente que asegura que el usuario esté autenticado (aunque sea de forma anónima)
 * antes de permitir el acceso a las rutas que consultan Firestore.
 */
export function AuthCheck({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  useEffect(() => {
    // Si no está cargando y no hay usuario, iniciamos sesión anónima
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // Mientras se determina el estado de autenticación inicial, mostramos un loader
  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground font-headline uppercase tracking-widest">
            Estableciendo sesión segura...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
