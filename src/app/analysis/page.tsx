
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
  Signature
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
import { collection, query, limit, doc, writeBatch, setDoc } from 'firebase/firestore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteMode, setDeleteMode] = useState<DeletionMode>('bulk');

  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({ disciplina: '', causa: '' });

  useEffect(() => { setMounted(true); }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), limit(500));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const stats = useMemo(() => {
    if (!orders) return { total: 0, audited: 0, progress: 0 };
    const total = orders.length;
    const audited = orders.filter(o => o.classification_status === 'reviewed').length;
    return { total, audited, progress: total > 0 ? (audited / total) * 100 : 0 };
  }, [orders]);

  const formatAmount = (amount: number) => {
    if (!mounted) return "0.00";
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const filteredOrders = useMemo(() => {
    return orders?.filter(o => {
      const searchStr = searchTerm.toLowerCase();
      const pid = String(o.projectId || "").toLowerCase();
      const matchesSearch = pid.includes(searchStr);
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'audited' && o.classification_status === 'reviewed') ||
        (statusFilter === 'pending' && o.classification_status !== 'reviewed');
      return matchesSearch && matchesStatus;
    }) || [];
  }, [orders, searchTerm, statusFilter]);

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
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar PID..."
                className="pl-9 w-[220px] h-9 bg-slate-50 border-none shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Registros Totales</p>
                <h4 className="text-2xl font-headline font-bold text-slate-800">{stats.total}</h4>
              </div>
              <Database className="h-8 w-8 text-primary/10" />
            </Card>
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Auditados</p>
                <h4 className="text-2xl font-headline font-bold text-emerald-600">{stats.audited}</h4>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-100" />
            </Card>
            <Card className="md:col-span-2 border-none shadow-sm bg-slate-900 text-white p-4 space-y-3">
              <div className="flex justify-between items-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance Global de Auditoría</p>
                 <span className="text-xs font-bold text-accent">{Math.round(stats.progress)}%</span>
              </div>
              <Progress value={stats.progress} className="h-1.5 bg-white/10" />
            </Card>
          </div>

          <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase">Origen / Nivel Trust</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">PID / Proyecto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Clasificación IA</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Trazabilidad</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Monto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-24"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                ) : filteredOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-slate-50/50 group transition-colors">
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <Badge variant="outline" className={`text-[8px] font-black border-none h-4 px-1.5 w-fit ${order.reliability_level === 'HIGH' ? 'bg-emerald-100 text-emerald-700' : order.reliability_level === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                          {order.reliability_level || 'LOW'} TRUST
                        </Badge>
                        <Badge variant="outline" className="text-[8px] uppercase h-4 px-1.5 bg-slate-100 text-slate-500 border-none w-fit font-bold">
                          {order.dataSource === 'PDF_ENRICHED' ? <Lock className="h-2 w-2 mr-1 text-primary" /> : <Database className="h-2 w-2 mr-1" />}
                          {order.dataSource?.replace('_HISTORIC', '') || 'EXCEL'}
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
                         <span className="text-[9px] text-slate-400 uppercase font-bold">{order.causa_raiz_normalizada}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {order.pdf_traceability_reconstructed ? (
                        <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-none text-[8px] font-black py-1 px-2">RECONSTRUIDA</Badge>
                      ) : order.isSigned ? (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none text-[8px] font-black py-1 px-2">DOCUSIGN OK</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[8px] font-black py-1 px-2 border-dashed opacity-40 text-slate-400">SIN EVIDENCIA</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-800 text-sm">${formatAmount(order.impactoNeto || 0)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                              <div className="grid md:grid-cols-3 gap-6">
                                <Card className="p-4 bg-white border-none shadow-sm rounded-2xl space-y-4">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Nivel de Integridad</h4>
                                  <div className="flex items-end justify-between">
                                    <span className="text-4xl font-headline font-bold">{order.structural_quality_score || 0}%</span>
                                    <Badge variant="outline" className="text-[8px] font-black">{order.reliability_level}</Badge>
                                  </div>
                                  <Progress value={order.structural_quality_score || 0} className="h-1.5" />
                                  <p className="text-[10px] text-slate-500 italic">Score calculado por el motor estructural basado en 12 variables institucionales.</p>
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
                              </div>
                              <div className="mt-6">
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
                            </ScrollArea>
                            <footer className="p-4 bg-white border-t flex justify-end gap-3">
                              <Button variant="outline" className="rounded-xl uppercase text-[9px] font-black px-6 h-9">Generar Reporte 360</Button>
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
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
