
"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Fingerprint,
  Filter,
  SearchCode,
  FileSearch,
  BookOpenCheck,
  Save,
  X,
  Trash2,
  ShieldCheck,
  Loader2,
  Microscope,
  FileText,
  Clock,
  ArrowRight,
  Download,
  ShieldQuestion,
  Target,
  FileDown,
  History,
  CalendarDays,
  MapPin,
  ExternalLink,
  Signature,
  Activity,
  Database
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
import { collection, query, limit, doc, increment, setDoc } from 'firebase/firestore';
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
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const DISCIPLINAS_CATALOGO = ["Eléctrica", "Civil", "Estructura Metálica", "HVAC", "Legal/Permisos", "Prototipos", "Contra Incendio", "Indefinida"];
const CAUSAS_CATALOGO = ["Error Diseño", "Cambio Prototipo", "Omisión Contratista", "Requerimiento Autoridad", "Interferencia Constructiva", "Otros"];

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processed' | 'review'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportResult, setReportResult] = useState<TraceabilityReportOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  const reportContainerRef = useRef<HTMLDivElement>(null);
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    return query(collection(db, 'orders'), limit(500));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const formatAmount = (amount: number) => {
    if (!mounted) return "0.00";
    return new Intl.NumberFormat('es-MX', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(amount);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === 'Dato Faltante' || dateStr === '') return '—';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const filteredOrders = useMemo(() => {
    return orders?.filter(o => {
      const searchStr = searchTerm.toLowerCase();
      const pid = String(o.projectId || "").toLowerCase();
      const matchesSearch = pid.includes(searchStr);
      
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'pending' && !o.disciplina_normalizada) ||
        (statusFilter === 'processed' && o.disciplina_normalizada && !o.needs_review) ||
        (statusFilter === 'review' && o.needs_review);

      return matchesSearch && matchesStatus;
    }) || [];
  }, [orders, searchTerm, statusFilter]);

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

  const handleOpenDelete = (mode: DeletionMode) => {
    setDeleteMode(mode);
    setDeleteConfirmText('');
    setShowDeleteConfirm(true);
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

  const processSingleOrder = async (order: any) => {
    setIsAnalyzing(order.id);
    try {
      const result = await analyzeOrderSemantically({
        descripcion: order.descripcion || order.standardizedDescription || "",
        monto: order.impactoNeto || 0,
        contexto: {
          disciplinasVigentes: DISCIPLINAS_CATALOGO,
          causasVigentes: CAUSAS_CATALOGO
        }
      });
      if (db) {
        updateDocumentNonBlocking(doc(db, 'orders', order.id), {
          ...result,
          classification_status: 'auto',
          ai_model_version: 'gemini-2.5-flash-forensic',
          classified_at: new Date().toISOString()
        });
      }
      toast({ title: "Análisis Finalizado", description: `Clasificación: ${result.disciplina_normalizada}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fallo en Clasificación", description: error.message });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleGenerateReport = async (order: any) => {
    setIsGeneratingReport(true);
    setReportResult(null);
    try {
      const report = await generateTraceabilityReport({ orderData: order });
      setReportResult(report);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Informe", description: error.message });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleValidateAudit = (order: any) => {
    if (!db) return;
    updateDocumentNonBlocking(doc(db, 'orders', order.id), {
      classification_status: 'reviewed',
      needs_review: false,
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
    if (!db) return;
    updateDocumentNonBlocking(doc(db, 'orders', orderId), {
      disciplina_normalizada: editValues.disciplina,
      causa_raiz_normalizada: editValues.causa,
      subcausa_normalizada: editValues.subcausa,
      classification_status: 'overridden',
      needs_review: false,
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
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar PID..."
                className="pl-9 w-[220px] h-9 bg-slate-50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9"><Filter className="h-4 w-4" /> FILTRO</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>Todos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('processed')}>Auditados</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('review')}>Revisión Pendiente</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-6">
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-[40px]"><Checkbox onCheckedChange={handleToggleSelectAll} /></TableHead>
                    <TableHead>Estatus Doc</TableHead>
                    <TableHead>PID / Origen</TableHead>
                    <TableHead>Clasificación</TableHead>
                    <TableHead>Integridad</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow key={order.id} className={`hover:bg-primary/5 group ${order.needs_review || !order.isSigned ? 'bg-rose-50/20' : ''}`}>
                      <TableCell><Checkbox checked={selectedIds.includes(order.id)} onCheckedChange={(checked) => handleToggleSelect(order.id, !!checked)} /></TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {order.isSigned ? (
                            <Badge className="bg-emerald-500 text-[8px] uppercase h-4 px-1.5"><Signature className="h-2 w-2 mr-1" /> Firmado</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[8px] uppercase h-4 px-1.5"><ShieldAlert className="h-2 w-2 mr-1" /> Sin Firma</Badge>
                          )}
                          <Badge variant="outline" className="text-[8px] uppercase h-4 px-1.5 bg-slate-100 text-slate-500 border-none">
                            {order.dataSource === 'PDF_ORIGINAL' ? <FileText className="h-2 w-2 mr-1" /> : <Database className="h-2 w-2 mr-1" />}
                            {order.dataSource?.replace('_ORIGINAL', '') || 'MANUAL'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-primary">{order.projectId}</span>
                          <span className="text-[9px] text-muted-foreground uppercase truncate max-w-[120px]">{order.projectName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-700">{order.disciplina_normalizada || "—"}</span>
                           <span className="text-[9px] text-slate-400 uppercase">{order.causa_raiz_normalizada}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center gap-2">
                           <div className="w-12 h-1 bg-slate-100 rounded-full">
                             <div 
                               className={`h-full rounded-full ${order.ingestionCompleteness > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                               style={{ width: `${order.ingestionCompleteness || 0}%` }}
                             />
                           </div>
                           <span className="text-[9px] font-black text-slate-500">{order.ingestionCompleteness || 0}%</span>
                         </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-800">${formatAmount(order.impactoNeto || 0)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Dialog onOpenChange={(open) => { if (!open) { setIsEditing(false); setReportResult(null); } }}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 rounded-lg"><FileSearch className="h-4 w-4" /></Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] md:max-w-6xl max-h-[95vh] overflow-hidden flex flex-col p-0 shadow-2xl rounded-3xl">
                              <header className="bg-slate-900 text-white p-5 shrink-0 flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <Badge className="bg-white/10 text-white border-white/20 uppercase text-[8px] font-black">Auditoría Walmart Forensic</Badge>
                                  <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight">Ficha de Trazabilidad: {order.projectId}</DialogTitle>
                                  <DialogDescription className="text-slate-400 text-[10px]">{order.projectName} | Origen: {order.dataSource}</DialogDescription>
                                </div>
                                <div className="flex gap-2">
                                  {!reportResult && <Button onClick={() => handleGenerateReport(order)} disabled={isGeneratingReport} className="bg-primary hover:bg-primary/90 h-8 text-[9px] font-black uppercase px-4 rounded-xl shadow-lg">{isGeneratingReport ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Generar Informe</Button>}
                                </div>
                              </header>

                              <ScrollArea className="flex-1 bg-slate-50">
                                <div className="p-6 space-y-6 max-w-4xl mx-auto pb-24">
                                  {/* Cabecera de Integridad */}
                                  <div className="grid md:grid-cols-3 gap-4">
                                    <Card className={`p-4 border-none shadow-sm ${order.isSigned ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                      <p className="text-[8px] font-black uppercase mb-1">Estatus Documental</p>
                                      <div className="flex items-center gap-2">
                                        <Signature className="h-4 w-4" />
                                        <span className="text-xs font-bold">{order.isSigned ? 'FIRMADO Y VALIDADO' : 'COPIA NO FIRMADA'}</span>
                                      </div>
                                    </Card>
                                    <Card className="p-4 border-none shadow-sm bg-white">
                                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Completitud de Ingesta</p>
                                      <div className="flex items-center gap-2">
                                        <Activity className="h-4 w-4 text-primary" />
                                        <span className="text-xs font-bold text-slate-800">{order.ingestionCompleteness}% de Campos Críticos</span>
                                      </div>
                                    </Card>
                                    <Card className="p-4 border-none shadow-sm bg-white">
                                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Impacto Financiero</p>
                                      <div className="flex items-center gap-2">
                                        <Target className="h-4 w-4 text-primary" />
                                        <span className="text-xs font-bold text-slate-800">${formatAmount(order.impactoNeto)} MXN</span>
                                      </div>
                                    </Card>
                                  </div>

                                  <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                                    <h4 className="text-[9px] font-black uppercase text-primary tracking-widest mb-4 flex items-center gap-1.5"><Clock className="h-4 w-4" /> Línea de Vida Forense</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                                      {['Detección', 'Solicitud', 'Aprobación', 'Ejecución', 'Cierre'].map((label, i) => (
                                        <div key={label} className={`space-y-0.5 ${i > 0 ? 'border-l' : ''}`}>
                                          <p className="text-[8px] font-black text-slate-400 uppercase">{label}</p>
                                          <p className="text-[10px] font-bold text-slate-700">
                                            {formatDate(order[`fecha${label}`] || order[label.toLowerCase() + 'Date'])}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </section>

                                  <section className="space-y-3">
                                    <h4 className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><FileText className="h-4 w-4" /> Evidencia Documental (OCR Forensic)</h4>
                                    <div className="grid gap-2">
                                      {order.pdfEvidenceFragments?.map((frag: any, i: number) => (
                                        <Card key={i} className="p-3 border-none bg-primary/5 rounded-xl hover:bg-primary/10 transition-all group">
                                          <div className="flex justify-between items-center mb-1">
                                            <Badge variant="outline" className="text-[7px] uppercase font-bold text-primary/60">Sección: {frag.section}</Badge>
                                            <span className="text-[7px] font-black text-slate-400 uppercase">Pág. {frag.page}</span>
                                          </div>
                                          <p className="text-[10px] text-slate-700 italic font-medium leading-relaxed">"{frag.text}"</p>
                                        </Card>
                                      ))}
                                      {(!order.pdfEvidenceFragments || order.pdfEvidenceFragments.length === 0) && (
                                        <div className="text-center py-4 bg-slate-50 border border-dashed rounded-xl">
                                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sin evidencia documental mapeada</p>
                                        </div>
                                      )}
                                    </div>
                                  </section>

                                  <div className="grid md:grid-cols-2 gap-4">
                                    <Card className="p-5 border-none bg-slate-900 text-white rounded-2xl relative shadow-xl overflow-hidden">
                                      <Fingerprint className="absolute top-2 right-2 h-12 w-12 opacity-10" />
                                      <h4 className="text-[8px] font-black uppercase text-slate-400 mb-3 flex items-center gap-1.5"><SearchCode className="h-3 w-3 text-accent" /> Razonamiento Forense Gemini</h4>
                                      <p className="text-[11px] font-medium leading-relaxed mb-4">{order.rationale_tecnico || "Análisis automatizado basado en contexto estructural."}</p>
                                      <div className="flex flex-wrap gap-1">
                                        {order.evidence_terms?.map((term: string) => <Badge key={term} className="bg-white/10 text-white border-none text-[8px] font-bold">{term}</Badge>)}
                                      </div>
                                    </Card>

                                    <Card className="p-5 border-none bg-white rounded-2xl border border-slate-100 shadow-sm">
                                      <h4 className="text-[8px] font-black uppercase text-primary mb-3 flex items-center gap-1.5"><Microscope className="h-3 w-3" /> Log de Procesamiento</h4>
                                      <div className="space-y-3 text-[10px]">
                                        <div className="flex justify-between border-b pb-1">
                                          <span className="text-slate-400 uppercase font-bold">Confianza IA</span>
                                          <span className="font-bold text-slate-800">{Math.round(order.confidence_score * 100)}%</span>
                                        </div>
                                        <div className="flex justify-between border-b pb-1">
                                          <span className="text-slate-400 uppercase font-bold">ID Ingesta</span>
                                          <span className="font-bold text-slate-800">#{order.id.slice(-8).toUpperCase()}</span>
                                        </div>
                                        <div className="flex justify-between border-b pb-1">
                                          <span className="text-slate-400 uppercase font-bold">Fecha de Audit</span>
                                          <span className="font-bold text-slate-800">{formatDate(order.processedAt || order.classified_at)}</span>
                                        </div>
                                      </div>
                                    </Card>
                                  </div>

                                  <div className="flex items-center justify-between pt-6 border-t mt-4">
                                    <div className="flex items-center gap-4">
                                      <div className="text-center">
                                        <p className="text-[7px] font-black text-slate-400 uppercase">Audit Status</p>
                                        <Badge variant={order.needs_review ? "destructive" : "default"} className="text-[9px] uppercase">{order.classification_status || 'AUTO'}</Badge>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button variant="outline" onClick={() => handleStartEditing(order)} className="rounded-xl px-6 h-9 text-[9px] font-black uppercase border-2 tracking-widest">Corregir</Button>
                                      <Button onClick={() => handleValidateAudit(order)} className="rounded-xl px-8 h-9 text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">Validar</Button>
                                    </div>
                                  </div>
                                </div>
                              </ScrollArea>

                              {isEditing && (
                                <div className="absolute inset-0 bg-white z-20 p-8 animate-in slide-in-from-bottom-5">
                                  <div className="max-w-2xl mx-auto space-y-6">
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
                          <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 rounded-lg" onClick={() => { setSelectedIds([order.id]); handleOpenDelete('single'); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
