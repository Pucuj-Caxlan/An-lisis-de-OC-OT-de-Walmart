
"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  RefreshCcw, 
  ShieldCheck,
  Loader2,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  FileText,
  List
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
  endBefore,
  setDoc,
  orderBy,
  getCountFromServer,
  Firestore,
  updateDoc,
  limitToLast
} from 'firebase/firestore';
import { 
  normalizeFormatName, 
  normalizeCoordinator, 
  normalizeStage,
  normalizePlan,
  normalizeDiscipline,
  normalizeSubCause,
  normalizeState,
  normalizeMunicipality,
  normalizeRootCause
} from '@/lib/excel-processor';
import { Progress } from '@/components/ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const isProcessingRef = useRef(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStep, setSyncStep] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const lastDocRef = useRef<any>(null);
  const firstDocRef = useRef<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [isProcessingAI, setIsProcessingAI] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const aggRef = doc(db!, 'aggregates', 'global_stats');
  const { data: globalAgg } = useDoc(aggRef);

  const fetchOrders = useCallback(async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    if (!db || isLoadingOrders) return;
    setIsLoadingOrders(true);
    try {
      if (direction === 'initial') {
        const countSnap = await getCountFromServer(collection(db, 'orders'));
        setTotalCount(countSnap.data().count);
      }

      let q = query(collection(db, 'orders'), orderBy(documentId()), limit(pageSize));
      
      if (direction === 'next' && lastDocRef.current) {
        q = query(collection(db, 'orders'), orderBy(documentId()), startAfter(lastDocRef.current), limit(pageSize));
      } else if (direction === 'prev' && firstDocRef.current) {
        q = query(collection(db, 'orders'), orderBy(documentId()), endBefore(firstDocRef.current), limitToLast(pageSize));
      }

      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      
      if (results.length > 0) {
        setOrders(results);
        firstDocRef.current = snap.docs[0];
        lastDocRef.current = snap.docs[snap.docs.length - 1];
      } else if (direction === 'initial') {
        setOrders([]);
      }
    } catch (e: any) {
      console.error("Fetch error:", e);
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: "No se pudieron obtener los registros. Reintente en unos momentos."
      });
    } finally {
      setIsLoadingOrders(false);
    }
  }, [db, toast, pageSize]);

  useEffect(() => {
    if (db && mounted && !isSyncing) {
      fetchOrders('initial');
    }
  }, [db, mounted, pageSize, isSyncing, fetchOrders]);

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value));
    setCurrentPage(1);
    firstDocRef.current = null;
    lastDocRef.current = null;
  };

  const handleProcessAI = async (order: any) => {
    setIsProcessingAI(order.id);
    try {
      const result = await analyzeOrderSemantically({
        descripcion: order.descripcion || order.descriptionSection?.description || ""
      });

      const subNormalized = normalizeSubCause(result.subcausa_normalizada);
      const normalizedDisc = normalizeDiscipline(result.disciplina_normalizada, subNormalized);
      const homogenizedCause = normalizeRootCause(result.causa_raiz_normalizada);

      await updateDoc(doc(db!, 'orders', order.id), {
        causaRaizOriginal: order.causaRaiz || order.causa_raiz_normalizada || "",
        semanticAnalysis: { ...result, subcausa_normalizada: subNormalized, causa_raiz_normalizada: homogenizedCause },
        disciplina_normalizada: normalizedDisc,
        causa_raiz_normalizada: homogenizedCause,
        subcausa_normalizada: subNormalized,
        classification_status: 'auto'
      });

      toast({ title: "Auditoría IA Exitosa", description: `Registro ${order.projectId} clasificado y homologado.` });
      
      setOrders(prev => prev.map(o => o.id === order.id ? { 
        ...o, 
        causaRaizOriginal: order.causaRaiz || order.causa_raiz_normalizada || "",
        semanticAnalysis: { ...result, subcausa_normalizada: subNormalized, causa_raiz_normalizada: homogenizedCause }, 
        disciplina_normalizada: normalizedDisc,
        causa_raiz_normalizada: homogenizedCause,
        subcausa_normalizada: subNormalized,
        classification_status: 'auto'
      } : o));

    } catch (e: any) {
      toast({ variant: "destructive", title: "Fallo en IA", description: e.message });
    } finally {
      setIsProcessingAI(null);
    }
  };

  const purgeCollectionCompletely = async (db: Firestore, collPath: string) => {
    let hasMore = true;
    const PURGE_CHUNK = 40;
    while (hasMore) {
      const snap = await getDocs(query(collection(db, collPath), limit(PURGE_CHUNK)));
      if (snap.empty) {
        hasMore = false;
        break;
      }
      const batch = writeBatch(db);
      for (const d of snap.docs) {
        batch.delete(d.ref);
      }
      await batch.commit();
      await sleep(6500); 
      if (snap.size < PURGE_CHUNK) hasMore = false;
    }
  };

  const handleDeepSyncAndBackfill = async () => {
    if (!db || !user || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsSyncing(true);
    setSyncProgress(0);

    try {
      setSyncStep('Validando Universo Base...');
      const totalSnapshot = await getCountFromServer(collection(db, 'orders'));
      const totalRecords = totalSnapshot.data().count;

      setSyncStep('Fase de Purga: Limpiando agregados...');
      const collectionsToPurge = [
        'taxonomy_formats', 
        'taxonomy_disciplines', 
        'taxonomy_causes',
        'hitos_analytics',
        'taxonomy_coordinators',
        'taxonomy_stages',
        'taxonomy_plans',
        'taxonomy_states'
      ];
      for (const coll of collectionsToPurge) {
        await purgeCollectionCompletely(db, coll);
      }

      setSyncStep('Fase de Coherencia Taxonómica...');
      let processed = 0;
      let lastVisible = null;
      let hasMore = true;
      const CHUNK_SIZE = 40; 

      const buildMetadata = {
        source_collection: 'orders',
        source_count: totalRecords,
        build_timestamp: new Date().toISOString(),
        build_version: '15.6.0-catalog-homologated'
      };

      const globalFormatStats: Record<string, any> = {};
      const globalDisciplineStats: Record<string, any> = {};
      const globalCauseStats: Record<string, any> = {};
      const plansMap: Record<string, any> = {};
      const statesMap: Record<string, any> = {};
      const hitosAgg: Record<string, any> = {};

      while (hasMore) {
        let q = query(collection(db, 'orders'), orderBy(documentId()), limit(CHUNK_SIZE));
        if (lastVisible) q = query(q, startAfter(lastVisible));
        
        const snap = await getDocs(q);
        if (snap.empty) { hasMore = false; break; }

        const batch = writeBatch(db);
        
        for (const d of snap.docs) {
          const data = d.data();
          const impact = Number(data.impactoNeto || 0);
          const format = normalizeFormatName(data.format || data.format_normalized || data.format_origin || 'OTRO');
          
          let subCause = normalizeSubCause(data.subcausa_normalizada || data.semanticAnalysis?.subcausa_normalizada || 'SIN CLASIFICAR');
          const disc = normalizeDiscipline(data.disciplina_normalizada || data.semanticAnalysis?.disciplina_normalizada || data.disciplina || 'PENDIENTE', subCause);
          
          const rawCause = data.causa_raiz_normalizada || data.causaRaiz || data.causaRaizOriginal || 'ERRORES / OMISIONES';
          const cause = normalizeRootCause(rawCause);
          
          const coord = normalizeCoordinator(data.coordinador || data.coordinador_normalizado);
          const stage = normalizeStage(data.etapa || data.etapa_proyecto_normalizada);
          const plan = normalizePlan(data.plan || data.plan_nombre_normalizado);
          const state = normalizeState(data.state_normalized || data.state || data.estado);
          const mun = normalizeMunicipality(data.municipality_normalized || data.municipality || data.municipio);
          
          const dateStr = data.fecha_oc_ot || data.fechaSolicitud || data.processedAt || new Date().toISOString();
          const date = new Date(dateStr);
          const year = isNaN(date.getFullYear()) ? 2024 : date.getFullYear();
          const month = isNaN(date.getMonth()) ? 1 : date.getMonth() + 1;

          batch.update(doc(db, 'orders', d.id), {
            format_normalized: format,
            coordinador_normalizado: coord,
            etapa_proyecto_normalizada: stage,
            plan_nombre_normalizado: plan,
            disciplina_normalizada: disc,
            causaRaizOriginal: String(rawCause).trim(),
            causa_raiz_normalizada: cause,
            subcausa_normalizada: subCause,
            state_normalized: state,
            municipality_normalized: mun,
            year,
            month,
            lastSync: buildMetadata.build_timestamp
          });

          if (!plansMap[plan]) plansMap[plan] = { count: 0, name: plan, impact: 0 };
          plansMap[plan].count += 1;
          plansMap[plan].impact += impact;

          if (!statesMap[state]) statesMap[state] = { count: 0, name: state, impact: 0 };
          statesMap[state].count += 1;
          statesMap[state].impact += impact;

          if (!globalFormatStats[format]) globalFormatStats[format] = { impact: 0, count: 0, name: format };
          globalFormatStats[format].impact += impact;
          globalFormatStats[format].count += 1;

          if (!globalDisciplineStats[disc]) globalDisciplineStats[disc] = { impact: 0, count: 0, name: disc };
          globalDisciplineStats[disc].impact += impact;
          globalDisciplineStats[disc].count += 1;

          if (!globalCauseStats[cause]) globalCauseStats[cause] = { impact: 0, count: 0, name: cause };
          globalCauseStats[cause].impact += impact;
          globalCauseStats[cause].count += 1;

          const aggKey = `${year}_${month}_${format}_${coord.replace(/[\/\s\.]+/g, '_')}_${stage.replace(/[\/\s\.]+/g, '_')}_${plan.replace(/[\/\s\.]+/g, '_')}_${disc.replace(/[\/\s\.]+/g, '_')}_${cause.replace(/[\/\s\.]+/g, '_')}_${subCause.replace(/[\/\s\.]+/g, '_')}_${state.replace(/[\/\s\.]+/g, '_')}_${mun.replace(/[\/\s\.]+/g, '_')}`.substring(0, 500);
          if (!hitosAgg[aggKey]) {
            hitosAgg[aggKey] = { 
              impact: 0, count: 0, year, month, format, coordinator: coord, stage, plan, discipline: disc, cause, subcause: subCause, state, municipality: mun
            };
          }
          hitosAgg[aggKey].impact += impact;
          hitosAgg[aggKey].count += 1;
        }

        await batch.commit();
        processed += snap.size;
        setSyncProgress(Math.round((processed / Math.max(1, totalRecords)) * 100));
        lastVisible = snap.docs[snap.docs.length - 1];
        
        if (processed % (CHUNK_SIZE * 5) === 0) {
          setSyncStep(`Enfriamiento profundo de red (${processed}/${totalRecords})...`);
          await sleep(25000); 
          setSyncStep('Fase de Coherencia Taxonómica...');
        } else {
          await sleep(7500); 
        }
        if (snap.size < CHUNK_SIZE) hasMore = false;
      }

      setSyncStep('Guardando Vistas Congruentes...');
      
      await setDoc(doc(db, 'aggregates', 'global_stats'), {
        ...buildMetadata,
        totalImpact: Object.values(globalCauseStats).reduce((a: any, b: any) => a + b.impact, 0),
        totalOrders: totalRecords,
        totalProcessed: processed,
        lastUpdate: buildMetadata.build_timestamp
      });

      const saveTaxonomyInBatches = async (map: Record<string, any>, coll: string) => {
        const entries = Object.entries(map);
        const SAVE_CHUNK = 40;
        for (let i = 0; i < entries.length; i += SAVE_CHUNK) {
          const chunk = entries.slice(i, i + SAVE_CHUNK);
          const b = writeBatch(db);
          for (const [id, data] of chunk) {
            const safeId = id.replace(/[\/\s\.]+/g, '_').substring(0, 100);
            b.set(doc(db, coll, safeId), { ...data, id: safeId, name: data.name || id });
          }
          await b.commit();
          await sleep(8000);
        }
      };

      await saveTaxonomyInBatches(globalFormatStats, 'taxonomy_formats');
      await saveTaxonomyInBatches(globalDisciplineStats, 'taxonomy_disciplines');
      await saveTaxonomyInBatches(globalCauseStats, 'taxonomy_causes');
      await saveTaxonomyInBatches(plansMap, 'taxonomy_plans');
      await saveTaxonomyInBatches(statesMap, 'taxonomy_states');

      setSyncStep('Finalizando Agregados Estratégicos...');
      const hitosEntries = Object.entries(hitosAgg);
      const HITOS_CHUNK = 30;
      for (let i = 0; i < hitosEntries.length; i += HITOS_CHUNK) { 
        const chunk = hitosEntries.slice(i, i + HITOS_CHUNK);
        const batch = writeBatch(db);
        for (const [key, val] of chunk) {
          batch.set(doc(db, 'hitos_analytics', key), { ...val, lastUpdate: buildMetadata.build_timestamp });
        }
        await batch.commit();
        await sleep(9000); 
      }

      toast({ title: "Sincronización Exitosa", description: "El universo ha sido homologado bajo protocolo de catálogo maestro." });
      fetchOrders('initial');
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error en sincronización", description: e.message });
    } finally {
      setIsSyncing(false);
      isProcessingRef.current = false;
      setSyncStep('');
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30 text-slate-900">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800 uppercase">Consola de Control de Universo</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleDeepSyncAndBackfill} 
              disabled={isSyncing}
              className="bg-primary hover:bg-primary/90 rounded-xl gap-2 h-10 px-6 shadow-lg text-[10px] font-black uppercase tracking-widest"
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Sincronizar Universo
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8">
          {isSyncing && (
            <Card className="p-8 border-none shadow-xl bg-slate-900 text-white space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-accent uppercase tracking-widest">Procesando Base de Datos Homologada (Catálogo Maestro)</p>
                  <h3 className="text-2xl font-bold uppercase">{syncStep}</h3>
                </div>
                <span className="text-4xl font-black text-accent">{syncProgress}%</span>
              </div>
              <Progress value={syncProgress} className="h-3 bg-white/10" />
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-primary">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Registros Totales</p>
              <h2 className="text-3xl font-black">{totalCount.toLocaleString()}</h2>
            </Card>
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Impacto Financiero</p>
              <h2 className="text-3xl font-black">${(Number(globalAgg?.totalImpact || 0) / 1000000).toFixed(1)}M</h2>
            </Card>
            <Card className="p-6 border-none shadow-md bg-white border-l-4 border-l-accent">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Estado de Salud</p>
              <div className="flex items-center gap-2 text-emerald-600 font-bold uppercase text-xs">
                <ShieldCheck className="h-4 w-4" /> Catálogo Homologado
              </div>
            </Card>
          </div>

          <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b p-8">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-widest flex items-center gap-3">
                    <Database className="h-5 w-5 text-primary" /> Explorador de Universo
                  </CardTitle>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Gestión de base de datos maestra con trazabilidad</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase pl-8">PID / Proyecto</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Formato</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Causa Raíz (Homologada)</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Monto</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right pr-8">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingOrders ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-200 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-40 text-center text-slate-400 uppercase font-bold text-xs">
                        No se encontraron registros activos.
                      </TableCell>
                    </TableRow>
                  ) : orders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors border-b last:border-0">
                      <TableCell className="pl-8 py-4">
                        <div className="space-y-0.5">
                          <p className="text-xs font-black text-slate-800">{order.projectId}</p>
                          <p className="text-[10px] text-slate-400 uppercase truncate max-w-[200px]">{order.projectName || 'N/A'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-black uppercase bg-white">{order.format_normalized || order.format || 'OTRO'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-slate-700 uppercase">{order.causa_raiz_normalizada || 'SIN CLASIFICAR'}</p>
                          <p className="text-[8px] text-slate-400 uppercase italic">Original: "{order.causaRaizOriginal || order.causaRaiz || 'N/A'}"</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-900">
                        ${Number(order.impactoNeto || 0).toLocaleString('es-MX')}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary hover:bg-primary/5"
                            title="Ver Detalle"
                            onClick={() => setViewingOrder(order)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-primary hover:bg-primary/5"
                            title="Auditoría IA"
                            onClick={() => handleProcessAI(order)}
                            disabled={isProcessingAI === order.id}
                          >
                            {isProcessingAI === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="p-6 border-t bg-slate-50/30 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Página {currentPage} • {orders.length} registros mostrados de {totalCount.toLocaleString()}</p>
                  <div className="flex items-center gap-2">
                    <List className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-400 uppercase">Filas:</span>
                    <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="h-8 w-24 bg-white text-[10px] font-black uppercase rounded-lg border-slate-200">
                        <SelectValue placeholder="100" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="300">300</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { fetchOrders('prev'); setCurrentPage(p => Math.max(1, p - 1)); }}
                    disabled={currentPage === 1 || isLoadingOrders}
                    className="rounded-xl h-9 gap-2 text-[10px] font-black uppercase px-4"
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { fetchOrders('next'); setCurrentPage(p => p + 1); }}
                    disabled={orders.length < pageSize || isLoadingOrders}
                    className="rounded-xl h-9 gap-2 text-[10px] font-black uppercase px-4"
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>

      <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
        <DialogContent className="sm:max-w-[600px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl text-slate-900">
          <DialogHeader className="bg-slate-900 text-white p-8">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <Badge className="bg-accent text-white uppercase text-[9px]">Ficha Técnica de Registro</Badge>
                <DialogTitle className="text-2xl font-headline font-bold text-white">{viewingOrder?.projectId}</DialogTitle>
                <p className="text-xs text-slate-400 font-medium uppercase">{viewingOrder?.projectName}</p>
              </div>
              <FileText className="h-10 w-10 text-white/20" />
            </div>
          </DialogHeader>
          {viewingOrder && (
            <ScrollArea className="max-h-[60vh]">
              <div className="p-8 space-y-6 bg-white text-slate-900">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">PID del Proyecto</p>
                    <p className="text-sm font-bold">{viewingOrder.projectId}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Nombre Proyecto</p>
                    <p className="text-sm font-bold truncate">{viewingOrder.projectName || 'N/A'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Monto Neto</p>
                    <p className="text-sm font-bold text-primary">${Number(viewingOrder.impactoNeto || 0).toLocaleString('es-MX')}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Formato</p>
                    <p className="text-sm font-bold uppercase">{viewingOrder.format_normalized || viewingOrder.format || 'OTRO'}</p>
                  </div>
                </div>
                
                <Separator />

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Disciplina</p>
                    <p className="text-sm font-bold uppercase">{viewingOrder.disciplina_normalizada || 'PENDIENTE'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Causa Raíz (Homologada)</p>
                    <p className="text-sm font-bold uppercase text-primary">{viewingOrder.causa_raiz_normalizada || 'SIN CLASIFICAR'}</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Valor Original (Trazabilidad)</p>
                    <p className="text-[11px] text-slate-600 font-medium">"{viewingOrder.causaRaizOriginal || viewingOrder.causaRaiz || 'N/A'}"</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Sub-Causa Técnica</p>
                    <p className="text-sm font-bold uppercase">{viewingOrder.subcausa_normalizada || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Plan de Inversión</p>
                    <p className="text-sm font-bold uppercase">{viewingOrder.plan_nombre_normalizado || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Descripción</p>
                    <p className="text-xs text-slate-600 leading-relaxed italic border-l-4 border-primary pl-4 py-2 bg-slate-50">
                      {viewingOrder.descripcion}
                    </p>
                  </div>
                </div>

                {viewingOrder.semanticAnalysis && (
                  <div className="mt-6 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                    <div className="flex items-center gap-2 mb-3">
                      <BrainCircuit className="h-5 w-5 text-primary" />
                      <p className="text-[10px] font-black text-primary uppercase">Razonamiento IA (Confidence: {Math.round(viewingOrder.semanticAnalysis.confidence_score * 100)}%)</p>
                    </div>
                    <p className="text-xs text-slate-700 font-medium italic">
                      {viewingOrder.semanticAnalysis.rationale_tecnico}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="p-6 bg-slate-50 border-t">
            <Button onClick={() => setViewingOrder(null)} className="w-full rounded-xl uppercase font-black text-[10px] tracking-widest h-10">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
