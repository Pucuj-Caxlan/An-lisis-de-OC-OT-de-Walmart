
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
  LayoutGrid, 
  X, 
  Filter,
  ListOrdered
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
  writeBatch, 
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
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user, isAuthReady } = useUser();
  const [pageSize, setPageSize] = useState(500);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageHistory, setPageHistory] = useState<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);
  const [totalGlobal, setTotalGlobal] = useState<number>(0);
  const [aiFilter, setAiFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [showBulkAiDialog, setShowBulkAiDialog] = useState(false);
  const [bulkAiProgress, setBulkAiProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // SSOT: Total real del servidor
  useEffect(() => {
    if (!db || !isAuthReady) return;
    const fetchCount = async () => {
      try {
        const q = query(collection(db, 'orders'));
        const snapshot = await getCountFromServer(q);
        setTotalGlobal(snapshot.data().count);
      } catch (e) {
        console.error("Count Error:", e);
      }
    };
    fetchCount();
  }, [db, isAuthReady]);

  // Query Paginada por Cursores
  const ordersQuery = useMemoFirebase(() => {
    if (!db || !isAuthReady) return null;
    
    let q = collection(db, 'orders');
    
    // Filtros
    let baseQuery;
    if (aiFilter === 'all') {
      baseQuery = query(q, orderBy('projectId', 'asc'), orderBy('projectName', 'asc'), limit(pageSize));
    } else {
      const statusValue = aiFilter === 'classified' ? 'auto' : 'pending';
      baseQuery = query(q, where('classification_status', '==', statusValue), orderBy('projectId', 'asc'), orderBy('projectName', 'asc'), limit(pageSize));
    }

    // Cursor
    const currentCursor = pageHistory[currentPage - 1];
    if (currentCursor) {
      baseQuery = query(baseQuery, startAfter(currentCursor));
    }

    return baseQuery;
  }, [db, isAuthReady, pageSize, currentPage, aiFilter, pageHistory]);

  const { data: orders, isLoading, snapshot } = useCollection(ordersQuery);

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
    } catch (e) {
      toast({ variant: "destructive", title: "Error IA", description: "Fallo en motor Gemini." });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleBulkAiAnalysis = async () => {
    if (selectedIds.length === 0 || !db) return;
    setShowBulkAiDialog(true);
    setBulkAiProgress(0);
    setProcessedCount(0);

    const BATCH_SIZE = 5;
    const selectedOrders = orders?.filter(o => selectedIds.includes(o.id)) || [];
    
    for (let i = 0; i < selectedOrders.length; i += BATCH_SIZE) {
      const chunk = selectedOrders.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);

      for (const order of chunk) {
        try {
          const result = await analyzeOrderSemantically({
            descripcion: String(order.descripcion || "").substring(0, 250),
            monto: order.impactoNeto
          });
          const ref = doc(db, 'orders', order.id);
          batch.update(ref, {
            disciplina_normalizada: result.disciplina_normalizada,
            causa_raiz_normalizada: result.causa_raiz_normalizada,
            classification_status: 'auto',
            processedAt: new Date().toISOString()
          });
        } catch (e) {}
      }
      await batch.commit();
      setProcessedCount(prev => prev + chunk.length);
      setBulkAiProgress(Math.round(((i + chunk.length) / selectedOrders.length) * 100));
    }
    
    toast({ title: "Lote Procesado" });
    setShowBulkAiDialog(false);
    setSelectedIds([]);
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 uppercase">Universo de Registros</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); setPageHistory([null]); }}>
              <SelectTrigger className="h-8 w-24 text-[10px] font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="300">300</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
            <Select value={aiFilter} onValueChange={(v) => { setAiFilter(v); setCurrentPage(1); setPageHistory([null]); }}>
              <SelectTrigger className="h-8 min-w-[180px] text-[10px] font-bold uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los registros</SelectItem>
                <SelectItem value="classified">Procesados IA</SelectItem>
                <SelectItem value="not_classified">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 flex items-center justify-between border-none shadow-sm bg-white">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Universo Total Real</p>
                <h4 className="text-2xl font-headline font-bold">{totalGlobal.toLocaleString()}</h4>
              </div>
              <Database className="h-8 w-8 text-primary/10" />
            </Card>
            <Card className="p-4 flex items-center justify-between border-none shadow-sm bg-white">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">Página Actual</p>
                <h4 className="text-2xl font-headline font-bold text-emerald-600">{currentPage}</h4>
              </div>
              <ListOrdered className="h-8 w-8 text-emerald-100" />
            </Card>
            <Card className="p-4 border-none shadow-sm bg-slate-900 text-white">
              <p className="text-[10px] font-black text-slate-400 uppercase">Registros en Vista</p>
              <h4 className="text-2xl font-headline font-bold text-accent">{orders?.length || 0}</h4>
            </Card>
          </div>

          {selectedIds.length > 0 && (
            <Card className="p-4 flex items-center justify-between border-none shadow-xl bg-primary text-white animate-in slide-in-from-top-2">
              <div className="flex items-center gap-4">
                <LayoutGrid className="h-5 w-5" />
                <h4 className="text-lg font-bold">{selectedIds.length} Seleccionados</h4>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleBulkAiAnalysis} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <Sparkles className="h-4 w-4 mr-2" /> Clasificar Lote con IA
                </Button>
                <Button onClick={() => setSelectedIds([])} variant="ghost" className="text-white/60"><X className="h-5 w-5" /></Button>
              </div>
            </Card>
          )}

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
                  <TableHead className="text-[10px] font-black uppercase">Clasificación IA</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Monto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-24"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                ) : !orders || orders.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-24 text-slate-400 font-bold uppercase text-xs italic">Sin registros en este bloque</TableCell></TableRow>
                ) : orders.map((order) => (
                  <TableRow key={order.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(order.id) ? 'bg-primary/5' : ''}`}>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedIds.includes(order.id)} 
                        onCheckedChange={(checked) => setSelectedIds(prev => checked ? [...prev, order.id] : prev.filter(id => id !== order.id))} 
                      />
                    </TableCell>
                    <TableCell>
                      {order.classification_status === 'auto' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black">AUTO IA</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] font-black border-dashed text-slate-400">PENDING</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-black text-primary text-sm">{order.projectId}</span>
                        <span className="text-[9px] text-slate-400 uppercase truncate max-w-[150px]">{order.projectName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                         <span className="font-bold text-slate-700 text-xs">{order.disciplina_normalizada || "—"}</span>
                         <span className="text-[9px] text-slate-400 uppercase font-bold">{order.causa_raiz_normalizada || order.causaRaiz}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-800 text-sm">${formatAmount(order.impactoNeto || 0)}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleSingleSemanticAnalysis(order)} disabled={!!isAnalyzing}>
                        {isAnalyzing === order.id ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-accent" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t">
              <div className="text-[10px] font-black text-slate-400 uppercase">
                Página {currentPage} • Bloque de {pageSize} • Universo: {totalGlobal.toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1} className="text-[9px] font-black px-4">
                  <ChevronLeft className="h-4 w-4 mr-1" /> ANTERIOR
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!orders || orders.length < pageSize} className="text-[9px] font-black px-4">
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
              <DialogTitle className="text-xl font-bold uppercase">Procesando Universo IA</DialogTitle>
              <DialogDescription className="text-slate-500 mt-2">Clasificando {selectedIds.length} registros con motor Gemini.</DialogDescription>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black text-primary">
                <span>{processedCount} DE {selectedIds.length}</span>
                <span>{bulkAiProgress}%</span>
              </div>
              <Progress value={bulkAiProgress} className="h-1.5" />
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </div>
  );
}
