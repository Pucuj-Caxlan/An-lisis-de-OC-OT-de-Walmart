
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
  FileText,
  Clock,
  ArrowRight,
  Target,
  FileDown,
  Signature,
  Activity,
  Database,
  BrainCircuit,
  AlertTriangle,
  History,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  LayoutGrid,
  ListChecks
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
import { collection, query, limit, doc, writeBatch } from 'firebase/firestore';
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import { generateTraceabilityReport, TraceabilityReportOutput } from '@/ai/flows/traceability-report-flow';
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

const DISCIPLINAS_CATALOGO = ["Eléctrica", "Civil", "Estructura Metálica", "HVAC", "Legal/Permisos", "Prototipos", "Contra Incendio", "Indefinida"];
const CAUSAS_CATALOGO = ["Error Diseño", "Cambio Prototipo", "Omisión Contratista", "Requerimiento Autoridad", "Interferencia Constructiva", "Otros"];

type AuditStatus = 'all' | 'pending' | 'audited' | 'review' | 'manual';

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AuditStatus>('all');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<TraceabilityReportOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAuditConfirm, setShowAuditConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteMode, setDeleteMode] = useState<DeletionMode>('bulk');

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    disciplina: '',
    causa: '',
    subcausa: ''
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), limit(1000));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const stats = useMemo(() => {
    if (!orders) return { total: 0, audited: 0, pending: 0, review: 0, progress: 0 };
    const total = orders.length;
    const audited = orders.filter(o => o.classification_status === 'reviewed' || o.classification_status === 'overridden').length;
    const review = orders.filter(o => o.needs_review).length;
    const pending = total - audited;
    const progress = total > 0 ? (audited / total) * 100 : 0;
    return { total, audited, pending, review, progress };
  }, [orders]);

  const formatAmount = (amount: number) => {
    if (!mounted) return "0.00";
    return new Intl.NumberFormat('es-MX', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(amount);
  };

  const filteredOrders = useMemo(() => {
    return orders?.filter(o => {
      const searchStr = searchTerm.toLowerCase();
      const pid = String(o.projectId || "").toLowerCase();
      const matchesSearch = pid.includes(searchStr);
      
      const isAudited = o.classification_status === 'reviewed' || o.classification_status === 'overridden';
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'pending' && !isAudited && !o.needs_review) ||
        (statusFilter === 'audited' && isAudited) ||
        (statusFilter === 'review' && o.needs_review) ||
        (statusFilter === 'manual' && o.classification_status === 'overridden');

      return matchesSearch && matchesStatus;
    }) || [];
  }, [orders, searchTerm, statusFilter]);

  const selectedImpact = useMemo(() => {
    return selectedIds.reduce((acc, id) => {
      const order = orders?.find(o => o.id === id);
      return acc + (order?.impactoNeto || 0);
    }, 0);
  }, [selectedIds, orders]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredOrders.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkAudit = async () => {
    if (!db || !user || selectedIds.length === 0) return;
    setIsAuditing(true);
    try {
      const batchSize = 500;
      for (let i = 0; i < selectedIds.length; i += batchSize) {
        const chunk = selectedIds.slice(i, i + batchSize);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          const docRef = doc(db, 'orders', id);
          batch.update(docRef, {
            classification_status: 'reviewed',
            needs_review: false,
            auditedBy: user.uid,
            auditedAt: new Date().toISOString(),
            classified_at: new Date().toISOString()
          });
        });
        await batch.commit();
      }
      toast({ title: "Auditoría Masiva Exitosa", description: `Se han validado ${selectedIds.length} registros.` });
      setSelectedIds([]);
      setShowAuditConfirm(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error en Auditoría", description: error.message });
    } finally {
      setIsAuditing(false);
    }
  };

  const processDelete = async () => {
    if (deleteConfirmText !== 'BORRAR') {
      toast({ variant: "destructive", title: "Confirmación Inválida", description: "Escriba BORRAR para continuar." });
      return;
    }
    if (!db || !user) return;
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    try {
      const idsToDelete = deleteMode === 'all' ? filteredOrders.map(o => o.id) : selectedIds;
      await executeDeletion(db, user, deleteMode, idsToDelete, { searchTerm, statusFilter });
      toast({ title: "Borrado Exitoso", description: `Se han eliminado los registros.` });
      setSelectedIds([]);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al borrar", description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateReport = async (order: any) => {
    setIsGeneratingReport(true);
    setReportResult(null);
    try {
      const report = await generateTraceabilityReport({ orderData: order });
      setReportResult(report);
      toast({ title: "Informe Generado", description: "El análisis forense está listo." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Informe", description: error.message });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleReanalyzeWithAi = async (order: any) => {
    if (!db) return;
    setIsAnalyzing(order.id);
    try {
      const result = await analyzeOrderSemantically({
        descripcion: order.descripcion || order.description || "",
        monto: order.impactoNeto || 0
      });
      updateDocumentNonBlocking(doc(db, 'orders', order.id), {
        ...result,
        classification_status: 'auto',
        classified_at: new Date().toISOString()
      });
      toast({ title: "Re-análisis Exitoso", description: "La clasificación ha sido actualizada por Gemini." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error IA", description: error.message });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleValidateAudit = (order: any) => {
    if (!db || !user) return;
    updateDocumentNonBlocking(doc(db, 'orders', order.id), {
      classification_status: 'reviewed',
      needs_review: false,
      auditedBy: user.uid,
      auditedAt: new Date().toISOString(),
      classified_at: new Date().toISOString()
    });
    toast({ title: "Auditoría Validada" });
  };

  const handleStartEditing = (order: any) => {
    setEditValues({
      disciplina: order.disciplina_normalizada || '',
      causa: order.causa_raiz_normalizada || '',
      subcausa: order.subcausa_normalizada || ''
    });
    setIsEditing(true);
  };

  const handleSaveManualOverride = (orderId: string) => {
    if (!db || !user) return;
    updateDocumentNonBlocking(doc(db, 'orders', orderId), {
      disciplina_normalizada: editValues.disciplina,
      causa_raiz_normalizada: editValues.causa,
      subcausa_normalizada: editValues.subcausa,
      classification_status: 'overridden',
      needs_review: false,
      auditedBy: user.uid,
      auditedAt: new Date().toISOString(),
      classified_at: new Date().toISOString()
    });
    setIsEditing(false);
    toast({ title: "Corrección Guardada" });
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
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Auditoría & Trazabilidad</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in">
                <Button 
                  onClick={() => setShowAuditConfirm(true)}
                  variant="default" 
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-700 h-9 gap-2 px-4 shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4" /> AUDITAR ({selectedIds.length})
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="gap-2 h-9 px-4"
                  onClick={() => { setDeleteMode('bulk'); setDeleteConfirmText(''); setShowDeleteConfirm(true); }}
                >
                  <Trash2 className="h-4 w-4" /> BORRAR
                </Button>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar PID..."
                className="pl-9 w-[220px] h-9 bg-slate-50 border-none shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 border-none shadow-sm"><Filter className="h-4 w-4" /> {statusFilter.toUpperCase()}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setStatusFilter('all')} className="gap-2"><LayoutGrid className="h-4 w-4" /> Todos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')} className="gap-2"><Clock className="h-4 w-4" /> Por Auditar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('audited')} className="gap-2"><CheckCircle2 className="h-4 w-4" /> Auditados</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('review')} className="gap-2"><AlertTriangle className="h-4 w-4" /> Revisión IA</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('manual')} className="gap-2"><Signature className="h-4 w-4" /> Corrección Manual</DropdownMenuItem>
                <Separator />
                <DropdownMenuItem 
                  className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 gap-2"
                  onClick={() => { setDeleteMode('all'); setDeleteConfirmText(''); setShowDeleteConfirm(true); }}
                >
                  <Trash2 className="h-4 w-4" /> Borrar por Filtro
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Registros</p>
                  <h4 className="text-2xl font-headline font-bold text-slate-800">{stats.total}</h4>
                </div>
                <Database className="h-8 w-8 text-primary/10" />
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Auditados</p>
                  <h4 className="text-2xl font-headline font-bold text-emerald-600">{stats.audited}</h4>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-100" />
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendientes</p>
                  <h4 className="text-2xl font-headline font-bold text-amber-600">{stats.pending}</h4>
                </div>
                <Clock className="h-8 w-8 text-amber-100" />
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-slate-900 text-white overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance Global</p>
                   <span className="text-xs font-bold text-accent">{Math.round(stats.progress)}%</span>
                </div>
                <Progress value={stats.progress} className="h-1.5 bg-white/10" />
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="w-[40px]"><Checkbox checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0} onCheckedChange={handleToggleSelectAll} /></TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Estatus / Origen</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider">PID / Proyecto</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider">Clasificación IA</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Auditoría</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-right">Monto Neto</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-wider text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-24"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-24 text-slate-400 font-medium italic">No se encontraron registros para este filtro.</TableCell></TableRow>
                  ) : filteredOrders.map((order) => {
                    const isAudited = order.classification_status === 'reviewed' || order.classification_status === 'overridden';
                    return (
                      <TableRow key={order.id} className={`hover:bg-primary/5 transition-colors group ${order.needs_review ? 'bg-rose-50/30' : ''} ${isAudited ? 'opacity-80' : ''}`}>
                        <TableCell><Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={(checked) => handleToggleSelect(order.id, !!checked)} /></TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            {order.isSigned ? (
                              <Badge className="bg-emerald-500 text-[8px] uppercase font-black h-4 px-1.5 w-fit"><Signature className="h-2 w-2 mr-1" /> Firmado</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[8px] uppercase font-black h-4 px-1.5 w-fit"><ShieldAlert className="h-2 w-2 mr-1" /> Sin Firma</Badge>
                            )}
                            <Badge variant="outline" className="text-[8px] uppercase h-4 px-1.5 bg-slate-100 text-slate-500 border-none w-fit">
                              {order.dataSource === 'PDF_ORIGINAL' ? <FileText className="h-2 w-2 mr-1" /> : <Database className="h-2 w-2 mr-1" />}
                              {order.dataSource?.replace('_ORIGINAL', '') || 'EXCEL'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-primary text-sm">{order.projectId}</span>
                            <span className="text-[9px] text-muted-foreground uppercase truncate max-w-[150px] font-medium">{order.projectName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                             <span className="font-bold text-slate-700 text-xs">{order.disciplina_normalizada || "—"}</span>
                             <span className="text-[9px] text-slate-400 uppercase font-bold">{order.causa_raiz_normalizada || "Sin Clasificar"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {isAudited ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[8px] uppercase font-black py-1 px-2">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Validado
                            </Badge>
                          ) : order.needs_review ? (
                            <Badge variant="destructive" className="text-[8px] uppercase font-black py-1 px-2 animate-pulse">
                              <AlertTriangle className="h-2.5 w-2.5 mr-1" /> Revisión IA
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] uppercase font-black py-1 px-2 bg-slate-50 text-slate-400 border-dashed">Pendiente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-black text-slate-800 text-sm">${formatAmount(order.impactoNeto || 0)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-primary hover:bg-primary/10 rounded-lg h-8 w-8 p-0"
                              onClick={() => handleReanalyzeWithAi(order)}
                              disabled={isAnalyzing === order.id}
                            >
                              {isAnalyzing === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            </Button>
                            <Dialog onOpenChange={(open) => { if (!open) { setIsEditing(false); setReportResult(null); } }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 rounded-lg h-8 w-8 p-0"><FileSearch className="h-4 w-4" /></Button>
                              </DialogTrigger>
                              <DialogContent className="w-[95vw] md:max-w-6xl max-h-[95vh] overflow-hidden flex flex-col p-0 shadow-2xl rounded-3xl border-none">
                                <header className="bg-slate-900 text-white p-5 shrink-0 flex items-center justify-between">
                                  <div className="space-y-0.5">
                                    <Badge className="bg-white/10 text-white border-white/20 uppercase text-[8px] font-black">Auditoría Walmart Forensic</Badge>
                                    <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight">Trazabilidad: {order.projectId}</DialogTitle>
                                    <DialogDescription className="text-slate-400 text-[10px]">{order.projectName}</DialogDescription>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button 
                                      onClick={() => handleReanalyzeWithAi(order)} 
                                      disabled={isAnalyzing === order.id} 
                                      variant="outline"
                                      className="bg-transparent border-white/20 hover:bg-white/10 h-8 text-[9px] font-black uppercase px-4 rounded-xl"
                                    >
                                      <Sparkles className="h-3 w-3 mr-2 text-accent" /> Re-analizar
                                    </Button>
                                    {!reportResult && (
                                      <Button 
                                        onClick={() => handleGenerateReport(order)} 
                                        disabled={isGeneratingReport} 
                                        className="bg-primary hover:bg-primary/90 h-8 text-[9px] font-black uppercase px-4 rounded-xl shadow-lg border-none"
                                      >
                                        {isGeneratingReport ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <BrainCircuit className="h-3 w-3 mr-2" />} 
                                        Generar Informe Forense
                                      </Button>
                                    )}
                                  </div>
                                </header>

                                <ScrollArea className="flex-1 bg-slate-50">
                                  {reportResult ? (
                                    <div className="p-8 space-y-8 max-w-5xl mx-auto animate-in fade-in duration-500 pb-24">
                                      <div className="grid md:grid-cols-3 gap-6">
                                        <Card className="p-5 border-none shadow-sm bg-white rounded-2xl">
                                          <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Resumen Ejecutivo</p>
                                          <p className="text-xs font-medium text-slate-700 leading-relaxed">{reportResult.executiveSummary.overview}</p>
                                          <div className="mt-4 flex items-center justify-between">
                                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-none text-[10px]">Riesgo: {reportResult.executiveSummary.currentRisk}</Badge>
                                            <span className="text-[10px] font-black text-slate-800">{reportResult.executiveSummary.economicImpact}</span>
                                          </div>
                                        </Card>
                                        <Card className="md:col-span-2 p-5 border-none shadow-sm bg-slate-900 text-white relative overflow-hidden rounded-2xl">
                                          <History className="absolute -bottom-2 -right-2 h-20 w-20 opacity-5" />
                                          <h4 className="text-[9px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2"><Clock className="h-4 w-4 text-accent" /> Línea de Tiempo Forense</h4>
                                          <div className="space-y-4">
                                            {reportResult.forensicTimeline.map((event, idx) => (
                                              <div key={idx} className="flex gap-4 relative">
                                                {idx < reportResult.forensicTimeline.length - 1 && <div className="absolute left-1.5 top-4 w-0.5 h-full bg-white/10" />}
                                                <div className="h-3 w-3 rounded-full bg-accent mt-1 shrink-0 shadow-[0_0_10px_rgba(255,143,0,0.5)]" />
                                                <div className="flex-1 text-[10px]">
                                                  <div className="flex justify-between font-bold">
                                                    <span>{event.event}</span>
                                                    <span className="text-accent">{event.date}</span>
                                                  </div>
                                                  <p className="opacity-60 text-[9px] mt-0.5">{event.evidence}</p>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </Card>
                                      </div>
                                      <div className="grid md:grid-cols-2 gap-6 pb-12">
                                        <section className="space-y-4">
                                          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Recomendaciones IA</h4>
                                          <div className="space-y-3">
                                            {reportResult.recommendations.map((rec, i) => (
                                              <Card key={i} className="p-4 border-none bg-white shadow-sm rounded-xl">
                                                <div className="flex justify-between mb-2">
                                                  <Badge variant="outline" className="text-[8px] font-black uppercase">{rec.type}</Badge>
                                                  <Badge className={`text-[8px] font-black uppercase ${rec.priority === 'Alta' ? 'bg-rose-500' : 'bg-amber-500'}`}>{rec.priority}</Badge>
                                                </div>
                                                <p className="text-xs font-bold text-slate-800 mb-1">{rec.action}</p>
                                                <p className="text-[10px] text-slate-500">Responsable: <span className="font-bold text-primary">{rec.owner}</span></p>
                                              </Card>
                                            ))}
                                          </div>
                                        </section>
                                        <section className="space-y-4">
                                          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Análisis de Riesgo</h4>
                                          <Card className="p-5 border-none bg-white shadow-sm rounded-2xl space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                              {Object.entries(reportResult.riskIndex).map(([key, val]) => (
                                                <div key={key} className="space-y-1">
                                                  <p className="text-[8px] font-black text-slate-400 uppercase">{key}</p>
                                                  <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                      <div className={`h-full ${val > 70 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${val}%` }} />
                                                    </div>
                                                    <span className="text-[10px] font-bold">{val}%</span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                            <Separator className="bg-slate-50" />
                                            <div className="space-y-2">
                                              <p className="text-[9px] font-black text-slate-400 uppercase">Patrones Recurrentes</p>
                                              <p className="text-xs text-slate-700 italic leading-relaxed">{reportResult.deepAnalysis.recurrentPatterns}</p>
                                            </div>
                                          </Card>
                                        </section>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-6 space-y-6 max-w-4xl mx-auto pb-32">
                                      <div className="grid md:grid-cols-3 gap-4">
                                        <Card className={`p-4 border-none shadow-sm ${order.isSigned ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'} rounded-2xl`}>
                                          <p className="text-[8px] font-black uppercase mb-1">Estatus Documental</p>
                                          <div className="flex items-center gap-2">
                                            <Signature className="h-4 w-4" />
                                            <span className="text-xs font-bold">{order.isSigned ? 'FIRMADO' : 'SIN FIRMA'}</span>
                                          </div>
                                        </Card>
                                        <Card className="p-4 border-none shadow-sm bg-white rounded-2xl">
                                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Completitud</p>
                                          <div className="flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-primary" />
                                            <span className="text-xs font-bold text-slate-800">{order.ingestionCompleteness || 0}%</span>
                                          </div>
                                        </Card>
                                        <Card className="p-4 border-none shadow-sm bg-white rounded-2xl">
                                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Impacto Financiero</p>
                                          <div className="flex items-center gap-2">
                                            <Target className="h-4 w-4 text-primary" />
                                            <span className="text-xs font-bold text-slate-800">${formatAmount(order.impactoNeto)}</span>
                                          </div>
                                        </Card>
                                      </div>

                                      <section className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
                                        <h4 className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><Clock className="h-4 w-4" /> Línea de Vida Forense</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                                          {['Detección', 'Solicitud', 'Aprobación', 'Ejecución', 'Cierre'].map((label, i) => (
                                            <div key={label} className={`space-y-0.5 ${i > 0 ? 'border-l' : ''}`}>
                                              <p className="text-[8px] font-black text-slate-400 uppercase">{label}</p>
                                              <p className="text-[10px] font-bold text-slate-700">
                                                {order[`fecha${label}`] || order[label.toLowerCase() + 'Date'] || '—'}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </section>

                                      <section className="space-y-3">
                                        <h4 className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><FileText className="h-4 w-4" /> Evidencia OCR</h4>
                                        <div className="space-y-2">
                                          {order.pdfEvidenceFragments?.map((frag: any, i: number) => (
                                            <Card key={i} className="p-3 border-none bg-primary/5 rounded-xl">
                                              <div className="flex justify-between items-center mb-1">
                                                <Badge variant="outline" className="text-[7px] uppercase font-bold">Sección: {frag.section}</Badge>
                                                <span className="text-[7px] font-black text-slate-400">Pág. {frag.page}</span>
                                              </div>
                                              <p className="text-[10px] text-slate-700 italic">"{frag.text}"</p>
                                            </Card>
                                          ))}
                                        </div>
                                      </section>

                                      <div className="grid md:grid-cols-2 gap-4">
                                        <Card className="p-5 border-none bg-slate-900 text-white rounded-2xl relative shadow-xl overflow-hidden">
                                          <SearchCode className="absolute top-2 right-2 h-12 w-12 opacity-10" />
                                          <h4 className="text-[8px] font-black uppercase text-slate-400 mb-3 flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-accent" /> Razonamiento IA</h4>
                                          <p className="text-[10px] font-medium leading-relaxed mb-4">{order.rationale_tecnico || "Análisis estructural basado en descriptores técnicos."}</p>
                                          <div className="flex flex-wrap gap-1">
                                            {order.evidence_terms?.map((term: string) => <Badge key={term} className="bg-white/10 text-white border-none text-[8px] font-bold">{term}</Badge>)}
                                          </div>
                                        </Card>
                                        <Card className="p-5 border-none bg-white rounded-2xl border border-slate-100 shadow-sm">
                                          <h4 className="text-[8px] font-black uppercase text-primary mb-3 flex items-center gap-1.5"><Microscope className="h-3 w-3" /> Log de Auditoría</h4>
                                          <div className="space-y-2 text-[9px]">
                                            <div className="flex justify-between border-b pb-1">
                                              <span className="text-slate-400 uppercase font-bold">Confianza</span>
                                              <span className="font-bold">{Math.round((order.confidence_score || 0) * 100)}%</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-1">
                                              <span className="text-slate-400 uppercase font-bold">ID Ingesta</span>
                                              <span className="font-bold">#{order.id.slice(-6).toUpperCase()}</span>
                                            </div>
                                            <div className="flex justify-between border-b pb-1">
                                              <span className="text-slate-400 uppercase font-bold">Status Audit</span>
                                              <span className="font-bold uppercase text-emerald-600">{order.classification_status || 'AUTO'}</span>
                                            </div>
                                          </div>
                                        </Card>
                                      </div>

                                      <div className="fixed bottom-6 left-0 right-0 px-6 z-30 pointer-events-none">
                                        <div className="max-w-4xl mx-auto flex justify-end gap-3 pointer-events-auto bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-white">
                                          <Button variant="outline" onClick={() => handleStartEditing(order)} className="rounded-xl px-6 h-9 text-[9px] font-black uppercase border-2 tracking-widest">Corregir</Button>
                                          <Button onClick={() => handleValidateAudit(order)} className="rounded-xl px-8 h-9 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">Validar Auditoría</Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </ScrollArea>

                                {isEditing && (
                                  <div className="absolute inset-0 bg-white z-40 p-8 animate-in slide-in-from-bottom-5">
                                    <div className="max-w-xl mx-auto space-y-6">
                                      <h3 className="text-xl font-headline font-bold text-slate-900 flex items-center gap-3"><ShieldAlert className="h-6 w-6 text-rose-500" /> Override de Clasificación</h3>
                                      <div className="space-y-4">
                                        <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400">Disciplina</Label><Select value={editValues.disciplina} onValueChange={(v) => setEditValues({...editValues, disciplina: v})}><SelectTrigger className="h-10 rounded-xl font-bold text-xs"><SelectValue placeholder="Disciplina" /></SelectTrigger><SelectContent>{DISCIPLINAS_CATALOGO.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
                                        <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-slate-400">Causa Raíz</Label><Select value={editValues.causa} onValueChange={(v) => setEditValues({...editValues, causa: v})}><SelectTrigger className="h-10 rounded-xl font-bold text-xs"><SelectValue placeholder="Causa" /></SelectTrigger><SelectContent>{CAUSAS_CATALOGO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                                      </div>
                                      <div className="flex justify-end gap-3 pt-6 border-t mt-8"><Button variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl px-8 uppercase text-[9px] font-black">Cancelar</Button><Button onClick={() => handleSaveManualOverride(order.id)} className="rounded-xl px-10 uppercase text-[9px] font-black bg-primary">Guardar Override</Button></div>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                            <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 rounded-lg h-8 w-8 p-0" onClick={() => { setSelectedIds([order.id]); setDeleteMode('single'); setShowDeleteConfirm(true); }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>

        {/* Confirmation Dialogs */}
        <Dialog open={showAuditConfirm} onOpenChange={setShowAuditConfirm}>
          <DialogContent className="sm:max-w-md rounded-2xl border-none">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-600 uppercase font-headline font-bold">
                <ListChecks className="h-5 w-5" /> Auditoría Masiva
              </DialogTitle>
              <DialogDescription className="pt-2">
                Está por auditar **{selectedIds.length}** registros seleccionados. El impacto total involucrado es de **${formatAmount(selectedImpact)}**.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4">
              <p className="text-[10px] font-black uppercase text-emerald-700 mb-1">Impacto de la Acción</p>
              <p className="text-xs text-emerald-800 italic">Esta acción marcará los registros como validados y eliminará cualquier alerta de revisión pendiente de la IA.</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setShowAuditConfirm(false)} className="rounded-xl uppercase text-[10px] font-black">Cancelar</Button>
              <Button 
                onClick={handleBulkAudit}
                disabled={isAuditing}
                className="bg-emerald-600 hover:bg-emerald-700 rounded-xl uppercase text-[10px] font-black px-8"
              >
                {isAuditing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar Auditoría
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="sm:max-w-md rounded-2xl border-none">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-600 uppercase font-headline font-bold">
                <ShieldAlert className="h-5 w-5" /> Confirmación de Borrado
              </DialogTitle>
              <DialogDescription className="pt-2">
                Está por eliminar **{deleteMode === 'all' ? filteredOrders.length : selectedIds.length}** registro(s). Esta acción es irreversible.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                <p className="text-xs text-rose-800">Para confirmar, escriba **BORRAR** en el campo de abajo:</p>
              </div>
              <input 
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="Escriba BORRAR..."
                className="flex h-12 w-full rounded-xl border border-rose-200 bg-background px-3 py-2 text-center text-sm font-black tracking-widest ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl uppercase text-[10px] font-black">Cancelar</Button>
              <Button 
                variant="destructive" 
                onClick={processDelete}
                disabled={deleteConfirmText !== 'BORRAR' || isDeleting}
                className="rounded-xl uppercase text-[10px] font-black px-8"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Confirmar Borrado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </SidebarInset>
    </div>
  );
}
