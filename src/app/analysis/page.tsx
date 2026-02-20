
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
  Loader2
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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

const DISCIPLINAS_CATALOGO = ["Eléctrica", "Civil", "Estructura Metálica", "HVAC", "Legal/Permisos", "Prototipos", "Contra Incendio", "Indefinida"];
const CAUSAS_CATALOGO = ["Error Diseño", "Cambio Prototipo", "Omisión Contratista", "Requerimiento Autoridad", "Interferencia Constructiva", "Otros"];

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processed' | 'review'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Selección y Borrado
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteMode, setDeleteMode] = useState<DeletionMode>('bulk');

  // Estados para corrección manual
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

  const totalSelectedImpact = useMemo(() => {
    if (deleteMode === 'all') {
      return filteredOrders.reduce((acc, curr) => acc + (curr.impactoNeto || 0), 0);
    }
    return filteredOrders
      .filter(o => selectedIds.includes(o.id))
      .reduce((acc, curr) => acc + (curr.impactoNeto || 0), 0);
  }, [filteredOrders, selectedIds, deleteMode]);

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
      
      toast({ title: "Borrado Exitoso", description: `Se han eliminado los registros seleccionados.` });
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
        const updateData = {
          ...result,
          classification_status: 'auto',
          ai_model_version: 'gemini-2.5-flash-forensic',
          classified_at: new Date().toISOString()
        };

        updateDocumentNonBlocking(doc(db, 'orders', order.id), updateData);

        // Actualización de Agregados
        const safeDisciplineId = result.disciplina_normalizada.replace(/\//g, '-');
        const aggregateRef = doc(db, 'aggregates', 'global', 'disciplines_stats', safeDisciplineId);
        
        setDocumentNonBlocking(aggregateRef, {
          count: increment(1),
          total_impact: increment(order.impactoNeto || 0),
          last_updated: new Date().toISOString()
        }, { merge: true });
      }

      toast({
        title: "Análisis Forense Finalizado",
        description: `Clasificación: ${result.disciplina_normalizada} con trazabilidad explicable.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fallo en Clasificación",
        description: error.message || "No se pudo completar el análisis semántico.",
      });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleValidateAudit = (order: any) => {
    if (!db) return;
    updateDocumentNonBlocking(doc(db, 'orders', order.id), {
      classification_status: 'reviewed',
      needs_review: false,
      classified_at: new Date().toISOString()
    });
    toast({
      title: "Auditoría Validada",
      description: `La clasificación para ${order.projectId} ha sido confirmada correctamente.`,
    });
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
    toast({
      title: "Corrección Guardada",
      description: "Se ha aplicado el override manual exitosamente.",
    });
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
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Clasificación & Trazabilidad Forense</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-5">
                <Badge variant="secondary" className="bg-rose-50 text-rose-600 border-rose-100">
                  {selectedIds.length} seleccionados
                </Badge>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-8 gap-2 bg-rose-600"
                  onClick={() => handleOpenDelete('bulk')}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Borrar Lote
                </Button>
              </div>
            )}

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
                <Button variant="outline" size="sm" className="gap-2 h-9">
                  <Filter className="h-4 w-4" />
                  {statusFilter.toUpperCase()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>Todos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('processed')}>Automatizados</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('review')}>Requiere Revisión</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>Pendientes</DropdownMenuItem>
                <Separator />
                <DropdownMenuItem 
                  className="text-rose-600 font-bold gap-2"
                  onClick={() => handleOpenDelete('all')}
                >
                  <Trash2 className="h-4 w-4" /> Borrar todo (Filtro)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-6">
          {isDeleting && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-4">
              <Card className="border-rose-200 bg-rose-50/50 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <Loader2 className="h-5 w-5 animate-spin text-rose-600" />
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-black text-rose-900 uppercase">Eliminando registros en la nube...</p>
                    <Progress value={50} className="h-1.5 bg-rose-100" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox 
                        checked={selectedIds.length === filteredOrders.length && filteredOrders.length > 0}
                        onCheckedChange={handleToggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Estado IA</TableHead>
                    <TableHead>PID / Proyecto</TableHead>
                    <TableHead>Clasificación Forense</TableHead>
                    <TableHead>Confianza</TableHead>
                    <TableHead className="text-right">Monto Neto</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow key={order.id} className={`hover:bg-primary/5 group ${order.needs_review ? 'bg-rose-50/20' : ''} ${selectedIds.includes(order.id) ? 'bg-primary/5' : ''}`}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.includes(order.id)}
                          onCheckedChange={(checked) => handleToggleSelect(order.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        {order.disciplina_normalizada ? (
                          order.needs_review ? (
                            <Badge variant="outline" className="text-rose-500 border-rose-200 bg-rose-50 gap-1 uppercase text-[9px]">
                              <AlertTriangle className="h-3 w-3" /> Revisión
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500 gap-1 uppercase text-[9px]">
                              <CheckCircle2 className="h-3 w-3" /> Auto
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-slate-300 uppercase text-[9px]">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-primary">{order.projectId || "S/P"}</span>
                          <span className="text-[10px] text-muted-foreground uppercase truncate max-w-[150px]">{order.projectName || "Sin Nombre"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-700">{order.disciplina_normalizada || "—"}</span>
                           <span className="text-[9px] text-slate-400 uppercase font-medium">{order.causa_raiz_normalizada || ""}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         {order.confidence_score ? (
                           <div className="flex items-center gap-2">
                             <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                               <div 
                                 className={`h-full ${order.confidence_score > 0.8 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                 style={{ width: `${order.confidence_score * 100}%` }}
                               />
                             </div>
                             <span className="text-[10px] font-black text-slate-500">{Math.round(order.confidence_score * 100)}%</span>
                           </div>
                         ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-800">
                        ${formatAmount(order.impactoNeto || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {order.disciplina_normalizada ? (
                            <Dialog onOpenChange={(open) => !open && setIsEditing(false)}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-primary gap-1 group-hover:bg-primary group-hover:text-white transition-all rounded-lg">
                                  <FileSearch className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-8">
                                <DialogHeader className="mb-6">
                                  <div className="flex items-center justify-between mb-2">
                                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 uppercase text-[10px] font-black tracking-widest">
                                      Informe de Trazabilidad Semántica
                                    </Badge>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">ID: {order.id}</span>
                                  </div>
                                  <DialogTitle className="text-3xl font-headline font-bold text-slate-900 leading-tight">
                                    {order.disciplina_normalizada} <span className="text-slate-300 mx-2">/</span> {order.causa_raiz_normalizada}
                                  </DialogTitle>
                                  <DialogDescription className="text-lg text-slate-500 font-medium">
                                    Proyecto: {order.projectName} ({order.projectId})
                                  </DialogDescription>
                                </DialogHeader>

                                {!isEditing ? (
                                  <div className="space-y-8">
                                    <section>
                                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-3 flex items-center gap-2">
                                        <BookOpenCheck className="h-4 w-4 text-primary" /> Descripción Original
                                      </h4>
                                      <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 italic text-slate-700 text-sm leading-relaxed">
                                        "{order.descripcion_original || order.descripcion}"
                                      </div>
                                    </section>

                                    <div className="grid md:grid-cols-2 gap-6">
                                      <Card className="p-6 border-none bg-slate-900 text-white rounded-2xl shadow-xl overflow-hidden relative">
                                        <div className="absolute top-0 right-0 p-4 opacity-10">
                                          <Fingerprint className="h-20 w-20" />
                                        </div>
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                                          <SearchCode className="h-4 w-4 text-accent" /> Razonamiento Forense
                                        </h4>
                                        <p className="text-sm font-medium leading-relaxed mb-6">
                                          {order.rationale_tecnico || "Análisis automatizado basado en taxonomía MEP."}
                                        </p>
                                        <div className="space-y-4">
                                          <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Evidencia Térmica</p>
                                            <div className="flex flex-wrap gap-2">
                                              {order.evidence_terms?.map((term: string, i: number) => (
                                                <Badge key={i} variant="secondary" className="bg-white/10 text-white border-none text-[9px] font-bold">
                                                  {term}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      </Card>

                                      <Card className="p-6 border-none bg-white rounded-2xl shadow-sm border border-slate-100">
                                        <h4 className="text-[10px] font-black uppercase text-primary mb-4 flex items-center gap-2 tracking-widest">
                                          <Microscope className="h-4 w-4" /> Lógica de Clasificación
                                        </h4>
                                        <div className="space-y-5">
                                          <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Criterio Aplicado</p>
                                            <p className="text-xs font-bold text-slate-800">{order.logica_clasificacion?.criterio_aplicado || "Inferencia Semántica"}</p>
                                          </div>
                                          <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase">Taxonomía Nivel 3</p>
                                            <p className="text-xs font-bold text-slate-800">{order.detalle_nivel_3 || "No determinado"}</p>
                                          </div>
                                          <Separator className="bg-slate-50" />
                                          <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
                                              <AlertTriangle className="h-3 w-3 text-rose-500" /> Ambigüedades Detectadas
                                            </p>
                                            <p className="text-xs text-slate-500 italic">
                                              {order.logica_clasificacion?.posibles_ambiguedades || "Ninguna detectada. Clasificación robusta."}
                                            </p>
                                          </div>
                                        </div>
                                      </Card>
                                    </div>

                                    <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                                      <div className="flex items-center gap-4">
                                        <div className="text-center">
                                          <p className="text-[9px] font-black text-slate-400 uppercase">Confianza</p>
                                          <span className={`text-xl font-headline font-bold ${order.confidence_score > 0.8 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {Math.round(order.confidence_score * 100)}%
                                          </span>
                                        </div>
                                        <Separator orientation="vertical" className="h-10" />
                                        <div className="text-center">
                                          <p className="text-[9px] font-black text-slate-400 uppercase">Modelo IA</p>
                                          <span className="text-xs font-bold text-slate-600">Gemini 2.5 Forensic</span>
                                        </div>
                                      </div>
                                      <div className="flex gap-3">
                                        <Button variant="outline" onClick={() => handleStartEditing(order)} className="rounded-xl px-6 h-10 text-[10px] font-black uppercase tracking-widest">
                                          Corregir Manualmente
                                        </Button>
                                        <Button onClick={() => handleValidateAudit(order)} className="rounded-xl px-6 h-10 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                                          Validar Auditoría
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-8 animate-in fade-in duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                      <div className="space-y-4">
                                        <div className="space-y-2">
                                          <Label className="text-[10px] font-black uppercase text-slate-400">Disciplina Técnica</Label>
                                          <Select value={editValues.disciplina} onValueChange={(v) => setEditValues({...editValues, disciplina: v})}>
                                            <SelectTrigger className="rounded-xl">
                                              <SelectValue placeholder="Seleccionar Disciplina" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {DISCIPLINAS_CATALOGO.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-[10px] font-black uppercase text-slate-400">Causa Raíz</Label>
                                          <Select value={editValues.causa} onValueChange={(v) => setEditValues({...editValues, causa: v})}>
                                            <SelectTrigger className="rounded-xl">
                                              <SelectValue placeholder="Seleccionar Causa" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {CAUSAS_CATALOGO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-2">
                                          <Label className="text-[10px] font-black uppercase text-slate-400">Subcausa / Detalle</Label>
                                          <Input 
                                            value={editValues.subcausa} 
                                            onChange={(e) => setEditValues({...editValues, subcausa: e.target.value})}
                                            className="rounded-xl"
                                            placeholder="Especifique el detalle técnico..."
                                          />
                                        </div>
                                      </div>
                                      <div className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
                                          <X className="h-4 w-4" /> Notas de Edición
                                        </h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                          Al aplicar una corrección manual, el registro se marcará como <strong>"Sobreescrito" (Overridden)</strong>. 
                                          Esto permite a la IA aprender de tus decisiones para futuras clasificaciones.
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                                      <Button variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl px-6 h-10 text-[10px] font-black uppercase tracking-widest gap-2">
                                        <X className="h-4 w-4" /> Cancelar
                                      </Button>
                                      <Button onClick={() => handleSaveManualOverride(order.id)} className="rounded-xl px-8 h-10 text-[10px] font-black uppercase tracking-widest gap-2 shadow-lg shadow-primary/20 bg-primary">
                                        <Save className="h-4 w-4" /> Guardar Corrección
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => processSingleOrder(order)} 
                              disabled={isAnalyzing === order.id}
                              className="text-primary hover:bg-primary/10 rounded-lg"
                            >
                              {isAnalyzing === order.id ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-400 hover:text-rose-600 rounded-lg"
                            onClick={() => { setSelectedIds([order.id]); handleOpenDelete('single'); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>

        {/* Modal de Confirmación de Borrado */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="max-w-md rounded-3xl p-8">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline font-bold text-slate-900 flex items-center gap-3">
                <ShieldAlert className="h-8 w-8 text-rose-600" /> Confirmación Forense
              </DialogTitle>
              <DialogDescription className="pt-4 text-slate-600">
                Está a punto de realizar una eliminación definitiva de <strong>{deleteMode === 'all' ? filteredOrders.length : selectedIds.length}</strong> registros. 
                Esta acción es irreversible y quedará registrada en los audit logs del sistema.
              </DialogDescription>
            </DialogHeader>

            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 space-y-3 my-4">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-rose-900 uppercase">Impacto Financiero Eliminado:</span>
                <span className="font-black text-rose-700">${formatAmount(totalSelectedImpact)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-rose-900 uppercase">Acción:</span>
                <Badge variant="outline" className="text-rose-600 border-rose-200 uppercase text-[9px]">
                  {deleteMode === 'all' ? 'Limpieza por Filtro' : 'Borrado por Lote'}
                </Badge>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                Escriba "BORRAR" para confirmar
              </Label>
              <Input 
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="Escriba aquí..."
                className="h-12 rounded-xl text-center font-black tracking-[0.3em] uppercase"
              />
            </div>

            <DialogFooter className="gap-2 pt-6">
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl px-6 h-11 text-[10px] font-black uppercase tracking-widest">
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={processDelete} 
                disabled={deleteConfirmText !== 'BORRAR' || isDeleting}
                className="rounded-xl px-8 h-11 text-[10px] font-black uppercase tracking-widest bg-rose-600 shadow-lg shadow-rose-200"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Confirmar Borrado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </div>
  );
}
