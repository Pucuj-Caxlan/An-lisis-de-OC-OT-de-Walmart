
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
  SearchCode,
  FileSearch,
  Trash2,
  Loader2,
  Microscope,
  Activity,
  Database,
  BrainCircuit,
  AlertTriangle,
  History,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  LayoutGrid,
  X,
  Lock,
  Flag,
  Signature,
  Zap,
  MoreVertical,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ZapOff,
  Rows,
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
import { collection, query, limit, doc, writeBatch, setDoc, orderBy, startAfter, getCountFromServer, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
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
  DialogFooter
} from "@/components/ui/dialog";
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MAX_BULK_AI_RECORDS = 300;
const AI_BATCH_SIZE = 3; 

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [aiFilter, setAiFilter] = useState<any>('all');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<TraceabilityReportOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Estados de Paginación y Densidad
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);

  // Estados de Selección y Procesamiento Masivo
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteMode, setDeleteMode] = useState<DeletionMode>('bulk');

  // Estados de IA Masiva
  const [showBulkAiDialog, setShowBulkAiDialog] = useState(false);
  const [isBulkAiProcessing, setIsBulkAiProcessing] = useState(false);
  const [bulkAiProgress, setBulkAiProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [bulkAiResult, setBulkAiResult] = useState<BulkIntelligenceOutput | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // SSOT: Fetch real total count once
  useEffect(() => {
    if (!db) return;
    const fetchTotal = async () => {
      const coll = collection(db, 'orders');
      const snapshot = await getCountFromServer(coll);
      setTotalInDb(snapshot.data().count);
    };
    fetchTotal();
  }, [db]);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    // Buffer SSOT de 10k para búsqueda instantánea
    return query(
      collection(db, 'orders'), 
      orderBy('projectId', 'desc'),
      limit(10000)
    );
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const classificationCounts = useMemo(() => {
    if (!orders) return { classified: 0, pending: 0, needs_review: 0, low_confidence: 0 };
    return {
      // Estricto: Debe tener estatus auto/reviewed Y el objeto de análisis semántico real
      classified: orders.filter(o => (o.classification_status === 'auto' || o.classification_status === 'reviewed') && o.semanticAnalysis).length,
      pending: orders.filter(o => !o.classification_status || o.classification_status === 'pending' || !o.semanticAnalysis).length,
      needs_review: orders.filter(o => o.needs_review === true).length,
      low_confidence: orders.filter(o => o.confidence_score && o.confidence_score < 0.6).length,
    };
  }, [orders]);

  const stats = useMemo(() => {
    const total = totalInDb || 0;
    const classified = classificationCounts.classified;
    const coverage = total > 0 ? (classified / total) * 100 : 0;
    return { total, audited: classified, coverage };
  }, [totalInDb, classificationCounts]);

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
      
      const isClassified = (o.classification_status === 'auto' || o.classification_status === 'reviewed') && o.semanticAnalysis;
      const matchesAi = aiFilter === 'all' || 
        (aiFilter === 'classified' && isClassified) ||
        (aiFilter === 'not_classified' && (!o.classification_status || o.classification_status === 'pending' || !o.semanticAnalysis)) ||
        (aiFilter === 'needs_review' && o.needs_review === true) ||
        (aiFilter === 'low_confidence' && o.confidence_score < 0.6);

      return matchesSearch && matchesAi;
    });
  }, [orders, searchTerm, aiFilter]);

  // Paginación reactiva basada en el estado pageSize
  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrdersFull.slice(start, start + pageSize);
  }, [filteredOrdersFull, currentPage, pageSize]);

  const selectedTotalAmount = useMemo(() => {
    return orders
      ?.filter(o => selectedIds.includes(o.id))
      .reduce((acc, curr) => acc + (curr.impactoNeto || 0), 0) || 0;
  }, [orders, selectedIds]);

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
        monto: order.impactoNeto,
        contexto: {
          justificacionDetallada: String(order.technicalJustification?.detailedReasoning || "").substring(0, 250)
        }
      });

      const orderRef = doc(db, 'orders', order.id);
      updateDocumentNonBlocking(orderRef, {
        disciplina_normalizada: result.disciplina_normalizada,
        causa_raiz_normalizada: result.causa_raiz_normalizada,
        subcausa_normalizada: result.subcausa_normalizada,
        semanticAnalysis: result,
        structural_quality_score: 95,
        confidence_score: result.confidence_score,
        reliability_level: 'HIGH',
        rationale_tecnico: result.rationale_tecnico,
        needs_review: result.needs_review,
        classification_status: 'auto',
        classified_at: new Date().toISOString(),
        classified_by: user.uid,
        model_version: 'gemini-2.5-flash'
      });

      toast({ 
        title: "Clasificación IA Exitosa", 
        description: `Disciplina detectada: ${result.disciplina_normalizada}` 
      });
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Fallo en IA", 
        description: "Error de conexión. Intente nuevamente." 
      });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleValidateAudit = (orderId: string) => {
    if (!db || !user) return;
    updateDocumentNonBlocking(doc(db, 'orders', orderId), {
      classification_status: 'reviewed',
      needs_review: false,
      auditedBy: user.uid,
      auditedAt: new Date().toISOString()
    });
    toast({ title: "Auditoría Validada" });
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
      
      const auditLogId = `log_${Date.now()}`;
      await setDoc(doc(db, 'audit_logs', auditLogId), {
        id: auditLogId,
        action: 'bulk_audit_validate',
        userId: user.uid,
        userEmail: user.email,
        timestamp: new Date().toISOString(),
        details: {
          count: selectedIds.length,
          totalAmount: selectedTotalAmount
        }
      });

      toast({ title: "Auditoría Masiva Completada", description: `${selectedIds.length} registros validados.` });
      setSelectedIds([]);
      setShowBulkAiDialog(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en Auditoría", description: e.message });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleBulkDeletion = async () => {
    if (!db || !user || deleteConfirmText !== 'BORRAR') return;
    setIsDeleting(true);
    try {
      await executeDeletion(db, user, deleteMode, selectedIds);
      toast({ title: "Registros Eliminados", description: "El borrado masivo finalizó con éxito." });
      setShowDeleteConfirm(false);
      setSelectedIds([]);
      setDeleteConfirmText('');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en Borrado", description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkAiAnalysis = async () => {
    if (selectedIds.length < 1) {
      toast({ variant: "destructive", title: "Selección insuficiente", description: "Seleccione al menos 1 registro pendiente." });
      return;
    }

    if (selectedIds.length > MAX_BULK_AI_RECORDS) {
      toast({ 
        variant: "destructive", 
        title: "Límite Excedido", 
        description: `Seleccione máximo ${MAX_BULK_AI_RECORDS} para estabilidad.` 
      });
      return;
    }

    setShowBulkAiDialog(true);
    setIsBulkAiProcessing(true);
    setBulkAiProgress(0);
    setProcessedCount(0);
    setBulkAiResult(null);

    try {
      const selectedOrders = orders?.filter(o => selectedIds.includes(o.id)) || [];
      let allAnomalies: any[] = [];
      let allPatterns: string[] = [];
      let allRecommendations: string[] = [];
      let finalSummary = "";
      let lastConfidence = 0;

      for (let i = 0; i < selectedOrders.length; i += AI_BATCH_SIZE) {
        const chunk = selectedOrders.slice(i, i + AI_BATCH_SIZE);
        const classifications = [];

        for (const order of chunk) {
          try {
            const semanticResult = await analyzeOrderSemantically({
              descripcion: String(order.descripcion || "").substring(0, 250),
              monto: order.impactoNeto,
              contexto: {
                justificacionDetallada: String(order.technicalJustification?.detailedReasoning || "").substring(0, 250)
              }
            });
            classifications.push({ orderId: order.id, result: semanticResult });
          } catch (e) {
            classifications.push({ orderId: order.id, result: null });
          }
        }

        const batch = writeBatch(db!);
        classifications.forEach(({ orderId, result }) => {
          if (result) {
            const ref = doc(db!, 'orders', orderId);
            batch.update(ref, {
              disciplina_normalizada: result.disciplina_normalizada,
              causa_raiz_normalizada: result.causa_raiz_normalizada,
              subcausa_normalizada: result.subcausa_normalizada,
              semanticAnalysis: result,
              structural_quality_score: 95,
              confidence_score: result.confidence_score,
              reliability_level: 'HIGH',
              rationale_tecnico: result.rationale_tecnico,
              needs_review: result.needs_review,
              classification_status: 'auto',
              classified_at: new Date().toISOString(),
              classified_by: user?.uid,
              model_version: 'gemini-2.5-flash'
            });
          }
        });
        await batch.commit();

        const chunkForBulk = chunk.map(o => {
          const classif = classifications.find(c => c.orderId === o.id)?.result;
          return {
            id: o.id,
            projectId: o.projectId,
            projectName: o.projectName,
            impactoNeto: o.impactoNeto,
            disciplina_normalizada: classif?.disciplina_normalizada || o.disciplina_normalizada,
            causa_raiz_normalizada: classif?.causa_raiz_normalizada || o.causa_raiz_normalizada,
            descripcion: String(o.descripcion || "").substring(0, 250), 
            isSigned: o.isSigned,
            fechaSolicitud: o.fechaSolicitud
          };
        });

        try {
          const chunkResult = await analyzeBulkOrders({ orders: chunkForBulk });
          allAnomalies = [...allAnomalies, ...(chunkResult.anomaliesDetected || [])];
          allPatterns = Array.from(new Set([...allPatterns, ...(chunkResult.commonPatterns || [])]));
          allRecommendations = Array.from(new Set([...allRecommendations, ...(chunkResult.recommendations || [])]));
          finalSummary = chunkResult.executiveSummary;
          lastConfidence = chunkResult.confidenceScore;

          setProcessedCount(prev => prev + chunk.length);
          setBulkAiProgress(Math.round(((i + chunk.length) / selectedOrders.length) * 100));
          
          await new Promise(r => setTimeout(r, 800)); 
        } catch (chunkError) {
          console.error(`Error en lote:`, chunkError);
        }
      }

      setBulkAiResult({
        executiveSummary: finalSummary,
        totalImpactFormatted: formatAmount(selectedTotalAmount),
        commonPatterns: allPatterns.slice(0, 8),
        recurrenceAnalysis: "Análisis semántico consolidado y sincronizado con base de datos.",
        anomaliesDetected: allAnomalies.slice(0, 10),
        disciplineImpact: [], 
        recommendations: allRecommendations.slice(0, 6),
        isEligibleForBulkAudit: allAnomalies.length < (selectedIds.length * 0.1),
        confidenceScore: lastConfidence
      });

      toast({ title: "Procesamiento Completo" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error de Conexión", description: "La red está saturada. Intente con menos registros." });
      setShowBulkAiDialog(false);
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
              <Microscope className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Auditoría & Trazabilidad</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl border shadow-inner">
              <div className="flex items-center gap-2 px-3">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] font-black text-slate-500 uppercase">Estado Clasificación IA:</span>
              </div>
              <Select value={aiFilter} onValueChange={(v) => { setAiFilter(v as any); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 min-w-[240px] bg-white border-none shadow-sm text-[10px] font-bold uppercase">
                  <SelectValue placeholder="Seleccionar estado..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos ({totalInDb || 0})</SelectItem>
                  <SelectItem value="classified" className="text-emerald-600">Clasificados IA ({classificationCounts.classified})</SelectItem>
                  <SelectItem value="not_classified" className="text-amber-600">Pendientes de Procesar ({classificationCounts.pending})</SelectItem>
                  <SelectItem value="needs_review" className="text-rose-600">Pendientes de revisión ({classificationCounts.needs_review})</SelectItem>
                  <SelectItem value="low_confidence" className="text-rose-800">Baja Confianza ({classificationCounts.low_confidence})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar PID o Proyecto..."
                className="pl-9 w-[220px] h-9 bg-slate-50 border-none shadow-sm"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Panel de Estadísticas SSOT */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Universo Total</p>
                <h4 className="text-2xl font-headline font-bold text-slate-800">{totalInDb === null ? '--' : totalInDb}</h4>
              </div>
              <Database className="h-8 w-8 text-primary/10" />
            </Card>
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Clasificados IA</p>
                <h4 className="text-2xl font-headline font-bold text-emerald-600">{classificationCounts.classified}</h4>
              </div>
              <BrainCircuit className="h-8 w-8 text-emerald-100" />
            </Card>
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendientes de Clasificación</p>
                <h4 className="text-2xl font-headline font-bold text-amber-600">{classificationCounts.pending}</h4>
              </div>
              <Clock className="h-8 w-8 text-amber-100" />
            </Card>
            <Card className="border-none shadow-sm bg-slate-900 text-white p-4 space-y-3">
              <div className="flex justify-between items-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cobertura Real de Auditoría Semántica</p>
                 <span className="text-xs font-bold text-accent">{Math.round(stats.coverage)}%</span>
              </div>
              <Progress value={stats.coverage} className="h-1.5 bg-white/10" />
              <div className="flex gap-4 pt-1">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <span className="text-[8px] font-black uppercase opacity-60">{classificationCounts.needs_review} En Revisión</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="text-[8px] font-black uppercase opacity-60">Faltan {classificationCounts.pending} registros</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Panel de Acciones Masivas */}
          {selectedIds.length > 0 && (
            <Card className="border-none shadow-xl bg-primary text-white p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-2 rounded-xl">
                  <LayoutGrid className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest opacity-80">Selección Activa</p>
                  <h4 className="text-lg font-headline font-bold">{selectedIds.length} Registros • <span className="text-accent">${formatAmount(selectedTotalAmount)}</span></h4>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleBulkAiAnalysis}
                  variant="outline" 
                  disabled={isBulkAiProcessing}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2 h-10 px-6 rounded-xl"
                >
                  {isBulkAiProcessing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Procesar y Clasificar IA
                </Button>
                <Button 
                  onClick={handleBulkAudit}
                  disabled={isAuditing}
                  className="bg-white text-primary hover:bg-white/90 gap-2 h-10 px-6 rounded-xl font-bold"
                >
                  {isAuditing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Validar Lote
                </Button>
                <Separator orientation="vertical" className="h-8 bg-white/20 mx-2" />
                <Button 
                  onClick={() => { setDeleteMode('bulk'); setShowDeleteConfirm(true); }}
                  variant="ghost" 
                  className="text-rose-200 hover:text-white hover:bg-rose-500/20 h-10 w-10 p-0 rounded-xl"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
                <Button 
                  onClick={() => setSelectedIds([])}
                  variant="ghost" 
                  className="text-white/60 hover:text-white h-10 w-10 p-0 rounded-xl"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </Card>
          )}

          <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <Checkbox 
                      checked={selectedIds.length === pagedOrders.length && pagedOrders.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Estatus IA / Trust</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">PID / Proyecto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Clasificación IA</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Auditoría</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Monto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-24"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                ) : pagedOrders.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-24 text-slate-400 font-bold uppercase italic text-xs">Sin registros que coincidan con el filtro</TableCell></TableRow>
                ) : pagedOrders.map((order) => (
                  <TableRow key={order.id} className={`hover:bg-slate-50/50 group transition-colors ${selectedIds.includes(order.id) ? 'bg-primary/5' : ''}`}>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={selectedIds.includes(order.id)}
                        onCheckedChange={() => toggleSelectOne(order.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {order.classification_status === 'reviewed' ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black h-4 px-1.5">REVIEWED</Badge>
                          ) : (order.classification_status === 'auto' && order.semanticAnalysis) ? (
                            <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black h-4 px-1.5">AUTO IA</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 border-dashed text-slate-400">PENDING</Badge>
                          )}
                          {order.needs_review && (
                            <Badge className="bg-rose-500 text-white border-none text-[8px] font-black h-4 px-1.5 animate-pulse">REVISIÓN</Badge>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-[8px] font-black border-none h-4 px-1.5 w-fit ${order.confidence_score >= 0.8 ? 'bg-emerald-50 text-emerald-600' : order.confidence_score >= 0.6 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                          {order.confidence_score ? `${Math.round(order.confidence_score * 100)}% CONFIDENCE` : 'NO SCORE'}
                        </Badge>
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
                    <TableCell className="text-center">
                      {order.classification_status === 'reviewed' ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-[7px] font-black text-slate-400 uppercase">VALIDADO</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5 opacity-30">
                          <History className="h-4 w-4 text-slate-400" />
                          <span className="text-[7px] font-black text-slate-400 uppercase">EN ESPERA</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-800 text-sm">${formatAmount(order.impactoNeto || 0)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-accent hover:bg-accent/10"
                          disabled={isAnalyzing === order.id}
                          onClick={() => handleSingleSemanticAnalysis(order)}
                        >
                          {isAnalyzing === order.id ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-primary hover:bg-primary/10"><FileSearch className="h-4 w-4" /></Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl rounded-3xl border-none shadow-2xl overflow-hidden p-0">
                            <header className="bg-slate-900 text-white p-6 flex justify-between items-center">
                              <div>
                                <Badge className="bg-accent text-slate-900 border-none text-[8px] font-black mb-1">WALMART FORENSIC FILE</Badge>
                                <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight">{order.projectId}</DialogTitle>
                                <DialogDescription className="text-slate-400 text-xs">{order.projectName}</DialogDescription>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Impacto Auditoría</p>
                                <p className="text-2xl font-headline font-bold text-primary">${formatAmount(order.impactoNeto)}</p>
                              </div>
                            </header>
                            <ScrollArea className="max-h-[70vh] bg-slate-50 p-6">
                              {reportResult ? (
                                <div className="space-y-8 animate-in fade-in duration-500">
                                  <section className="grid md:grid-cols-3 gap-6">
                                    <Card className="p-5 bg-white border-none shadow-sm rounded-2xl space-y-4">
                                      <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Resumen Ejecutivo</h4>
                                      <p className="text-xs font-medium text-slate-600 leading-relaxed">{reportResult.executiveSummary.overview}</p>
                                      <div className="pt-2">
                                        <Badge className={`${reportResult.executiveSummary.currentRisk === 'P0' ? 'bg-rose-500' : 'bg-amber-500'} text-white border-none`}>
                                          PRIORIDAD {reportResult.executiveSummary.currentRisk}
                                        </Badge>
                                      </div>
                                    </Card>
                                    <Card className="md:col-span-2 p-5 bg-slate-900 text-white border-none shadow-sm rounded-2xl relative overflow-hidden">
                                      <Zap className="absolute -bottom-4 -right-4 h-32 w-32 opacity-5 text-accent" />
                                      <h4 className="text-[10px] font-black text-accent uppercase tracking-widest">Análisis Profundo</h4>
                                      <p className="text-xs font-medium text-slate-300 leading-relaxed mt-4 italic">"{reportResult.deepAnalysis.recurrentPatterns}"</p>
                                      <div className="flex gap-2 mt-6">
                                        {reportResult.deepAnalysis.mainDrivers.map((d, i) => (
                                          <Badge key={i} className="bg-white/10 text-white border-none text-[8px] uppercase">{d}</Badge>
                                        ))}
                                      </div>
                                    </Card>
                                  </section>

                                  <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                      <History className="h-4 w-4 text-primary" /> Reconstrucción de Línea de Tiempo
                                    </h4>
                                    <div className="space-y-3">
                                      {reportResult.forensicTimeline.map((ev, i) => (
                                        <div key={i} className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-100">
                                          <div className="h-8 w-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0">
                                            <span className="text-[10px] font-black text-slate-400">{i + 1}</span>
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-[10px] font-bold text-slate-800">{ev.event}</p>
                                            <p className="text-[9px] text-slate-400 uppercase">{ev.evidence}</p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-[10px] font-black text-primary">{ev.date}</p>
                                            {ev.gapDays !== undefined && <p className="text-[8px] text-emerald-500 font-bold">+{ev.gapDays} DÍAS</p>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </section>

                                  <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Planes de Acción Sugeridos</h4>
                                    <div className="grid md:grid-cols-2 gap-4">
                                      {reportResult.recommendations.map((rec, i) => (
                                        <div key={i} className={`p-4 rounded-2xl border-2 ${rec.priority === 'Alta' ? 'border-rose-100 bg-rose-50/30' : 'border-slate-100 bg-white'}`}>
                                          <div className="flex justify-between items-start mb-2">
                                            <Badge className={`${rec.type === 'Correctiva' ? 'bg-rose-500' : 'bg-primary'} text-white text-[8px] uppercase border-none`}>{rec.type}</Badge>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">{rec.owner}</span>
                                          </div>
                                          <p className="text-[11px] font-bold text-slate-800 leading-tight">{rec.action}</p>
                                          <p className="text-[9px] text-slate-500 mt-2 italic">Impacto: {rec.expectedImpact}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </section>
                                </div>
                              ) : (
                                <div className="grid md:grid-cols-3 gap-6">
                                  <Card className="p-4 bg-white border-none shadow-sm rounded-2xl space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Nivel de Integridad</h4>
                                    <div className="flex items-end justify-between">
                                      <span className="text-4xl font-headline font-bold">{order.structural_quality_score || 0}%</span>
                                      <Badge variant="outline" className="text-[8px] font-black">{order.reliability_level}</Badge>
                                    </div>
                                    <Progress value={order.structural_quality_score || 0} className="h-1.5" />
                                    <p className="text-[10px] text-slate-500 italic">Score calculado por el motor estructural basado en variables institucionales.</p>
                                  </Card>
                                  <Card className="md:col-span-2 p-4 bg-slate-900 text-white border-none shadow-sm rounded-2xl relative overflow-hidden">
                                    <BrainCircuit className="absolute -bottom-2 -right-2 h-20 w-20 opacity-5" />
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" /> Rationale Forense</h4>
                                    <p className="text-xs font-medium text-slate-300 leading-relaxed italic mt-4">"{order.rationale_tecnico || "Analizando coherencia semántica entre descripción y causa raíz histórica..."}"</p>
                                    <div className="flex gap-2 mt-6">
                                      <Badge className="bg-white/10 text-white border-none text-[8px] uppercase">{order.disciplina_normalizada}</Badge>
                                      <Badge className="bg-white/10 text-white border-none text-[8px] uppercase">{order.causa_raiz_normalizada}</Badge>
                                    </div>
                                  </Card>
                                  <div className="md:col-span-3 mt-6">
                                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Detalle de Inferencia Estructural</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Trazabilidad PDF</p>
                                        <p className="text-[10px] font-bold uppercase">{order.pdf_traceability_reconstructed ? 'SÍ (Reconstruida)' : 'NO'}</p>
                                      </div>
                                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Fuente Original</p>
                                        <p className="text-[10px] font-bold uppercase">{order.dataSource}</p>
                                      </div>
                                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Firmas Detectadas</p>
                                        <p className="text-[10px] font-bold uppercase">{order.isSigned ? 'SÍ (DocuSign)' : 'BITÁCORA NO FIRMADA'}</p>
                                      </div>
                                      <div className="bg-white p-3 rounded-xl border border-slate-100">
                                        <p className="text-[8px] font-black text-slate-400 uppercase">Fecha Solicitud</p>
                                        <p className="text-[10px] font-bold uppercase">{order.fechaSolicitud || 'N/A'}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </ScrollArea>
                            <footer className="p-4 bg-white border-t flex justify-end gap-3">
                              <Button 
                                variant="outline" 
                                className="rounded-xl uppercase text-[9px] font-black px-6 h-9"
                                disabled={isGeneratingReport}
                                onClick={async () => {
                                  setIsGeneratingReport(true);
                                  try {
                                    const result = await generateTraceabilityReport({ orderData: order });
                                    setReportResult(result);
                                  } catch (e) {
                                    toast({ variant: "destructive", title: "Fallo al generar reporte" });
                                  } finally {
                                    setIsGeneratingReport(false);
                                  }
                                }}
                              >
                                {isGeneratingReport ? <RefreshCcw className="h-3 w-3 animate-spin mr-2" /> : <TrendingUp className="h-3 w-3 mr-2" />}
                                Generar Reporte 360
                              </Button>
                              <Button onClick={() => handleValidateAudit(order.id)} className="rounded-xl uppercase text-[9px] font-black px-8 h-9 shadow-lg shadow-primary/20">Validar Auditoría</Button>
                            </footer>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50" onClick={() => { setSelectedIds([order.id]); setDeleteMode('single'); setShowDeleteConfirm(true); }}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination Controls con Selector de Densidad */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t">
              <div className="flex items-center gap-6">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Mostrando {((currentPage - 1) * pageSize) + 1} – {Math.min(currentPage * pageSize, filteredOrdersFull.length)} de {filteredOrdersFull.length} registros filtrados (Universo: {totalInDb})
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Filas:</span>
                  <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); setSelectedIds([]); }}>
                    <SelectTrigger className="h-7 w-[100px] bg-white border shadow-sm text-[10px] font-bold uppercase">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 / Pág</SelectItem>
                      <SelectItem value="250">250 / Pág</SelectItem>
                      <SelectItem value="500">500 / Pág</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrevPage} 
                  disabled={currentPage === 1 || isLoading}
                  className="rounded-lg h-8 px-3 gap-1 uppercase text-[9px] font-black"
                >
                  <ChevronLeft className="h-3 w-3" /> Anterior
                </Button>
                <div className="bg-white border rounded-lg h-8 px-4 flex items-center justify-center text-[10px] font-black text-primary">
                  PÁGINA {currentPage}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleNextPage} 
                  disabled={currentPage * pageSize >= filteredOrdersFull.length || isLoading}
                  className="rounded-lg h-8 px-3 gap-1 uppercase text-[9px] font-black"
                >
                  Siguiente <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        </main>

        {/* Diálogos */}
        <Dialog open={showBulkAiDialog} onOpenChange={setShowBulkAiDialog}>
          <DialogContent className="max-w-3xl rounded-3xl border-none shadow-2xl p-0 overflow-hidden bg-white">
            <header className="bg-slate-900 text-white p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-primary p-2 rounded-xl">
                  <BrainCircuit className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight">Inteligencia de Grupo IA</DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs uppercase">Analizando {selectedIds.length} registros seleccionados</DialogDescription>
                </div>
              </div>
              <Button variant="ghost" onClick={() => setShowBulkAiDialog(false)} className="text-white/70 hover:text-white h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="p-8">
              {isBulkAiProcessing ? (
                <div className="space-y-8 py-12 text-center">
                  <div className="relative h-24 w-24 mx-auto">
                    <RefreshCcw className="h-24 w-24 text-primary opacity-10 animate-spin" />
                    <Sparkles className="h-8 w-8 text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-800 uppercase tracking-widest">Orquestando Lotes Forenses...</h3>
                    <p className="text-xs text-slate-400">Procesando secuencialmente para máxima estabilidad.</p>
                  </div>
                  <div className="max-w-xs mx-auto space-y-2">
                    <div className="flex justify-between text-[10px] font-black text-primary">
                      <span>{processedCount} DE {selectedIds.length} REGISTROS</span>
                      <span>{bulkAiProgress}%</span>
                    </div>
                    <Progress value={bulkAiProgress} className="h-1.5" />
                  </div>
                </div>
              ) : bulkAiResult ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="bg-slate-50 p-6 rounded-2xl border-2 border-primary/10 relative overflow-hidden">
                    <Zap className="absolute top-2 right-2 h-12 w-12 text-primary/5" />
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">Resumen de Inteligencia Consolidada</h4>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed italic">"{bulkAiResult.executiveSummary}"</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-rose-500" /> Anomalías Detectadas ({bulkAiResult.anomaliesDetected.length})
                      </h4>
                      <ScrollArea className="h-48 pr-4">
                        <div className="space-y-2">
                          {bulkAiResult.anomaliesDetected.map((anom, i) => (
                            <div key={i} className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                              <p className="text-[10px] font-bold text-rose-900">{anom.issue}</p>
                              <p className="text-[9px] text-rose-700/70">{anom.description}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Recomendaciones de Mitigación
                      </h4>
                      <ScrollArea className="h-48 pr-4">
                        <div className="space-y-2">
                          {bulkAiResult.recommendations.map((rec, i) => (
                            <div key={i} className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-start gap-2">
                              <Zap className="h-3 w-3 text-emerald-600 mt-0.5" />
                              <p className="text-[10px] font-bold text-emerald-900">{rec}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-between items-center border-t">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Impacto Total Auditado</p>
                      <p className="text-xl font-headline font-bold text-primary">${formatAmount(selectedTotalAmount)}</p>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setShowBulkAiDialog(false)} className="rounded-xl h-10 px-6 uppercase text-[10px] font-black">Cerrar</Button>
                      <Button 
                        onClick={handleBulkAudit}
                        className="rounded-xl h-10 px-8 bg-primary hover:bg-primary/90 text-white uppercase text-[10px] font-black shadow-lg shadow-primary/20"
                      >
                        Validar y Auditar Lote
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden bg-white max-w-md">
            <div className="bg-rose-600 text-white p-6 flex flex-col items-center text-center space-y-2">
              <div className="bg-white/20 p-3 rounded-full mb-2">
                <ShieldAlert className="h-8 w-8 text-white" />
              </div>
              <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight">Protocolo de Seguridad</DialogTitle>
              <DialogDescription className="text-rose-100 text-xs">
                {deleteMode === 'bulk' ? `Está por eliminar ${selectedIds.length} registros del sistema.` : 'Está por eliminar este registro de forma permanente.'}
              </DialogDescription>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2 text-center">
                <p className="text-sm font-bold text-slate-700">Para confirmar esta acción, escriba <span className="text-rose-600 font-black">"BORRAR"</span> a continuación:</p>
                <Input 
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="Escriba aquí..."
                  className="text-center h-12 text-lg font-black tracking-widest border-2 focus-visible:ring-rose-500"
                />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1 h-12 rounded-xl uppercase text-[10px] font-black">Cancelar</Button>
                <Button 
                  onClick={handleBulkDeletion}
                  disabled={deleteConfirmText !== 'BORRAR' || isDeleting}
                  variant="destructive"
                  className="flex-1 h-12 rounded-xl uppercase text-[10px] font-black bg-rose-600 hover:bg-rose-700"
                >
                  {isDeleting ? <RefreshCcw className="h-4 w-4 animate-spin" /> : 'Confirmar Borrado'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </SidebarInset>
    </div>
  );
}
