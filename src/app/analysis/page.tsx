
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
  Filter
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
          disciplinasVigentes: ["Eléctrica", "Civil", "Estructura Metálica", "HVAC", "Legal/Permisos", "Prototipos"],
          causasVigentes: ["Error Diseño", "Cambio Prototipo", "Omisión Contratista", "Requerimiento Autoridad"]
        }
      });

      if (db) {
        const updateData = {
          disciplina_normalizada: result.disciplina_normalizada,
          causa_raiz_normalizada: result.causa_raiz_normalizada,
          subcausa_normalizada: result.subcausa_normalizada,
          confidence_score: result.confidence_score,
          evidence_terms: result.evidence_terms,
          rationale_short: result.rationale_short,
          needs_review: result.needs_review,
          classification_status: 'auto',
          ai_model_version: 'gemini-2.5-flash',
          classified_at: new Date().toISOString()
        };

        updateDocumentNonBlocking(doc(db, 'orders', order.id), updateData);

        // Actualización de Agregados (Simulación de Trigger de Cloud Function)
        const aggregateRef = doc(db, 'aggregates', 'global', 'disciplines_stats', result.disciplina_normalizada);
        setDocumentNonBlocking(aggregateRef, {
          count: increment(1),
          total_impact: increment(order.impactoNeto || 0),
          last_updated: new Date().toISOString()
        }, { merge: true });
      }

      toast({
        title: "Clasificación IA Exitosa",
        description: `Disciplina: ${result.disciplina_normalizada} (Confianza: ${Math.round(result.confidence_score * 100)}%)`,
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
    <div className="flex min-h-screen w-full bg-background/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Clasificación Semántica IA</h1>
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
                  Filtro: {statusFilter.toUpperCase()}
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
          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>PID / Proyecto</TableHead>
                    <TableHead>Disciplina IA</TableHead>
                    <TableHead>Confianza</TableHead>
                    <TableHead className="text-right">Impacto Neto</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow key={order.id} className={`hover:bg-primary/5 group ${order.needs_review ? 'bg-rose-50/30' : ''}`}>
                      <TableCell>
                        {order.disciplina_normalizada ? (
                          order.needs_review ? (
                            <Badge variant="outline" className="text-rose-500 border-rose-200 bg-rose-50 gap-1">
                              <AlertTriangle className="h-3 w-3" /> Revisión
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Auto
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-slate-300">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-primary">{order.projectId || "S/P"}</span>
                          <span className="text-[10px] text-muted-foreground uppercase truncate max-w-[150px]">{order.projectName || "Sin Nombre"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-700">{order.disciplina_normalizada || "—"}</span>
                      </TableCell>
                      <TableCell>
                         {order.confidence_score ? (
                           <div className="flex items-center gap-2">
                             <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                               <div 
                                 className={`h-full ${order.confidence_score > 0.8 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                 style={{ width: `${order.confidence_score * 100}%` }}
                               />
                             </div>
                             <span className="text-[10px] font-bold text-slate-500">{Math.round(order.confidence_score * 100)}%</span>
                           </div>
                         ) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-800">
                        ${formatAmount(order.impactoNeto || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.disciplina_normalizada ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-primary gap-1">
                                <ArrowUpRight className="h-4 w-4" /> Detalle
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle className="text-2xl flex items-center gap-3">
                                  {order.disciplina_normalizada} 
                                  <Badge variant="outline" className="bg-primary/5 text-primary">IA Classified</Badge>
                                </DialogTitle>
                                <DialogDescription className="text-lg">
                                  {order.projectName} ({order.projectId})
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-6 py-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                   <Card className="p-4 border shadow-none bg-white">
                                      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2">
                                        <Fingerprint className="h-4 w-4 text-emerald-500" /> Evidencia Técnica
                                      </h4>
                                      <div className="flex flex-wrap gap-2">
                                        {order.evidence_terms?.map((term: string, i: number) => (
                                          <Badge key={i} variant="secondary" className="text-[10px] bg-slate-50 text-slate-600">
                                            {term}
                                          </Badge>
                                        ))}
                                      </div>
                                      <p className="mt-4 text-xs text-slate-500 italic">
                                        "{order.rationale_short}"
                                      </p>
                                   </Card>
                                   <Card className="p-4 border shadow-none bg-white">
                                      <h4 className="text-[10px] font-black uppercase text-rose-500 mb-3 flex items-center gap-2">
                                        <ShieldAlert className="h-4 w-4" /> Diagnóstico Forense
                                      </h4>
                                      <div className="space-y-3">
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-400">Causa Raíz:</span>
                                          <span className="font-bold">{order.causa_raiz_normalizada}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                          <span className="text-slate-400">Subcausa:</span>
                                          <span className="font-bold">{order.subcausa_normalizada || "No detectada"}</span>
                                        </div>
                                        <div className="pt-2 border-t border-dashed">
                                          <p className="text-[10px] text-slate-400 uppercase font-black mb-1">Status de Clasificación</p>
                                          <Badge variant="outline" className="text-[9px] uppercase">{order.classification_status}</Badge>
                                        </div>
                                      </div>
                                   </Card>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => processSingleOrder(order)} disabled={isAnalyzing === order.id}>
                            {isAnalyzing === order.id ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Clasificar
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
