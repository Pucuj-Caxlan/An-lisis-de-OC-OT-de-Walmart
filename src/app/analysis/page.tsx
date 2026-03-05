
"use client"

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  RefreshCcw, 
  ShieldCheck,
  Loader2,
  Layers
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
import { 
  normalizeFormatName, 
  normalizeCoordinator, 
  normalizeStage,
  normalizePlan,
  FORMAT_LABELS, 
  NormalizedFormat 
} from '@/lib/excel-processor';
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

  const purgeCollectionCompletely = async (db: Firestore, collPath: string) => {
    let hasMore = true;
    while (hasMore) {
      const snap = await getDocs(query(collection(db, collPath), limit(500)));
      if (snap.empty) {
        hasMore = false;
        break;
      }
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit().catch(() => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: collPath,
          operation: 'delete'
        }));
      });
      if (snap.size < 500) hasMore = false;
    }
  };

  const handleDeepSyncAndBackfill = async () => {
    if (!db || !user) return;
    setIsSyncing(true);
    setSyncSyncProgress(0);

    try {
      setSyncStep('Validando Universo Base (orders)...');
      const totalSnapshot = await getCountFromServer(collection(db, 'orders'));
      const totalCount = totalSnapshot.data().count;

      setSyncStep('Fase de Purga Profunda: Limpiando agregados antiguos...');
      const collectionsToPurge = [
        'taxonomy_formats', 
        'taxonomy_disciplines', 
        'hitos_analytics',
        'taxonomy_coordinators',
        'taxonomy_stages',
        'taxonomy_plans'
      ];
      for (const coll of collectionsToPurge) {
        await purgeCollectionCompletely(db, coll);
      }

      setSyncStep('Fase de Backfill & Normalización...');
      let processed = 0;
      let lastVisible = null;
      let hasMore = true;
      const CHUNK_SIZE = 400;

      const buildMetadata = {
        source_collection: 'orders',
        source_count: totalCount,
        build_timestamp: new Date().toISOString(),
        build_version: '4.0.0-multidimensional-plan'
      };

      const globalFormatStats: Record<string, any> = {};
      const globalDisciplineStats: Record<string, any> = {};
      const coordinators = new Set<string>();
      const stages = new Set<string>();
      const plans = new Set<string>();

      const hitosAgg: Record<string, { 
        impact: number, 
        count: number, 
        year: number, 
        month: number, 
        format: string, 
        coordinator: string, 
        stage: string, 
        plan: string,
        discipline: string 
      }> = {};

      while (hasMore) {
        let q = query(collection(db, 'orders'), orderBy(documentId()), limit(CHUNK_SIZE));
        if (lastVisible) q = query(q, startAfter(lastVisible));
        
        const snap = await getDocs(q);
        if (snap.empty) { hasMore = false; break; }

        const batch = writeBatch(db);
        
        snap.forEach(d => {
          const data = d.data();
          const impact = Number(data.impactoNeto || 0);
          
          const format = normalizeFormatName(data.format || data.format_origin || 'OTRO');
          const disc = String(data.disciplina_normalizada || 'PENDIENTE').trim().toUpperCase();
          const coord = normalizeCoordinator(data.coordinador || data.coordinador_normalizado);
          const stage = normalizeStage(data.etapa || data.etapa_proyecto_normalizada);
          const plan = normalizePlan(data.plan || data.plan_nombre_normalizado);
          
          const date = new Date(data.fecha_oc_ot || data.processedAt || new Date().toISOString());
          const year = isNaN(date.getFullYear()) ? 2024 : date.getFullYear();
          const month = isNaN(date.getMonth()) ? 1 : date.getMonth() + 1;

          batch.update(doc(db, 'orders', d.id), {
            format_normalized: format,
            coordinador_normalizado: coord,
            etapa_proyecto_normalizada: stage,
            plan_nombre_normalizado: plan,
            year,
            month,
            lastSync: buildMetadata.build_timestamp
          });

          coordinators.add(coord);
          stages.add(stage);
          plans.add(plan);

          if (!globalFormatStats[format]) globalFormatStats[format] = { impact: 0, count: 0 };
          globalFormatStats[format].impact += impact;
          globalFormatStats[format].count += 1;

          if (!globalDisciplineStats[disc]) globalDisciplineStats[disc] = { impact: 0, count: 0, name: disc };
          globalDisciplineStats[disc].impact += impact;
          globalDisciplineStats[disc].count += 1;

          const aggKey = `${year}_${month}_${format}_${coord.replace(/\s+/g, '_')}_${stage.replace(/\s+/g, '_')}_${plan.replace(/\s+/g, '_')}_${disc.replace(/\s+/g, '_')}`.substring(0, 500);
          if (!hitosAgg[aggKey]) {
            hitosAgg[aggKey] = { 
              impact: 0, count: 0, year, month, format, coordinator: coord, stage, plan, discipline: disc 
            };
          }
          hitosAgg[aggKey].impact += impact;
          hitosAgg[aggKey].count += 1;
        });

        await batch.commit();
        processed += snap.size;
        setSyncSyncProgress(Math.round((processed / Math.max(1, totalCount)) * 100));
        lastVisible = snap.docs[snap.docs.length - 1];
        if (snap.size < CHUNK_SIZE) hasMore = false;
      }

      setSyncStep('Guardando Vistas Materializadas...');
      
      await setDoc(doc(db, 'aggregates', 'global_stats'), {
        ...buildMetadata,
        totalImpact: Object.values(globalDisciplineStats).reduce((a: any, b: any) => a + b.impact, 0),
        totalOrders: totalCount,
        totalProcessed: processed
      });

      for (const [id, data] of Object.entries(globalFormatStats)) {
        await setDoc(doc(db, 'taxonomy_formats', id), {
          ...data, id, name: FORMAT_LABELS[id as NormalizedFormat] || id, updatedAt: buildMetadata.build_timestamp
        });
      }

      for (const [id, data] of Object.entries(globalDisciplineStats)) {
        const safeId = id.replace(/\s+/g, '_').substring(0, 100);
        await setDoc(doc(db, 'taxonomy_disciplines', safeId), {
          ...data, id: safeId, name: id, updatedAt: buildMetadata.build_timestamp
        });
      }

      for (const coord of Array.from(coordinators)) {
        const safeId = coord.replace(/[\/\s\.]+/g, '_').substring(0, 100);
        await setDoc(doc(db, 'taxonomy_coordinators', safeId), { id: safeId, name: coord });
      }

      for (const stage of Array.from(stages)) {
        const safeId = stage.replace(/[\/\s\.]+/g, '_').substring(0, 100);
        await setDoc(doc(db, 'taxonomy_stages', safeId), { id: safeId, name: stage });
      }

      for (const plan of Array.from(plans)) {
        const safeId = plan.replace(/[\/\s\.]+/g, '_').substring(0, 100);
        await setDoc(doc(db, 'taxonomy_plans', safeId), { id: safeId, name: plan });
      }

      setSyncStep('Finalizando Agregados Multidimensionales...');
      const hitosEntries = Object.entries(hitosAgg);
      for (let i = 0; i < hitosEntries.length; i += 400) {
        const chunk = hitosEntries.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(([key, val]) => {
          batch.set(doc(db, 'hitos_analytics', key), { ...val, lastUpdate: buildMetadata.build_timestamp });
        });
        await batch.commit();
      }

      toast({ title: "Sincronización Exitosa", description: "Universo reconstruido con agregados multidimensionales de Plan." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error en Sincronización", description: e.message });
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
                  <p className="text-[10px] font-black text-accent uppercase tracking-widest">Protocolo Forense 4.0 Activo</p>
                  <h3 className="text-2xl font-bold uppercase">{syncStep}</h3>
                </div>
                <span className="text-4xl font-black text-accent">{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} className="h-3 bg-white/10" />
              <p className="text-xs text-slate-400 italic">Construyendo agregados por Coordinador, Etapa, Plan y Formato para análisis de Hitos Principales.</p>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-primary">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Universo Base (Orders)</p>
              <h2 className="text-3xl font-black">{(globalAgg?.totalOrders || 0).toLocaleString()}</h2>
            </Card>
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Impacto Global Acumulado</p>
              <h2 className="text-3xl font-black">${(Number(globalAgg?.totalImpact || 0) / 1000000).toFixed(1)}M</h2>
            </Card>
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-accent">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Estatus de Analítica</p>
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <ShieldCheck className="h-5 w-5" /> SSOT 4.0 Multidimensional
              </div>
            </Card>
          </div>

          <Card className="p-10 border-none shadow-sm bg-white/50 border-2 border-dashed">
             <div className="flex items-center gap-4 mb-6">
               <Layers className="h-10 w-10 text-slate-300" />
               <div className="space-y-1">
                 <h4 className="text-sm font-black uppercase text-slate-800">Trazabilidad Multidimensional (Plan included)</h4>
                 <p className="text-xs text-slate-500">La nueva arquitectura permite segmentar por Plan, Coordinador y Etapa del Proyecto con alto rendimiento.</p>
               </div>
             </div>
             <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase border-b pb-2">
                  <span>Métrica</span>
                  <span>Valor en Base</span>
                </div>
                <div className="flex justify-between text-xs py-2 border-b border-slate-100">
                  <span className="text-slate-500">Versión del Agregado</span>
                  <span className="font-bold">{globalAgg?.build_version || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-xs py-2 border-b border-slate-100">
                  <span className="text-slate-500">Última Sincronización</span>
                  <span className="font-bold">{globalAgg?.build_timestamp ? new Date(globalAgg.build_timestamp).toLocaleString() : 'Pendiente'}</span>
                </div>
                <div className="flex justify-between text-xs py-2">
                  <span className="text-slate-500">Integridad de Registros</span>
                  <span className={`font-black ${globalAgg?.totalOrders === globalAgg?.totalProcessed ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {globalAgg?.totalOrders === globalAgg?.totalProcessed ? 'Sincronizado' : 'Desajustado'}
                  </span>
                </div>
             </div>
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
