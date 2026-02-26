
'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useFirebase } from '@/firebase/provider';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
  snapshot: QuerySnapshot<DocumentData> | null;
}

export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Improved error handling to differentiate permission issues from logic errors.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionResult<T> {
  const { isAuthReady, user } = useFirebase();
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [snapshot, setSnapshot] = useState<QuerySnapshot<DocumentData> | null>(null);

  useEffect(() => {
    if (!isAuthReady || !user || !memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      setSnapshot(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snap: QuerySnapshot<DocumentData>) => {
        const results: WithId<T>[] = [];
        for (const doc of snap.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        setData(results);
        setSnapshot(snap);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        const path: string =
          memoizedTargetRefOrQuery.type === 'collection'
            ? (memoizedTargetRefOrQuery as CollectionReference).path
            : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString();

        // Log exhaustivo para diagnóstico forense
        console.error(`[useCollection] Error Code: ${err.code} | Path: ${path}`, err);

        if (err.code === 'permission-denied') {
          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path,
          });
          setError(contextualError);
          errorEmitter.emit('permission-error', contextualError);
        } else {
          // Propagar otros errores (ej. invalid-argument por límites excedidos)
          setError(err);
        }
        
        setData(null);
        setSnapshot(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery, isAuthReady, user]); 

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }

  return { data, isLoading, error, snapshot };
}
