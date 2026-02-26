
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  RefreshCcw,
  Sparkles,
  ShieldAlert,
  Filter,
  FileSearch,
  Trash2,
  Database,
  BrainCircuit,
  History,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  LayoutGrid,
  X,
  Zap,
  ChevronLeft,
  ChevronRight,
  Clock
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
import { collection, query, limit, doc, writeBatch, setDoc, orderBy, getCountFromServer } from 'firebase/firestore';
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import { generateTraceabilityReport, TraceabilityReportOutput } from '@/ai/flows/traceability-report-flow';
import { analyzeBulkOrders, BulkIntelligenceOutput } from '@/ai/flows/bulk-intelligence-analysis-flow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { executeDeletion, DeletionMode } from '@/lib/deletion-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

const MAX_BULK_AI_RECORDS = 500;
const AI_BATCH_SIZE = 5; 

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [aiFilter, setAiFilter] = useState<string>('all');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showBulkAiDialog, setShowBulkAiDialog] = useState(false);
  const [isBulkAiProcessing, setIsBulkAiProcessing] = useState(false);
  const [bulkAiProgress, setBulkAiProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  // Sincronización del conteo real desde el servidor
  useEffect(() => {
    if (!db || !user?.uid) return;
    const fetchTotal = async () => {
      try {
        const coll = collection(db, 'orders');
        const snapshot = await getCountFromServer(coll);
        setTotalInDb(snapshot.data().count);
      } catch (e) {
        console.warn("Fallo al obtener conteo total:", e);
      }
    };
    fetchTotal();
  }, [db, user?.uid]);

  const ordersQuery = useMemoFirebase(() => {
    // Esperar a que el usuario esté autenticado para evitar error de permisos
    if (!db || !user?.uid) return null;
    return query(
      collection(db, 'orders'), 
      orderBy('projectId', 'desc'),
      limit(20000) // Buffer ampliado para tus 11,150 registros
    );
  }, [db, user?.uid]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  // Lógica de clasificación unificada para que el frontend vea lo que la IA escribe
  const classificationCounts = useMemo(() => {
    if (!orders) return { classified: 0, pending: 0, needs_review: 0, low_confidence: 0 };
    return {
      classified: orders.filter(o => (o.classification_status === 'auto' || o.classification_status === 'reviewed')).length,
      pending: orders.filter(o => !o.classification_status || o.classification_status === 'pending').length,
      needs_review: orders.filter(o => o.needs_review === true).length,
      low_confidence: orders.filter(o => o.confidence_score && o.confidence_score < 0.6).length,
    };
  }, [orders]);

  const stats = useMemo(() => {
    const total = totalInDb || orders?.length || 0;
    const classified = classificationCounts.classified;
    const coverage = total > 0 ? (classified / total) * 100 : 0;
    return { total, audited: classified, coverage };
  }, [totalInDb, classificationCounts, orders]);

  const formatAmount = (amount: number) => {
    if (!mounted) return "0.00";
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const filteredOrdersFull = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      const searchStr = searchTerm.toLowerCase();
      const pid = String(o.projectId || "").toLowerCase();
      const projectName = String(o.projectName || "").toLowerCase();
      const matchesSearch = pid.includes(searchStr) || projectName.includes(searchStr);
      
      const isClassified = (o.classification_status === 'auto' || o.classification_status === 'reviewed');
      const isPending = !o.classification_status || o.classification_status === 'pending';
      
      const matchesAi = aiFilter === 'all' || 
        (aiFilter === 'classified' && isClassified) ||
        (aiFilter === 'not_classified' && isPending) ||
        (aiFilter === 'needs_review' && o.needs_review === true) ||
        (aiFilter === 'low_confidence' && o.confidence_score < 0.6);

      return matchesSearch && matchesAi;
    });
  }, [orders, searchTerm, aiFilter]);

  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrdersFull.slice(start, start + pageSize);
  }, [filteredOrdersFull, currentPage, pageSize]);

  const toggleSelectAll = () => {
    if (selectedIds.length === pagedOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pagedOrders.map(o => o.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleNextPage = () => {
    if (currentPage * pageSize < filteredOrdersFull.length) {
      setCurrentPage(prev => prev + 1);
      setSelectedIds([]);
    }
  };

  const handlePrevPage = () => {
    if (currentPage === 1) return;
    setCurrentPage(prev => prev - 1);
    setSelectedIds([]);
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
        semanticAnalysis: result,
        confidence_score: result.confidence_score,
        needs_review: result.needs_review,
        classification_status: 'auto',
        classified_at: new Date().toISOString(),
        classified_by: user.uid
      });

      toast({ 
        title: "Proceso Ejecutado", 
        description: `Registro clasificado como: ${result.disciplina_normalizada}` 
      });
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Fallo en IA", 
        description: "Error de conexión con el motor Gemini." 
      });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleBulkAudit = async () => {
    if (!db || !user || selectedIds.length === 0) return;
    setIsAuditing(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, 'orders', id);
        batch.update(ref, {
          classification_status: 'reviewed',
          needs_review: false,
          auditedBy: user.uid,
          auditedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      
      toast({ title: "Auditoría Masiva Completada", description: `${selectedIds.length} registros validados.` });
      setSelectedIds([]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en Auditoría", description: e.message });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleBulkAiAnalysis = async () => {
    if (selectedIds.length < 1) {
      toast({ variant: "destructive", title: "Selección insuficiente", description: "Seleccione registros pendientes." });
      return;
    }

    setShowBulkAiDialog(true);
    setIsBulkAiProcessing(true);
    setBulkAiProgress(0);
    setProcessedCount(0);

    try {
      const selectedOrders = orders?.filter(o => selectedIds.includes(o.id)) || [];
      for (let i = 0; i < selectedOrders.length; i += AI_BATCH_SIZE) {
        const chunk = selectedOrders.slice(i, i + AI_BATCH_SIZE);
        const batch = writeBatch(db!);

        for (const order of chunk) {
          try {
            const result = await analyzeOrderSemantically({
              descripcion: String(order.descripcion || "").substring(0, 250),
              monto: order.impactoNeto
            });
            
            const ref = doc(db!, 'orders', order.id);
            batch.update(ref, {
              disciplina_normalizada: result.disciplina_normalizada,
              causa_raiz_normalizada: result.causa_raiz_normalizada,
              subcausa_normalizada: result.subcausa_normalizada,
              semanticAnalysis: result,
              confidence_score: result.confidence_score,
              needs_review: result.needs_review,
              classification_status: 'auto',
              classified_at: new Date().toISOString(),
              classified_by: user?.uid
            });
          } catch (e) {}
        }

        await batch.commit();
        setProcessedCount(prev => prev + chunk.length);
        setBulkAiProgress(Math.round(((i + chunk.length) / selectedOrders.length) * 100));
      }

      toast({ title: "Procesamiento Completo", description: "El universo de datos ha sido actualizado." });
      setShowBulkAiDialog(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error de Lote", description: "Fallo parcial en la clasificación." });
    } finally {
      setIsBulkAiProcessing(false);
    }
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
              <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Auditoría de Universo Completo</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl border shadow-inner">
              <div className="flex items-center gap-2 px-3">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] font-black text-slate-500 uppercase">Estado IA:</span>
              </div>
              <Select value={aiFilter} onValueChange={(v) => { setAiFilter(v); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 min-w-[240px] bg-white border-none shadow-sm text-[10px] font-bold uppercase">
                  <SelectValue placeholder="Filtrar por estatus..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los registros ({totalInDb || orders?.length || 0})</SelectItem>
                  <SelectItem value="classified" className="text-emerald-600">Procesados IA ({classificationCounts.classified})</SelectItem>
                  <SelectItem value="not_classified" className="text-amber-600">Pendientes de Clasificación ({classificationCounts.pending})</SelectItem>
                  <SelectItem value="needs_review" className="text-rose-600">Requieren Revisión ({classificationCounts.needs_review})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar PID..."
                className="pl-9 w-[200px] h-9 bg-slate-50 border-none shadow-sm"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Universo Total</p>
                <h4 className="text-2xl font-headline font-bold text-slate-800">{totalInDb === null ? (orders?.length || '--') : totalInDb}</h4>
              </div>
              <Database className="h-8 w-8 text-primary/10" />
            </Card>
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Procesados IA</p>
                <h4 className="text-2xl font-headline font-bold text-emerald-600">{classificationCounts.classified}</h4>
              </div>
              <BrainCircuit className="h-8 w-8 text-emerald-100" />
            </Card>
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Pendientes</p>
                <h4 className="text-2xl font-headline font-bold text-amber-600">{classificationCounts.pending}</h4>
              </div>
              <Clock className="h-8 w-8 text-amber-100" />
            </Card>
            <Card className="border-none shadow-sm bg-slate-900 text-white p-4 space-y-3">
              <div className="flex justify-between items-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase">Cobertura de Auditoría</p>
                 <span className="text-xs font-bold text-accent">{Math.round(stats.coverage)}%</span>
              </div>
              <Progress value={stats.coverage} className="h-1.5 bg-white/10" />
            </Card>
          </div>

          {selectedIds.length > 0 && (
            <Card className="border-none shadow-xl bg-primary text-white p-4 flex items-center justify-between animate-in slide-in-from-top-2">
              <div className="flex items-center gap-4">
                <LayoutGrid className="h-5 w-5" />
                <h4 className="text-lg font-bold">{selectedIds.length} Registros Seleccionados</h4>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleBulkAiAnalysis} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <Sparkles className="h-4 w-4 mr-2" /> Clasificar con IA
                </Button>
                <Button onClick={handleBulkAudit} className="bg-white text-primary hover:bg-white/90 font-bold">
                  Validar Lote
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
                    <Checkbox checked={selectedIds.length === pagedOrders.length && pagedOrders.length > 0} onCheckedChange={toggleSelectAll} />
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
                ) : pagedOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-24 text-slate-400 font-bold uppercase italic text-xs">Sin registros que coincidan con el filtro</TableCell></TableRow>
                ) : pagedOrders.map((order) => (
                  <TableRow key={order.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(order.id) ? 'bg-primary/5' : ''}`}>
                    <TableCell className="text-center">
                      <Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={() => toggleSelectOne(order.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {order.classification_status === 'reviewed' ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black">REVIEWED</Badge>
                        ) : order.classification_status === 'auto' ? (
                          <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black">AUTO IA</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[8px] font-black border-dashed text-slate-400">PENDING</Badge>
                        )}
                      </div>
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
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleSingleSemanticAnalysis(order)} disabled={isAnalyzing === order.id}>
                        {isAnalyzing === order.id ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-accent" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t">
              <div className="text-[10px] font-black text-slate-400 uppercase">
                Mostrando {((currentPage - 1) * pageSize) + 1} – {Math.min(currentPage * pageSize, filteredOrdersFull.length)} de {filteredOrdersFull.length} (Universo: {totalInDb})
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1} className="text-[9px] font-black">ANTERIOR</Button>
                <div className="bg-white border rounded px-4 h-8 flex items-center text-[10px] font-black text-primary">PÁGINA {currentPage}</div>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage * pageSize >= filteredOrdersFull.length} className="text-[9px] font-black">SIGUIENTE</Button>
              </div>
            </div>
          </Card>
        </main>

        <Dialog open={showBulkAiDialog} onOpenChange={setShowBulkAiDialog}>
          <DialogContent className="max-w-md rounded-3xl p-8 text-center space-y-6">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <RefreshCcw className="h-10 w-10 text-primary animate-spin" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold uppercase">Procesando Universo de Datos</DialogTitle>
              <DialogDescription className="text-slate-500 mt-2">
                Clasificando {selectedIds.length} registros con el motor Gemini Forense.
              </DialogDescription>
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
