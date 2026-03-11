"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  RefreshCcw, 
  ShieldCheck,
  Loader2,
  Plus,
  Trash2,
  Edit3,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  FileText
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
  deleteDoc,
  updateDoc,
  limitToLast,
  serverTimestamp
} from 'firebase/firestore';
import { 
  normalizeFormatName, 
  normalizeCoordinator, 
  normalizeStage,
  normalizePlan
} from '@/lib/excel-processor';
import { Progress } from '@/components/ui/progress';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const PAGE_SIZE = 15;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStep, setSyncStep] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  const [orders, setOrders] = useState<any[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [firstDoc, setFirstDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState<string | null>(null);

  const [newOrder, setNewOrder] = useState({
    projectId: '',
    projectName: '',
    impactoNeto: 0,
    disciplina_normalizada: '',
    descripcion: '',
    format: 'WSC'
  });

  useEffect(() => { setMounted(true); }, []);

  const aggRef = doc(db!, 'aggregates', 'global_stats');
  const { data: globalAgg } = useDoc(aggRef);

  const fetchOrders = useCallback(async (direction: 'next' | 'prev' | 'initial' = 'initial') => {
    if (!db) return;
    setIsLoadingOrders(true);
    try {
      if (direction === 'initial') {
        const countSnap = await getCountFromServer(collection(db, 'orders'));
        setTotalCount(countSnap.data().count);
      }

      let q = query(collection(db, 'orders'), orderBy(documentId()), limit(PAGE_SIZE));
      
      if (direction === 'next' && lastDoc) {
        q = query(collection(db, 'orders'), orderBy(documentId()), startAfter(lastDoc), limit(PAGE_SIZE));
      } else if (direction === 'prev' && firstDoc) {
        q = query(collection(db, 'orders'), orderBy(documentId()), endBefore(firstDoc), limitToLast(PAGE_SIZE));
      }

      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      
      if (results.length > 0) {
        setOrders(results);
        setFirstDoc(snap.docs[0]);
        setLastDoc(snap.docs[snap.docs.length - 1]);
      } else {
        if (direction === 'initial') setOrders([]);
      }
    } catch (e: any) {
      console.error("Error fetching orders:", e);
      toast({
        variant: "destructive",
        title: "Error al cargar datos",
        description: e.message || "No se pudieron obtener los registros."
      });
    } finally {
      setIsLoadingOrders(false);
    }
  }, [db, lastDoc, firstDoc, toast]);

  useEffect(() => {
    if (db && mounted) {
      fetchOrders('initial');
    }
  }, [db, mounted, fetchOrders]);

  const handleAddOrder = async () => {
    if (!db) return;
    try {
      const id = `man_${Date.now()}`;
      const docRef = doc(db, 'orders', id);
      const data = {
        ...newOrder,
        processedAt: new Date().toISOString(),
        classification_status: 'manual',
        format_normalized: normalizeFormatName(newOrder.format),
        disciplina_normalizada: newOrder.disciplina_normalizada.toUpperCase().trim(),
        createdAt: serverTimestamp()
      };
      await setDoc(docRef, data);
      toast({ title: "Registro creado", description: "La orden ha sido añadida exitosamente." });
      setIsAddingNew(false);
      setNewOrder({
        projectId: '',
        projectName: '',
        impactoNeto: 0,
        disciplina_normalizada: '',
        descripcion: '',
        format: 'WSC'
      });
      fetchOrders('initial');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el registro." });
    }
  };

  const handleProcessAI = async (order: any) => {
    setIsProcessingAI(order.id);
    try {
      const result = await analyzeOrderSemantically({
        descripcion: order.descripcion || order.descriptionSection?.description || ""
      });

      await updateDoc(doc(db!, 'orders', order.id), {
        semanticAnalysis: result,
        disciplina_normalizada: result.disciplina_normalizada.toUpperCase().trim(),
        causa_raiz_normalizada: result.causa_raiz_normalizada,
        classification_status: 'auto'
      });

      toast({ title: "Auditoría IA Exitosa", description: `Registro ${order.projectId} reclasificado.` });
      
      setOrders(prev => prev.map(o => o.id === order.id ? { 
        ...o, 
        semanticAnalysis: result, 
        disciplina_normalizada: result.disciplina_normalizada.toUpperCase().trim(),
        causa_raiz_normalizada: result.causa_raiz_normalizada,
        classification_status: 'auto'
      } : o));

    } catch (e: any) {
      toast({ variant: "destructive", title: "Fallo en IA", description: e.message });
    } finally {
      setIsProcessingAI(null);
    }
  };

  const handleDelete = async () => {
    if (!db || !orderToDelete) return;
    try {
      await deleteDoc(doc(db, 'orders', orderToDelete));
      toast({ title: "Registro eliminado", description: "El registro ha sido borrado del sistema." });
      setOrderToDelete(null);
      fetchOrders('initial');
    } catch (e: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `orders/${orderToDelete}`,
        operation: 'delete'
      }));
    }
  };

  const handleUpdate = async () => {
    if (!db || !editingOrder) return;
    try {
      const { id, ...data } = editingOrder;
      if (data.disciplina_normalizada) {
        data.disciplina_normalizada = data.disciplina_normalizada.toUpperCase().trim();
      }
      if (data.format) {
        data.format_normalized = normalizeFormatName(data.format);
      }
      await updateDoc(doc(db, 'orders', id), data);
      toast({ title: "Cambios guardados", description: `Registro ${data.projectId} actualizado.` });
      setEditingOrder(null);
      fetchOrders('initial');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al editar", description: e.message });
    }
  };

  const purgeCollectionCompletely = async (db: Firestore, collPath: string) => {
    let hasMore = true;
    while (hasMore) {
      const snap = await getDocs(query(collection(db, collPath), limit(100)));
      if (snap.empty) {
        hasMore = false;
        break;
      }
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit().catch(() => {});
      await sleep(100); 
      if (snap.size < 100) hasMore = false;
    }
  };

  const handleDeepSyncAndBackfill = async () => {
    if (!db || !user) return;
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
      const CHUNK_SIZE = 100; 

      const buildMetadata = {
        source_collection: 'orders',
        source_count: totalRecords,
        build_timestamp: new Date().toISOString(),
        build_version: '8.0.0-stable'
      };

      const globalFormatStats: Record<string, any> = {};
      const globalDisciplineStats: Record<string, any> = {};
      const coordinators = new Set<string>();
      const stages = new Set<string>();
      const plansMap: Record<string, any> = {};
      const hitosAgg: Record<string, any> = {};

      while (hasMore) {
        let q = query(collection(db, 'orders'), orderBy(documentId()), limit(CHUNK_SIZE));
        if (lastVisible) q = query(q, startAfter(lastVisible));
        
        const snap = await getDocs(q);
        if (snap.empty) { hasMore = false; break; }

        const batch = writeBatch(db);
        
        snap.forEach(d => {
          const data = d.data();
          const impact = Number(data.impactoNeto || 0);
          
          const format = normalizeFormatName(data.format || data.format_normalized || data.format_origin || 'OTRO');
          const disc = String(data.disciplina_normalizada || data.semanticAnalysis?.disciplina_normalizada || 'PENDIENTE').trim().toUpperCase();
          const coord = normalizeCoordinator(data.coordinador || data.coordinador_normalizado);
          const stage = normalizeStage(data.etapa || data.etapa_proyecto_normalizada);
          const plan = normalizePlan(data.plan || data.plan_nombre_normalizado);
          
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
            year,
            month,
            lastSync: buildMetadata.build_timestamp
          });

          coordinators.add(coord);
          stages.add(stage);
          
          if (!plansMap[plan]) plansMap[plan] = { count: 0, name: plan };
          plansMap[plan].count += 1;

          if (!globalFormatStats[format]) globalFormatStats[format] = { impact: 0, count: 0, name: format };
          globalFormatStats[format].impact += impact;
          globalFormatStats[format].count += 1;

          if (!globalDisciplineStats[disc]) globalDisciplineStats[disc] = { impact: 0, count: 0, name: disc };
          globalDisciplineStats[disc].impact += impact;
          globalDisciplineStats[disc].count += 1;

          const aggKey = `${year}_${month}_${format}_${coord.replace(/[\/\s\.]+/g, '_')}_${stage.replace(/[\/\s\.]+/g, '_')}_${plan.replace(/[\/\s\.]+/g, '_')}_${disc.replace(/[\/\s\.]+/g, '_')}`.substring(0, 500);
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
        setSyncProgress(Math.round((processed / Math.max(1, totalRecords)) * 100));
        lastVisible = snap.docs[snap.docs.length - 1];
        
        await sleep(200); 
        if (snap.size < CHUNK_SIZE) hasMore = false;
      }

      setSyncStep('Guardando Vistas Materializadas...');
      
      await setDoc(doc(db, 'aggregates', 'global_stats'), {
        ...buildMetadata,
        totalImpact: Object.values(globalDisciplineStats).reduce((a: any, b: any) => a + b.impact, 0),
        totalOrders: totalRecords,
        totalProcessed: processed
      });

      // Guardar taxonomia con conteos reales para los filtros
      for (const [id, data] of Object.entries(globalFormatStats)) {
        await setDoc(doc(db, 'taxonomy_formats', id), { ...data, id });
      }
      for (const [id, data] of Object.entries(globalDisciplineStats)) {
        const safeId = id.replace(/[\/\s\.]+/g, '_').substring(0, 100);
        await setDoc(doc(db, 'taxonomy_disciplines', safeId), { ...data, id: safeId });
      }
      for (const [id, data] of Object.entries(plansMap)) {
        const safeId = id.replace(/[\/\s\.]+/g, '_').substring(0, 100);
        await setDoc(doc(db, 'taxonomy_plans', safeId), { ...data, id: safeId });
      }

      setSyncStep('Finalizando Agregados...');
      const hitosEntries = Object.entries(hitosAgg);
      for (let i = 0; i < hitosEntries.length; i += 100) {
        const chunk = hitosEntries.slice(i, i + 100);
        const batch = writeBatch(db);
        chunk.forEach(([key, val]) => {
          batch.set(doc(db, 'hitos_analytics', key), { ...val, lastUpdate: buildMetadata.build_timestamp });
        });
        await batch.commit();
        await sleep(300);
      }

      toast({ title: "Sincronización Exitosa", description: "El universo ha sido normalizado y los filtros del Dashboard están listos." });
      fetchOrders('initial');
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error en sincronización", description: e.message });
    } finally {
      setIsSyncing(false);
      setSyncStep('');
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800 uppercase">Consola de Control de Universo</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => setIsAddingNew(true)} 
              variant="outline"
              className="rounded-xl gap-2 h-10 border-primary/20 text-primary hover:bg-primary/5"
            >
              <Plus className="h-4 w-4" /> Nuevo Registro
            </Button>
            <Button 
              onClick={handleDeepSyncAndBackfill} 
              disabled={isSyncing}
              className="bg-primary hover:bg-primary/90 rounded-xl gap-2 h-10 px-6 shadow-lg"
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
                  <p className="text-[10px] font-black text-accent uppercase tracking-widest">Procesando Base de Datos</p>
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
                <ShieldCheck className="h-4 w-4" /> Activo y Sincronizado
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
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Gestión de base de datos maestra</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchOrders('initial')} className="rounded-xl h-9 px-4 gap-2">
                  <RefreshCcw className="h-3.5 w-3.5" /> Recargar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/30">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase pl-8">PID / Proyecto</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Formato</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Disciplina</TableHead>
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
                        No se encontraron registros. Intenta "Sincronizar Universo".
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
                          <p className="text-[10px] font-bold text-slate-700 uppercase">{order.disciplina_normalizada || 'PENDIENTE'}</p>
                          <p className="text-[9px] text-slate-400 italic truncate max-w-[200px] leading-tight">"{order.descripcion}"</p>
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
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:bg-slate-100"
                            onClick={() => setEditingOrder(order)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-rose-400 hover:bg-rose-50"
                            onClick={() => setOrderToDelete(order.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="p-6 border-t bg-slate-50/30 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase">Página {currentPage} • {orders.length} registros mostrados</p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { fetchOrders('prev'); setCurrentPage(p => Math.max(1, p - 1)); }}
                    disabled={currentPage === 1 || isLoadingOrders}
                    className="rounded-xl h-9 gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { fetchOrders('next'); setCurrentPage(p => p + 1); }}
                    disabled={orders.length < PAGE_SIZE || isLoadingOrders}
                    className="rounded-xl h-9 gap-2"
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>

      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Añadir Nuevo Registro</DialogTitle>
            <DialogDescription>Completa la información para crear una nueva orden de cambio manual.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pid" className="text-right">PID</Label>
              <Input id="pid" className="col-span-3" value={newOrder.projectId} onChange={(e) => setNewOrder({...newOrder, projectId: e.target.value})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="monto" className="text-right">Monto</Label>
              <Input id="monto" type="number" className="col-span-3" value={newOrder.impactoNeto} onChange={(e) => setNewOrder({...newOrder, impactoNeto: parseFloat(e.target.value)})} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="desc" className="text-right">Descripción</Label>
              <Input id="desc" className="col-span-3" value={newOrder.descripcion} onChange={(e) => setNewOrder({...newOrder, descripcion: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingNew(false)}>Cancelar</Button>
            <Button onClick={handleAddOrder}>Crear Registro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
            <DialogDescription>Modifica los datos del registro seleccionado.</DialogDescription>
          </DialogHeader>
          {editingOrder && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-pid" className="text-right">PID</Label>
                <Input id="edit-pid" className="col-span-3" value={editingOrder.projectId} onChange={(e) => setEditingOrder({...editingOrder, projectId: e.target.value})} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-monto" className="text-right">Monto</Label>
                <Input id="edit-monto" type="number" className="col-span-3" value={editingOrder.impactoNeto} onChange={(e) => setEditingOrder({...editingOrder, impactoNeto: parseFloat(e.target.value)})} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-disc" className="text-right">Disciplina</Label>
                <Input id="edit-disc" className="col-span-3" value={editingOrder.disciplina_normalizada} onChange={(e) => setEditingOrder({...editingOrder, disciplina_normalizada: e.target.value})} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancelar</Button>
            <Button onClick={handleUpdate}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <AlertDialog open={!!orderToDelete} onOpenChange={() => setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmas la eliminación?</AlertDialogTitle>
            <div className="text-sm text-slate-500">Esta acción no se puede deshacer y el registro se borrará permanentemente de la base de datos.</div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={handleDelete}>Eliminar Registro</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
