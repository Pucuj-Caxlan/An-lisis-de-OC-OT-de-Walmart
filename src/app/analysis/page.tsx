
"use client"

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  RefreshCcw, 
  CheckCircle2, 
  DollarSign,
  Layers,
  Sparkles,
  Loader2,
  AlertTriangle
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
  getCountFromServer
} from 'firebase/firestore';
import { normalizeFormatName, FORMAT_LABELS, NormalizedFormat } from '@/lib/excel-processor';
import { Progress } from '@/components/ui/progress';

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncSyncProgress] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const aggRef = doc(db!, 'aggregates', 'global_stats');
  const { data: globalAgg } = useDoc(aggRef);

  const handleDeepSyncAndBackfill = async () => {
    if (!db || !user) return;
    setIsSyncing(true);
    setSyncSyncProgress(0);

    try {
      const colRef = collection(db, 'orders');
      const totalSnapshot = await getCountFromServer(colRef);
      const totalCount = totalSnapshot.data().count;
      
      let processed = 0;
      let lastVisible = null;
      let hasMore = true;
      const CHUNK_SIZE = 500;

      // Mapas de agregación materializada
      const globalFormatStats: Record<string, { impact: number, count: number, disciplines: Record<string, { impact: number, count: number }> }> = {};

      toast({ title: "Iniciando Backfill Masivo", description: `Procesando ${totalCount} registros...` });

      while (hasMore) {
        let q = query(colRef, orderBy(documentId()), limit(CHUNK_SIZE));
        if (lastVisible) q = query(q, startAfter(lastVisible));
        
        const snap = await getDocs(q);
        if (snap.empty) { hasMore = false; break; }

        const batch = writeBatch(db);
        
        snap.forEach(d => {
          const data = d.data();
          const rawFormat = data.format || data.format_origin || '';
          const normalized = normalizeFormatName(rawFormat);
          const impact = Number(data.impactoNeto || 0);
          const disc = String(data.disciplina_normalizada || 'PENDIENTE').trim().toUpperCase();

          // 1. Enriquecer documento
          batch.update(doc(db, 'orders', d.id), {
            format_normalized: normalized,
            format_origin: rawFormat,
            lastSync: new Date().toISOString()
          });

          // 2. Acumular Agregados
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
        });

        await batch.commit();
        processed += snap.size;
        setSyncSyncProgress(Math.round((processed / totalCount) * 100));
        lastVisible = snap.docs[snap.docs.length - 1];
        if (snap.size < CHUNK_SIZE) hasMore = false;
      }

      // 3. Persistir Vistas Materializadas (Aggregates)
      toast({ title: "Generando Vistas Materializadas", description: "Optimizando Dashboard VP..." });
      
      for (const [formatId, stats] of Object.entries(globalFormatStats)) {
        // Guardar total del formato
        await setDoc(doc(db, 'aggregates', 'format_analytics', 'formats', formatId), {
          id: formatId,
          label: FORMAT_LABELS[formatId as NormalizedFormat],
          totalImpact: stats.impact,
          totalOrders: stats.count,
          lastUpdate: new Date().toISOString()
        });

        // Guardar desglose de disciplinas por formato (para Treemap instantáneo)
        const discBatch = writeBatch(db);
        Object.entries(stats.disciplines).forEach(([discName, dStats]) => {
          const safeDiscId = discName.replace(/[\/\s\.]+/g, '_');
          discBatch.set(doc(db, 'aggregates', 'format_analytics', 'formats', formatId, 'disciplines_stats', safeDiscId), {
            name: discName,
            impact: dStats.impact,
            count: dStats.count
          });
        });
        await discBatch.commit();

        // Actualizar catálogo de filtros
        await setDoc(doc(db, 'taxonomy_formats', formatId), {
          id: formatId,
          name: FORMAT_LABELS[formatId as NormalizedFormat],
          count: stats.count
        });
      }

      toast({ title: "Sincronización Exitosa", description: "Universo 80/20 reconstruido al 100%." });
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error en Backfill", description: e.message });
    } finally {
      setIsSyncing(false);
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
            Sincronizar Hitos (Backfill 10k+)
          </Button>
        </header>

        <main className="p-8 space-y-8">
          {isSyncing && (
            <Card className="p-8 border-none shadow-xl bg-slate-900 text-white space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-accent uppercase tracking-widest">Estado del Proceso</p>
                  <h3 className="text-2xl font-bold">NORMALIZANDO UNIVERSO REAL</h3>
                </div>
                <span className="text-4xl font-black text-accent">{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} className="h-3 bg-white/10" />
              <p className="text-xs text-slate-400 italic">No cierre la ventana. Se están reconstruyendo las vistas materializadas para el Dashboard de Vicepresidencia...</p>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-primary">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Registros Totales</p>
              <h2 className="text-3xl font-black">{(globalAgg?.totalOrders || 0).toLocaleString()}</h2>
            </Card>
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Impacto Global</p>
              <h2 className="text-3xl font-black">${(Number(globalAgg?.totalImpact || 0) / 1000000).toFixed(1)}M</h2>
            </Card>
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-accent">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Estado de Integridad</p>
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <CheckCircle2 className="h-5 w-5" /> 100% Sincronizado
              </div>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
