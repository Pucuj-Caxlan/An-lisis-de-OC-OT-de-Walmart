
"use client"

import React, { useState, useEffect } from 'react';
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
  Clock,
  Zap,
  Info
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
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { 
  collection, 
  query, 
  limit, 
  doc, 
  orderBy, 
  getCountFromServer, 
  startAfter, 
  QueryDocumentSnapshot, 
  DocumentData,
  where
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
  const [stats, setStats] = useState({ total: 0, processed: 0, pending: 0 });
  const [aiFilter, setAiFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showBulkAiDialog, setShowBulkAiDialog] = useState(false);
  const [bulkAiProgress, setBulkAiProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchStats = async () => {
    if (!db || !isAuthReady) return;
    try {
      const coll = collection(db, 'orders');
      
      // Consultas de conteo separadas para evitar errores de índice compuesto en el dashboard superior
      const [totalSnap, autoSnap, reviewedSnap] = await Promise.all([
        getCountFromServer(query(coll)),
        getCountFromServer(query(coll, where('classification_status', '==', 'auto'))),
        getCountFromServer(query(coll, where('classification_status', '==', 'reviewed')))
      ]);

      const total = totalSnap.data().count;
      const processed = autoSnap.data().count + reviewedSnap.data().count;
      
      setStats({
        total: total,
        processed: processed,
        pending: Math.max(0, total - processed)
      });
    } catch (e) {
      console.error("Stats Error:", e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [db, isAuthReady]);

  const ordersQuery = useMemoFirebase(() => {
    if (!db || !isAuthReady) return null;
    
    let q = collection(db, 'orders');
    let baseQuery;

    // Filtros normalizados para coincidir con firestore.indexes.json
    if (aiFilter === 'all') {
      baseQuery = query(q, orderBy('projectId', 'asc'), limit(pageSize));
    } else {
      const statusValue = aiFilter === 'classified' ? 'auto' : 'pending';
      baseQuery = query(
        q, 
        where('classification_status', '==', statusValue), 
        orderBy('projectId', 'asc'), 
        limit(pageSize)
      );
    }

    const currentCursor = pageHistory[currentPage - 1];
    if (currentCursor) {
      baseQuery = query(baseQuery, startAfter(currentCursor));
    }

    return baseQuery;
  }, [db, isAuthReady, pageSize, currentPage, aiFilter, pageHistory]);

  const { data: orders, isLoading, error, snapshot } = useCollection(ordersQuery);

  // Detección de error de índice compuesto (failed-precondition)
  const isIndexError = error && (error.message.includes('requires an index') || (error as any).code === 'failed-precondition');

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

  const handleSingleSemanticAnalysis = async (order: any) => {
    if (!db || !user) return;
    setIsAnalyzing(order.id);
    try {
      const result = await analyzeOrderSemantically({
        descripcion: String(order.descripcion || "").substring(0, 250),
        monto: order.impactoNeto
      });

      const orderRef = doc(db, 'orders', order.id);
      updateDocumentNonBlocking(orderRef, {
        disciplina_normalizada: result.disciplina_normalizada,
        causa_raiz_normalizada: result.causa_raiz_normalizada,
        subcausa_normalizada: result.subcausa_normalizada,
        classification_status: 'auto',
        processedAt: new Date().toISOString()
      });

      toast({ title: "Registro Procesado", description: result.disciplina_normalizada });
      fetchStats();
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
          descripcion: String(order.descripcion || "").substring(0, 250),
          monto: order.impactoNeto
        });

        const orderRef = doc(db, 'orders', order.id);
        updateDocumentNonBlocking(orderRef, {
          disciplina_normalizada: result.disciplina_normalizada,
          causa_raiz_normalizada: result.causa_raiz_normalizada,
          subcausa_normalizada: result.subcausa_normalizada,
          classification_status: 'auto',
          processedAt: new Date().toISOString()
        });

        setProcessedCount(prev => prev + 1);
        setBulkAiProgress(Math.round(((i + 1) / targetOrders.length) * 100));
      } catch (e) {
        console.error(`Error processing ${order.id}:`, e);
      }
    }

    toast({ title: "Procesamiento Masivo Completo", description: `${processedCount} registros actualizados.` });
    setIsBulkProcessing(false);
    setSelectedIds([]);
    setTimeout(() => setShowBulkAiDialog(false), 2000);
    fetchStats();
  };

  const handleDeleteRecord = async (id: string) => {
    if (!db) return;
    try {
      const orderRef = doc(db, 'orders', id);
      deleteDocumentNonBlocking(orderRef);
      toast({ title: "Registro eliminado" });
      fetchStats();
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const progressPercentage = stats.total > 0 ? Math.round((stats.processed / stats.total) * 100) : 0;

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <BarChart4 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Consola de Control de Universo</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <Button 
                variant={aiFilter === 'all' ? 'default' : 'ghost'} 
                size="sm" 
                className="text-[10px] font-black uppercase rounded-lg h-8 px-4"
                onClick={() => { setAiFilter('all'); setCurrentPage(1); setPageHistory([null]); }}
              >
                Todos
              </Button>
              <Button 
                variant={aiFilter === 'classified' ? 'default' : 'ghost'} 
                size="sm" 
                className="text-[10px] font-black uppercase rounded-lg h-8 px-4"
                onClick={() => { setAiFilter('classified'); setCurrentPage(1); setPageHistory([null]); }}
              >
                Procesados IA
              </Button>
              <Button 
                variant={aiFilter === 'not_classified' ? 'default' : 'ghost'} 
                size="sm" 
                className="text-[10px] font-black uppercase rounded-lg h-8 px-4"
                onClick={() => { setAiFilter('not_classified'); setCurrentPage(1); setPageHistory([null]); }}
              >
                Pendientes
              </Button>
            </div>
            
            {selectedIds.length > 0 && (
              <Button 
                onClick={handleBulkProcess} 
                disabled={isBulkProcessing}
                className="bg-accent hover:bg-accent/90 text-white gap-2 shadow-lg h-10 px-6 rounded-xl animate-in fade-in zoom-in"
              >
                <Sparkles className="h-4 w-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Procesar ({selectedIds.length})</span>
              </Button>
            )}
          </div>
        </header>

        <main className="p-6 space-y-6">
          {isIndexError && (
            <Alert variant="destructive" className="bg-rose-50 border-rose-200 shadow-sm rounded-2xl animate-in slide-in-from-top-2">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-sm font-black uppercase tracking-tight">
                Sincronización de Índices Requerida
              </AlertTitle>
              <AlertDescription className="text-xs leading-relaxed mt-1">
                <div className="space-y-3">
                  <p>Para habilitar los filtros avanzados en el universo de 11,150 registros, Firestore requiere un índice compuesto. Por favor, actívelo usando el enlace de abajo.</p>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline" className="h-8 text-[9px] font-black uppercase bg-white border-rose-200 text-rose-600 hover:bg-rose-100">
                      <a href="https://console.firebase.google.com/v1/r/project/studio-5519165939-247e1/firestore/indexes?create_composite=ClZwcm9qZWN0cy9zdHVkaW8tNTUxOTE2NTkzOS0yNDdlMS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvb3JkZXJzL2luZGV4ZXMvXxABGhkKFWNsYXNzaWZpY2F0aW9uX3N0YXR1cxABGg0KCXByb2plY3RJZBABGgwKCF9fbmFtZV9fEAE" target="_blank" rel="noreferrer">Activar Índice Manualmente</a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAiFilter('all')} className="h-8 text-[9px] font-black uppercase text-slate-500">Volver a Todos</Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Dashboard de Indicadores */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-5 border-none shadow-sm bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase">Universo Total</p>
                <Database className="h-4 w-4 text-primary opacity-20" />
              </div>
              <h4 className="text-3xl font-headline font-bold text-slate-800">{stats.total.toLocaleString()}</h4>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Registros en Base</p>
            </Card>
            
            <Card className="p-5 border-none shadow-sm bg-white border-l-4 border-l-emerald-500 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-emerald-600 uppercase">Procesados IA</p>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-20" />
              </div>
              <h4 className="text-3xl font-headline font-bold text-emerald-600">{stats.processed.toLocaleString()}</h4>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Clasificación Automática</p>
            </Card>

            <Card className="p-5 border-none shadow-sm bg-white border-l-4 border-l-amber-500 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-amber-600 uppercase">Por Procesar</p>
                <Clock className="h-4 w-4 text-amber-500 opacity-20" />
              </div>
              <h4 className="text-3xl font-headline font-bold text-amber-600">{stats.pending.toLocaleString()}</h4>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Pendientes de Análisis</p>
            </Card>

            <Card className="p-5 border-none shadow-sm bg-slate-900 text-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance Global</p>
                <Zap className="h-4 w-4 text-accent" />
              </div>
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <h4 className="text-3xl font-headline font-bold text-accent">{progressPercentage}%</h4>
                  <span className="text-[9px] text-slate-500 font-black mb-1 uppercase">Integridad</span>
                </div>
                <Progress value={progressPercentage} className="h-1.5 bg-slate-800" />
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
                  <TableHead className="text-[10px] font-black uppercase">Estatus IA</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">PID / Proyecto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Disciplina & Causa</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Monto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center w-[120px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-32"><RefreshCcw className="h-10 w-10 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                ) : isIndexError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-32">
                      <div className="space-y-4 max-w-sm mx-auto">
                        <Database className="h-12 w-12 mx-auto text-rose-200" />
                        <p className="text-slate-500 font-bold uppercase text-[10px] leading-relaxed">
                          Base de Datos Sincronizando Índices... Por favor, usa el filtro "Todos" mientras se completa el proceso en el servidor.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => setAiFilter('all')} className="rounded-xl text-[9px] font-black uppercase">Volver a vista general</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !orders || orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-32">
                      <div className="space-y-2">
                        <Search className="h-10 w-10 mx-auto text-slate-200" />
                        <p className="text-slate-400 font-bold uppercase text-xs">No se encontraron registros en este bloque.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : orders.map((order) => {
                  const isAuto = order.classification_status === 'auto' || order.classification_status === 'reviewed';
                  const hasDiscipline = !!order.disciplina_normalizada;
                  
                  return (
                    <TableRow key={order.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(order.id) ? 'bg-primary/5' : ''}`}>
                      <TableCell className="text-center">
                        <Checkbox 
                          checked={selectedIds.includes(order.id)} 
                          onCheckedChange={(checked) => setSelectedIds(prev => checked ? [...prev, order.id] : prev.filter(id => id !== order.id))} 
                        />
                      </TableCell>
                      <TableCell>
                        {isAuto ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black uppercase px-2">AUTO IA</Badge>
                        ) : hasDiscipline ? (
                          <Badge className="bg-blue-100 text-blue-700 border-none text-[8px] font-black uppercase px-2">IMPORTADO</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[8px] font-black border-dashed text-slate-400 uppercase px-2">PENDIENTE</Badge>
                        )}
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
                           <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight truncate max-w-[200px]">{order.causa_raiz_normalizada || order.causaRaiz || "Sin definir"}</span>
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
                                <AlertDialogTitle className="font-headline uppercase text-slate-900">¿Eliminar registro?</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-slate-500">
                                  Esta acción eliminará permanentemente la orden <strong>{order.projectId}</strong>. Los datos no podrán recuperarse.
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
                  PÁGINA {currentPage} • UNIVERSO: {stats.total.toLocaleString()}
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
                Analizando y clasificando {selectedIds.length} registros con motor Gemini 2.5 Flash.
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
