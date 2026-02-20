
"use client"

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  RefreshCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Fingerprint,
  Info,
  Filter,
  SearchCode,
  Eye,
  Microscope,
  FileSearch,
  BookOpenCheck
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
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit, doc, increment, setDoc } from 'firebase/firestore';
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from '@/components/ui/separator';

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processed' | 'review'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

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

  const processSingleOrder = async (order: any) => {
    setIsAnalyzing(order.id);
    try {
      const result = await analyzeOrderSemantically({
        descripcion: order.descripcion || order.standardizedDescription || "",
        monto: order.impactoNeto || 0,
        contexto: {
          disciplinasVigentes: ["Eléctrica", "Civil", "Estructura Metálica", "HVAC", "Legal/Permisos", "Prototipos", "Contra Incendio"],
          causasVigentes: ["Error Diseño", "Cambio Prototipo", "Omisión Contratista", "Requerimiento Autoridad", "Interferencia Constructiva"]
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

  const filteredOrders = orders?.filter(o => {
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
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Estado: {statusFilter.toUpperCase()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>Todos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('processed')}>Automatizados</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('review')}>Requiere Revisión</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>Pendientes</DropdownMenuItem>
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
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow key={order.id} className={`hover:bg-primary/5 group ${order.needs_review ? 'bg-rose-50/20' : ''}`}>
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
                        {order.disciplina_normalizada ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-primary gap-1 group-hover:bg-primary group-hover:text-white transition-all">
                                <FileSearch className="h-4 w-4" /> Ver Ficha
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
                                      {order.rationale_tecnico || order.rationale_short}
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
                                    <Button variant="outline" className="rounded-xl px-6 h-10 text-[10px] font-black uppercase tracking-widest">
                                      Corregir Manualmente
                                    </Button>
                                    <Button className="rounded-xl px-6 h-10 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                                      Validar Auditoría
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => processSingleOrder(order)} 
                            disabled={isAnalyzing === order.id}
                            className="bg-primary/5 text-primary border-primary/20 hover:bg-primary hover:text-white rounded-xl h-9 px-4 gap-2 transition-all font-bold"
                          >
                            {isAnalyzing === order.id ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            {isAnalyzing === order.id ? "Analizando..." : "Iniciar Auditoría"}
                          </Button>
                        )}
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
