
'use client';

import { Firestore, writeBatch, doc, collection, query, where, getDocs, deleteDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { User } from 'firebase/auth';

export type DeletionMode = 'single' | 'bulk' | 'all';

export interface DeletionJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  mode: DeletionMode;
  progress: number;
  total: number;
  deletedCount: number;
  filters?: any;
  startedAt: string;
  completedAt?: string;
  userId: string;
}

export async function executeDeletion(
  db: Firestore, 
  user: User, 
  mode: DeletionMode, 
  ids: string[] = [], 
  filters: any = {}
) {
  const jobId = `job_${Date.now()}`;
  const jobRef = doc(db, 'deletion_jobs', jobId);

  // 1. Initialize Job
  await setDoc(jobRef, {
    id: jobId,
    status: 'running',
    mode,
    progress: 0,
    total: ids.length,
    deletedCount: 0,
    filters,
    startedAt: new Date().toISOString(),
    userId: user.uid
  });

  let totalDeleted = 0;
  let totalImpact = 0;

  try {
    // 2. Resolve IDs if mode is 'all' (filtered)
    let targetIds = [...ids];
    if (mode === 'all') {
      // Logic for all would query Firestore based on filters
      // For this MVP, we rely on the IDs passed from the filtered UI view
      // targetIds = await resolveFilteredIds(db, filters);
    }

    const total = targetIds.length;
    
    // 3. Batch Process
    const batchSize = 400; // Safe limit for Firestore (max 500)
    for (let i = 0; i < targetIds.length; i += batchSize) {
      const chunk = targetIds.slice(i, i + batchSize);
      const batch = writeBatch(db);
      
      chunk.forEach(id => {
        const docRef = doc(db, 'orders', id);
        batch.delete(docRef);
      });

      await batch.commit();
      totalDeleted += chunk.length;
      
      // Update Job Progress
      await updateDoc(jobRef, {
        progress: Math.round((totalDeleted / total) * 100),
        deletedCount: totalDeleted
      });
    }

    // 4. Audit Log
    const logId = `log_${Date.now()}`;
    await setDoc(doc(db, 'audit_logs', logId), {
      id: logId,
      action: mode === 'single' ? 'delete_single' : (mode === 'bulk' ? 'delete_bulk' : 'delete_all'),
      userId: user.uid,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      details: {
        count: totalDeleted,
        filters,
        jobId
      }
    });

    // 5. Finalize Job
    await updateDoc(jobRef, {
      status: 'done',
      progress: 100,
      completedAt: new Date().toISOString()
    });

    return { success: true, count: totalDeleted };

  } catch (error: any) {
    console.error("Deletion Failed:", error);
    await updateDoc(jobRef, {
      status: 'failed',
      error: error.message
    });
    throw error;
  }
}
