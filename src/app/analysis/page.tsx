
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  RefreshCcw, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Filter,
  AlertTriangle,
  Search,
  Trash2,
  BarChart4,
  CheckCircle2,
  Zap,
  Target,
  DollarSign,
  Layers
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { 
  collection, 
  query, 
  limit, 
  doc, 
  orderBy, 
  startAfter, 
  QueryDocumentSnapshot, 
  DocumentData,
  where,
  setDoc,
  increment,
  updateDoc,
  getCountFromServer,
} from 'firebase/firestore';
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user, isAuthReady } = useUser();
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageHistory, setPageHistory] = useState<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);
  const [stats, setStats] = useState({ total: 0, withData: 0, pending: 0, totalImpact: 0 });
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showBulkAiDialog, setShowBulkAiDialog] = useState(false);
  const [bulkAiProgress, setBulkAiProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // 1. Leer Agregados Globales (SSOT)
  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  // 2. Query Paginada con Cursor
  const ordersQuery = useMemoFirebase(() => {
    if (!db || !isAuthReady) return null;
    
    let q = collection(db, 'orders');
    let baseQuery;

    if (disciplineFilter === 'all') {
      baseQuery = query(q, orderBy('projectId', 'asc'), limit(pageSize));
    } else if (disciplineFilter === 'unclassified') {
      baseQuery = query(q, where('classification_status', '==', 'pending'), orderBy('projectId', 'asc'), limit(pageSize));
    } else {
      baseQuery = query(q, where('disciplina_normalizada', '==', disciplineFilter), orderBy('projectId', 'asc'), limit(pageSize));
    }

    const currentCursor = pageHistory[currentPage - 1];
    if (currentCursor) {
      baseQuery = query(baseQuery, startAfter(currentCursor));
    }

    return baseQuery;
  }, [db, isAuthReady, pageSize, currentPage, disciplineFilter, pageHistory]);

  const { data: orders, isLoading, error, snapshot } = useCollection(ordersQuery);

  // 3. Normalización Dinámica de Disciplinas para el Filtro
  const groupedDisciplines = useMemo(() => {
    const groups: Record<string, { count: number, impact: number, rawNames: string[] }> = {};
    
    // Cargar desde agregados
    if (globalAgg?.disciplines) {
      Object.entries(globalAgg.disciplines).forEach(([name, s]: any) => {
        let normalized = String(name).trim().toUpperCase();
        // Consolidación de plurales simple (ej. CIVILES -> CIVIL)
        if (normalized.endsWith('S') && normalized.length > 4) {
          normalized = normalized.substring(0, normalized.length - 1);
        }
        
        if (!groups[normalized]) {
          groups[normalized] = { count: 0, impact: 0, rawNames: [] };
        }
        groups[normalized].count += s.count || 0;
        groups[normalized].impact += s.impact || 0;
        if (!groups[normalized].rawNames.includes(name)) {
          groups[normalized].rawNames.push(name);
        }
      });
    }

    // Autodescubrimiento desde los registros cargados actualmente
    orders?.forEach(o => {
      if (o.disciplina_normalizada) {
        let name = o.disciplina_normalizada;
        let normalized = String(name).trim().toUpperCase();
        if (normalized.endsWith('S') && normalized.length > 4) normalized = normalized.substring(0, normalized.length - 1);
        
        if (!groups[normalized]) {
          groups[normalized] = { count: 0, impact: 0, rawNames: [name] };
        } else if (!groups[normalized].rawNames.includes(name)) {
          groups[normalized].rawNames.push(name);
        }
      }
    });
    
    return groups;
  }, [globalAgg, orders]);

  // 4. Actualizar KPIs Dinámicos
  useEffect(() => {
    if (!mounted) return;

    const totalInDb = globalAgg?.totalOrders || 0;
    const totalImpactInDb = globalAgg?.totalImpact || 0;
    
    // Contar procesados sumando las disciplinas en el agregador
    const totalWithDataInDb = Object.values(globalAgg?.disciplines || {}).reduce((acc: number, g: any) => acc + (g.count || 0), 0);

    // Si no hay filtro, mostrar el universo total
    if (disciplineFilter === 'all') {
      setStats({
        total: totalInDb,
        withData: totalWithDataInDb,
        pending: Math.max(0, totalInDb - totalWithDataInDb),
        totalImpact: totalImpactInDb
      });
    } else if (disciplineFilter === 'unclassified') {
      // Para "Sin Clasificar", calculamos el impacto de lo que está en pantalla como referencia
      const localImpact = orders?.reduce((acc, o) => acc + (o.impactoNeto || 0), 0) || 0;
      setStats({
        total: Math.max(0, totalInDb - totalWithDataInDb),
        withData: 0,
        pending: Math.max(0, totalInDb - totalWithDataInDb),
        totalImpact: localImpact
      });
    } else {
      // Para una disciplina específica
      const group = groupedDisciplines[disciplineFilter];
      setStats({
        total: group?.count || 0,
        withData: group?.count || 0,
        pending: 0,
        totalImpact: group?.impact || 0
      });
    }
  }, [disciplineFilter, globalAgg, groupedDisciplines, orders, mounted]);

  const isIndexError = error && (error as any).code === 'failed-precondition';

  const handleNextPage = () => {
    if (snapshot && snapshot.docs.length === pageSize) {
      const last = snapshot.docs[snapshot.docs.length - 1];
      setPageHistory(prev => {
        const newHistory = [...prev];
        newHistory[currentPage] = last;
        return newHistory;
      });
      setCurrentPage(prev => prev + 1);
      setSelectedIds([]);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setSelectedIds([]);
    }
  };

  const formatAmount = (amount: number) => {
    if (!mounted) return "0.00";
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2 }).format(amount);
  };

  const updateGlobalStatsIncrementally = async (discName: string, impact: number) => {
    if (!db) return;
    const ref = doc(db, 'aggregates', 'global_stats');
    const path = `disciplines.${discName}.count`;
    const impactPath = `disciplines.${discName}.impact`;
    
    try {
      await updateDoc(ref, {
        [path]: increment(1),
        [impactPath]: increment(impact),
        lastUpdate: new Date().toISOString()
      });
    } catch {
      await setDoc(ref, {
        disciplines: {
          [discName]: { count: 1, impact: impact }
        },
        lastUpdate: new Date().toISOString()
      }, { merge: true });
    }
  };

  const handleSingleSemanticAnalysis = async (order: any) => {
    if (!db || !user) return;
    setIsAnalyzing(order.id);
    try {
      const result = await analyzeOrderSemantically({
        descripcion: String(order.descripcion || "").substring(0, 300),
        monto: order.impactoNeto
      });

      const orderRef = doc(db, 'orders', order.id);
      updateDocumentNonBlocking(orderRef, {
        disciplina_normalizada: result.disciplina_normalizada,
        causa_raiz_normalizada: result.causa_raiz_normalizada,
        subcausa_normalizada: result.subcausa_normalizada,
        classification_status: 'auto',
        semanticAnalysis: result,
        processedAt: new Date().toISOString()
      });

      await updateGlobalStatsIncrementally(result.disciplina_normalizada, order.impactoNeto || 0);
      toast({ title: "Registro Clasificado", description: result.disciplina_normalizada });
    } catch (e) {
      toast({ variant: "destructive", title: "Error IA", description: "Fallo en motor Gemini." });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleBulkProcess = async () => {
    if (!db || !user || selectedIds.length === 0) return;
    
    setIsBulkProcessing(true);
    setShowBulkAiDialog(true);
    setProcessedCount(0);
    setBulkAiProgress(0);

    const targetOrders = orders?.filter(o => selectedIds.includes(o.id)) || [];
    
    for (let i = 0; i < targetOrders.length; i++) {
      const order = targetOrders[i];
      try {
        const result = await analyzeOrderSemantically({
          descripcion: String(order.descripcion || "").substring(0, 300),
          monto: order.impactoNeto
        });

        const orderRef = doc(db, 'orders', order.id);
        updateDocumentNonBlocking(orderRef, {
          disciplina_normalizada: result.disciplina_normalizada,
          causa_raiz_normalizada: result.causa_raiz_normalizada,
          subcausa_normalizada: result.subcausa_normalizada,
          classification_status: 'auto',
          semanticAnalysis: result,
          processedAt: new Date().toISOString()
        });

        await updateGlobalStatsIncrementally(result.disciplina_normalizada, order.impactoNeto || 0);

        setProcessedCount(i + 1);
        setBulkAiProgress(Math.round(((i + 1) / targetOrders.length) * 100));
      } catch (e) {
        console.error(`Error bulk processing:`, e);
      }
    }

    toast({ title: "Procesamiento Completo", description: `${targetOrders.length} registros actualizados.` });
    setIsBulkProcessing(false);
    setSelectedIds([]);
    setTimeout(() => setShowBulkAiDialog(false), 2000);
  };

  const handleRefreshUniverseStats = async () => {
    if (!db) return;
    setIsRefreshingStats(true);
    try {
      const colRef = collection(db, 'orders');
      
      // 1. Obtener conteo total real
      const totalSnapshot = await getCountFromServer(colRef);
      const total = totalSnapshot.data().count;

      // 2. Obtener conteo de procesados (donde classification_status no es pending)
      let processedCount = 0;
      try {
        const processedQuery = query(colRef, where('classification_status', '!=', 'pending'));
        const processedSnapshot = await getCountFromServer(processedQuery);
        processedCount = processedSnapshot.data().count;
      } catch (e) {
        // Fallback: sumamos lo que hay en las disciplinas del SSOT
        processedCount = Object.values(globalAgg?.disciplines || {}).reduce((acc: number, g: any) => acc + (g.count || 0), 0);
      }
      
      await setDoc(doc(db, 'aggregates', 'global_stats'), {
        totalOrders: total,
        lastUpdate: new Date().toISOString()
      }, { merge: true });
      
      toast({ 
        title: "Universo Sincronizado", 
        description: `Total: ${total.toLocaleString()} | Integridad: ${processedCount.toLocaleString()} registros.` 
      });
    } catch (e: any) {
      console.error("Error syncing universe:", e);
      toast({ variant: "destructive", title: "Fallo de Sincronización", description: "Verifique permisos en Firestore." });
    } finally {
      setIsRefreshingStats(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!db) return;
    const orderRef = doc(db, 'orders', id);
    deleteDocumentNonBlocking(orderRef);
    toast({ title: "Registro eliminado" });
  };

  const progressPercentage = stats.total > 0 ? Math.round((stats.withData / stats.total) * 100) : 0;

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <BarChart4 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Consola de Control de Universo</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <Select value={disciplineFilter} onValueChange={(v) => { setDisciplineFilter(v); setCurrentPage(1); setPageHistory([null]); }}>
                <SelectTrigger className="h-8 w-72 text-[10px] font-black uppercase rounded-lg border-none bg-white shadow-sm">
                  <Filter className="h-3 w-3 mr-2 text-primary" />
                  <SelectValue placeholder="Filtrar por Disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODAS LAS DISCIPLINAS ({globalAgg?.totalOrders || 0})</SelectItem>
                  <SelectItem value="unclassified" className="text-rose-600 font-bold">SIN CLASIFICAR</SelectItem>
                  {Object.entries(groupedDisciplines)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([name, group]) => (
                    <SelectItem key={name} value={name}>
                      {name} ({group.count.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <Button 
                  onClick={handleBulkProcess} 
                  disabled={isBulkProcessing}
                  className="bg-accent hover:bg-accent/90 text-white gap-2 shadow-lg h-10 px-6 rounded-xl animate-in fade-in zoom-in"
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Procesar Masivo ({selectedIds.length})</span>
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshUniverseStats}
                disabled={isRefreshingStats}
                className="h-10 border-slate-200 text-[10px] font-black uppercase rounded-xl"
              >
                <RefreshCcw className={`h-3 w-3 mr-2 ${isRefreshingStats ? 'animate-spin' : ''}`} />
                Sincronizar Universo
              </Button>
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {isIndexError && (
            <Alert variant="destructive" className="bg-rose-50 border-rose-200 shadow-sm rounded-2xl">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-sm font-black uppercase tracking-tight">Índice Compuesto Requerido</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                Firestore requiere un índice para este filtro combinado.
                <Button asChild variant="link" size="sm" className="h-auto p-0 ml-2 text-rose-600 font-bold">
                  <a href={`https://console.firebase.google.com/v1/r/project/studio-5519165939-247e1/firestore/indexes?create_composite=ClZwcm9qZWN0cy9zdHVkaW8tNTUxOTE2NTkzOS0yNDdlMS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvb3JkZXJzL2luZGV4ZXMvXxABGhkKFWNsYXNzaWZpY2F0aW9uX3N0YXR1cxABGg0KCXByb2plY3RJZBABGgwKCF9fbmFtZV9fEAE`} target="_blank">Activar Índice Manualmente</a>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-5 border-none shadow-sm bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase">Universo {disciplineFilter !== 'all' ? (disciplineFilter === 'unclassified' ? 'Pendiente' : disciplineFilter) : 'Walmart'}</p>
                <Database className="h-4 w-4 text-primary opacity-20" />
              </div>
              <h4 className="text-3xl font-headline font-bold text-slate-800">{stats.total.toLocaleString()}</h4>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Registros del Filtro</p>
            </Card>
            
            <Card className="p-5 border-none shadow-sm bg-white border-l-4 border-l-emerald-500 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-emerald-600 uppercase">Integridad Técnica</p>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-20" />
              </div>
              <h4 className="text-3xl font-headline font-bold text-emerald-600">{stats.withData.toLocaleString()}</h4>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Con Disciplina & Causa</p>
            </Card>

            <Card className="p-5 border-none shadow-sm bg-slate-900 text-white border-l-4 border-l-accent flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-accent uppercase">Impacto Neto Total</p>
                <DollarSign className="h-4 w-4 text-accent opacity-40" />
              </div>
              <h4 className="text-2xl font-headline font-bold text-white">${formatAmount(stats.totalImpact)}</h4>
              <p className="text-[9px] text-slate-500 mt-2 uppercase font-bold">Consolidado en MXN</p>
            </Card>

            <Card className="p-5 border-none shadow-sm bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance Clasificación</p>
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <h4 className="text-3xl font-headline font-bold text-primary">{progressPercentage}%</h4>
                  <span className="text-[9px] text-slate-400 font-black mb-1 uppercase">Sincronizado</span>
                </div>
                <Progress value={progressPercentage} className="h-1.5 bg-slate-100" />
              </div>
            </Card>
          </div>

          <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox 
                      checked={selectedIds.length === (orders?.length || 0) && (orders?.length || 0) > 0} 
                      onCheckedChange={(checked) => setSelectedIds(checked ? (orders?.map(o => o.id) || []) : [])} 
                    />
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Estatus Datos</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">PID / Proyecto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Disciplina & Trazabilidad</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Impacto Neto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center w-[120px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-32"><RefreshCcw className="h-10 w-10 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                ) : !orders || orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-32">
                      <div className="space-y-2">
                        <Search className="h-10 w-10 mx-auto text-slate-200" />
                        <p className="text-slate-400 font-bold uppercase text-xs">No se encontraron registros en este filtro.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : orders.map((order) => {
                  const hasDiscipline = !!order.disciplina_normalizada;
                  const isAuto = order.classification_status === 'auto';
                  const confidence = order.semanticAnalysis?.confidence_score;
                  
                  return (
                    <TableRow key={order.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(order.id) ? 'bg-primary/5' : ''}`}>
                      <TableCell className="text-center">
                        <Checkbox 
                          checked={selectedIds.includes(order.id)} 
                          onCheckedChange={(checked) => setSelectedIds(prev => checked ? [...prev, order.id] : prev.filter(id => id !== order.id))} 
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {isAuto ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black uppercase px-2 w-fit">AUTO IA</Badge>
                          ) : hasDiscipline ? (
                            <Badge className="bg-blue-100 text-blue-700 border-none text-[8px] font-black uppercase px-2 w-fit">VALIDADO</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] font-black border-dashed text-slate-400 uppercase px-2 w-fit">PENDIENTE</Badge>
                          )}
                          {confidence !== undefined && (
                            <div className="flex items-center gap-1">
                              <Target className="h-2.5 w-2.5 text-slate-400" />
                              <span className="text-[8px] font-bold text-slate-500">{Math.round(confidence * 100)}% Confianza</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-black text-primary text-sm tracking-tighter">{order.projectId}</span>
                          <span className="text-[9px] text-slate-400 uppercase truncate max-w-[180px] font-bold">{order.projectName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-700 text-xs">{order.disciplina_normalizada || "—"}</span>
                           <div className="flex items-center gap-1.5 mt-0.5">
                             <Layers className="h-2.5 w-2.5 text-slate-300" />
                             <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight truncate max-w-[200px]">
                               {order.subcausa_normalizada || order.causa_raiz_normalizada || "Sin sub-disciplina"}
                             </span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-800 text-sm">${formatAmount(order.impactoNeto || 0)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleSingleSemanticAnalysis(order)} disabled={!!isAnalyzing}>
                            {isAnalyzing === order.id ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-accent" />}
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-300 hover:text-rose-500">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle className="font-headline uppercase text-slate-900 text-sm">Eliminar Registro</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-slate-500">
                                  ¿Confirmas la eliminación de la orden {order.projectId}? Esta acción no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl text-[10px] font-black uppercase">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteRecord(order.id)} className="bg-rose-600 rounded-xl text-[10px] font-black uppercase">Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t">
              <div className="flex items-center gap-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  PÁGINA {currentPage} • BLOQUE: {pageSize}
                </div>
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); setPageHistory([null]); }}>
                  <SelectTrigger className="h-8 w-32 text-[9px] font-black uppercase rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="100">100 por página</SelectItem>
                    <SelectItem value="300">300 por página</SelectItem>
                    <SelectItem value="500">500 por página</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1} className="text-[9px] font-black px-4 rounded-xl shadow-sm">
                  <ChevronLeft className="h-4 w-4 mr-1" /> ANTERIOR
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!orders || orders.length < pageSize} className="text-[9px] font-black px-4 rounded-xl shadow-sm">
                  SIGUIENTE <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </main>

        <Dialog open={showBulkAiDialog} onOpenChange={setShowBulkAiDialog}>
          <DialogContent className="max-w-md rounded-3xl p-8 text-center space-y-6">
            <RefreshCcw className="h-12 w-12 text-primary animate-spin mx-auto" />
            <div>
              <DialogTitle className="text-xl font-bold uppercase text-slate-900">Procesando Universo IA</DialogTitle>
              <DialogDescription className="text-slate-500 mt-2">
                Analizando {selectedIds.length} registros con motor Gemini 2.5 Flash.
              </DialogDescription>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black text-primary uppercase">
                <span>{processedCount} DE {selectedIds.length}</span>
                <span>{bulkAiProgress}%</span>
              </div>
              <Progress value={bulkAiProgress} className="h-2 bg-slate-100" />
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </div>
  );
}
