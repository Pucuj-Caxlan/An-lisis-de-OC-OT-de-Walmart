
"use client"

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  RefreshCcw, 
  ShieldCheck,
  Loader2,
  History
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { 
  collection, 
  query, 
  limit, 
  doc, 
  getDocs, 
  writeBatch, 
  documentId,
  startAfter,
  setDoc,
  orderBy,
  getCountFromServer,
  Firestore
} from 'firebase/firestore';
import { normalizeFormatName, FORMAT_LABELS, NormalizedFormat } from '@/lib/excel-processor';
import { Progress } from '@/components/ui/progress';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncSyncProgress] = useState(0);
  const [syncStep, setSyncStep] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const aggRef = doc(db!, 'aggregates', 'global_stats');
  const { data: globalAgg } = useDoc(aggRef);

  /**
   * Helper robusto para guardar taxonomías en bloques de 500
   */
  const saveTaxonomyInChunks = async (db: Firestore, collPath: string, stats: Record<string, any>, buildMetadata: any) => {
    const entries = Object.entries(stats);
    const CHUNK_SIZE = 400; // Conservador frente al límite de 500

    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      
      chunk.forEach(([id, data]) => {
        const safeId = id.replace(/[\/\s\.]+/g, '_').substring(0, 100);
        const docRef = doc(db, collPath, safeId);
        batch.set(docRef, {
          ...data,
          ...buildMetadata,
          id: safeId,
          updatedAt: new Date().toISOString()
        });
      });

      await batch.commit().catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: collPath,
          operation: 'write'
        }));
      });
    }
  };

  const handleDeepSyncAndBackfill = async () => {
    if (!db || !user) return;
    setIsSyncing(true);
    setSyncSyncProgress(0);

    try {
      // 1. OBTENER CUENTA SSOT
      setSyncStep('Validando Universo Base (orders)...');
      const totalSnapshot = await getCountFromServer(collection(db, 'orders'));
      const totalCount = totalSnapshot.data().count;

      // 2. FASE DE PURGA
      setSyncStep('Fase de Purga: Eliminando Agregados Obsoletos...');
      const collectionsToPurge = ['taxonomy_formats', 'taxonomy_disciplines', 'taxonomy_causes'];
      for (const coll of collectionsToPurge) {
        const snap = await getDocs(query(collection(db, coll), limit(500)));
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.forEach(d => batch.delete(d.ref));
          await batch.commit().catch(() => {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
               path: coll,
               operation: 'delete'
             }));
          });
        }
      }

      // 3. FASE DE ESCANEO Y ACUMULACIÓN
      setSyncStep('Fase de Escaneo: Procesando registros...');
      let processed = 0;
      let lastVisible = null;
      let hasMore = true;
      const CHUNK_SIZE = 500;

      const buildMetadata = {
        source_collection: 'orders',
        source_count: totalCount,
        build_timestamp: new Date().toISOString(),
        build_version: '2.0.1-forensic'
      };

      const globalFormatStats: Record<string, { impact: number, count: number, disciplines: Record<string, { impact: number, count: number }> }> = {};
      const globalDisciplineStats: Record<string, { impact: number, count: number }> = {};

      while (hasMore) {
        let q = query(collection(db, 'orders'), orderBy(documentId()), limit(CHUNK_SIZE));
        if (lastVisible) q = query(q, startAfter(lastVisible));
        
        const snap = await getDocs(q);
        if (snap.empty) { hasMore = false; break; }

        const batch = writeBatch(db);
        
        snap.forEach(d => {
          const data = d.data();
          const rawFormat = data.format || data.format_origin || data.format_normalized || 'OTRO';
          const normalized = normalizeFormatName(rawFormat);
          const impact = Number(data.impactoNeto || 0);
          const disc = String(data.disciplina_normalizada || 'PENDIENTE').trim().toUpperCase();

          batch.update(doc(db, 'orders', d.id), {
            format_normalized: normalized,
            lastSync: buildMetadata.build_timestamp
          });

          if (!globalFormatStats[normalized]) {
            globalFormatStats[normalized] = { impact: 0, count: 0, disciplines: {} };
          }
          globalFormatStats[normalized].impact += impact;
          globalFormatStats[normalized].count += 1;

          if (!globalFormatStats[normalized].disciplines[disc]) {
            globalFormatStats[normalized].disciplines[disc] = { impact: 0, count: 0 };
          }
          globalFormatStats[normalized].disciplines[disc].impact += impact;
          globalFormatStats[normalized].disciplines[disc].count += 1;

          if (!globalDisciplineStats[disc]) {
            globalDisciplineStats[disc] = { impact: 0, count: 0 };
          }
          globalDisciplineStats[disc].impact += impact;
          globalDisciplineStats[disc].count += 1;
        });

        await batch.commit().catch(() => {
           errorEmitter.emit('permission-error', new FirestorePermissionError({
             path: 'orders',
             operation: 'update'
           }));
        });
        
        processed += snap.size;
        setSyncSyncProgress(Math.round((processed / Math.max(1, totalCount)) * 100));
        lastVisible = snap.docs[snap.docs.length - 1];
        if (snap.size < CHUNK_SIZE) hasMore = false;
      }

      // 4. PERSISTENCIA DE VISTAS MATERIALIZADAS
      setSyncStep('Finalizando Vistas Materializadas...');
      
      await setDoc(doc(db, 'aggregates', 'global_stats'), {
        ...buildMetadata,
        totalImpact: Object.values(globalDisciplineStats).reduce((a, b) => a + b.impact, 0),
        totalOrders: totalCount,
        totalProcessed: processed
      }).catch(() => {
         errorEmitter.emit('permission-error', new FirestorePermissionError({
           path: 'aggregates/global_stats',
           operation: 'write'
         }));
      });

      // Guardar Taxonomía de Disciplinas
      await saveTaxonomyInChunks(db, 'taxonomy_disciplines', globalDisciplineStats, buildMetadata);

      // Guardar Formatos y sus desgloses
      for (const [formatId, stats] of Object.entries(globalFormatStats)) {
        const formatRef = doc(db, 'taxonomy_formats', formatId);
        await setDoc(formatRef, {
          ...buildMetadata,
          id: formatId,
          name: FORMAT_LABELS[formatId as NormalizedFormat] || formatId,
          impact: stats.impact,
          count: stats.count
        });

        await setDoc(doc(db, 'aggregates', 'format_analytics', 'formats', formatId), {
          ...buildMetadata,
          totalImpact: stats.impact,
          totalOrders: stats.count
        });

        // Disciplinas por formato (Sub-agregado)
        await saveTaxonomyInChunks(
          db, 
          `aggregates/format_analytics/formats/${formatId}/disciplines_stats`, 
          stats.disciplines, 
          buildMetadata
        );
      }

      toast({ title: "Sincronización Exitosa", description: "Universo 80/20 reconstruido sin duplicados." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error en Reconstrucción", description: e.message });
    } finally {
      setIsSyncing(false);
      setSyncStep('');
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800 uppercase">Consola de Control de Universo</h1>
          </div>
          <Button 
            onClick={handleDeepSyncAndBackfill} 
            disabled={isSyncing}
            className="bg-primary hover:bg-primary/90 rounded-xl gap-2 h-10 px-6 shadow-lg"
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Sincronizar Hitos (Purge & Rebuild)
          </Button>
        </header>

        <main className="p-8 space-y-8">
          {isSyncing && (
            <Card className="p-8 border-none shadow-xl bg-slate-900 text-white space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-accent uppercase tracking-widest">Protocolo Forense Activo</p>
                  <h3 className="text-2xl font-bold uppercase">{syncStep}</h3>
                </div>
                <span className="text-4xl font-black text-accent">{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} className="h-3 bg-white/10" />
              <p className="text-xs text-slate-400 italic">Limpiando agregados obsoletos y reconstruyendo SSOT desde la colección orders...</p>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-primary">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Universo Base (Orders)</p>
              <h2 className="text-3xl font-black">{(globalAgg?.totalOrders || 0).toLocaleString()}</h2>
              {globalAgg?.build_timestamp && (
                <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold">Build: {new Date(globalAgg.build_timestamp).toLocaleString()}</p>
              )}
            </Card>
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Impacto Global Acumulado</p>
              <h2 className="text-3xl font-black">${(Number(globalAgg?.totalImpact || 0) / 1000000).toFixed(1)}M</h2>
              <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold">Ver: {globalAgg?.build_version || 'N/A'}</p>
            </Card>
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-accent">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Trazabilidad de Vistas</p>
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <ShieldCheck className="h-5 w-5" /> SSOT Sincronizado
              </div>
              <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold">Source: {globalAgg?.source_collection || 'orders'}</p>
            </Card>
          </div>

          <Card className="p-10 border-none shadow-sm bg-white/50 border-2 border-dashed">
             <div className="flex items-center gap-4 mb-6">
               <History className="h-10 w-10 text-slate-300" />
               <div className="space-y-1">
                 <h4 className="text-sm font-black uppercase text-slate-800">Historial de Integridad</h4>
                 <p className="text-xs text-slate-500">Cada vez que sincronizas, el sistema borra los conteos previos y vuelve a sumar desde cero para evitar duplicados.</p>
               </div>
             </div>
             <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase border-b pb-2">
                  <span>Métrica</span>
                  <span>Valor en Base</span>
                </div>
                <div className="flex justify-between text-xs py-2 border-b border-slate-100">
                  <span className="text-slate-500">Build Timestamp</span>
                  <span className="font-bold">{globalAgg?.build_timestamp || 'Pendiente'}</span>
                </div>
                <div className="flex justify-between text-xs py-2 border-b border-slate-100">
                  <span className="text-slate-500">Registros Procesados</span>
                  <span className="font-bold">{globalAgg?.totalProcessed || 0}</span>
                </div>
                <div className="flex justify-between text-xs py-2">
                  <span className="text-slate-500">Diferencia orders vs aggregates</span>
                  <span className={`font-black ${globalAgg?.totalOrders === globalAgg?.totalProcessed ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {(globalAgg?.totalOrders || 0) - (globalAgg?.totalProcessed || 0)}
                  </span>
                </div>
             </div>
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
