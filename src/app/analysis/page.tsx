
"use client"

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  BrainCircuit, 
  RefreshCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Trash2,
  Eraser,
  Play,
  Filter,
  FileText,
  FileSpreadsheet,
  Pause
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
import { collection, query, limit, doc, writeBatch } from 'firebase/firestore';
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processed'>('all');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
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
        projectId: order.projectId || order.projectInfo?.projectId || "",
        projectName: order.projectName || order.projectInfo?.projectName || "",
        format: order.format || order.projectInfo?.format || "",
        descripcion: order.descripcion || order.descriptionSection?.description || order.standardizedDescription || "",
        causaDeclarada: order.causaRaiz || order.projectInfo?.rootCauseDeclared || "",
        montoTotal: order.impactoNeto || order.financialImpact?.netImpact || 0,
        contextoExtendido: order,
        isSigned: order.isSigned
      });

      if (db) {
        updateDocumentNonBlocking(doc(db, 'orders', order.id), {
          semanticAnalysis: result,
          standardizedDescription: result.standardizedDescription,
          processedAt: new Date().toISOString()
        });
      }

      toast({
        title: "Análisis Exitoso",
        description: `Registro ${order.projectId || order.id} estructurado con éxito.`,
      });
    } catch (error: any) {
      const isQuotaError = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
      toast({
        variant: "destructive",
        title: isQuotaError ? "Límite de IA alcanzado" : "Fallo en IA",
        description: isQuotaError 
          ? "Demasiadas solicitudes en poco tiempo. Por favor, espere 1 minuto e intente de nuevo."
          : error.message || "No se pudo completar la extracción semántica.",
      });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleBulkProcess = async () => {
    const pendingOrders = filteredOrders.filter(o => !o.semanticAnalysis);
    if (pendingOrders.length === 0) {
      toast({ title: "Sin pendientes", description: "No hay registros en la cola para procesar." });
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let quotaExceeded = false;

    toast({
      title: "Procesando Lote (Throttled)",
      description: `Analizando ${pendingOrders.length} registros con pausas de seguridad...`,
    });

    for (const order of pendingOrders) {
      if (!isBulkProcessing) break;
      
      try {
        const result = await analyzeOrderSemantically({
          projectId: order.projectId || "",
          projectName: order.projectName || "",
          descripcion: order.descripcion || order.descriptionSection?.description || "",
          causaDeclarada: order.causaRaiz || "",
          montoTotal: order.impactoNeto || 0,
          isSigned: order.isSigned
        });
        
        if (db) {
          updateDocumentNonBlocking(doc(db, 'orders', order.id), {
            semanticAnalysis: result,
            standardizedDescription: result.standardizedDescription,
            processedAt: new Date().toISOString()
          });
          successCount++;
        }

        // Artificial delay to stay under Gemini 1.5/2.5 Flash free tier rate limits (approx 15-20 RPM)
        await new Promise(resolve => setTimeout(resolve, 3500));
        
      } catch (error: any) {
        const isQuotaError = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
        if (isQuotaError) {
          quotaExceeded = true;
          break; // Stop bulk processing on quota error
        }
      }
    }

    setIsBulkProcessing(false);
    
    if (quotaExceeded) {
      toast({
        variant: "destructive",
        title: "Lote Interrumpido",
        description: `Se procesaron ${successCount} registros, pero se alcanzó el límite de solicitudes de la IA. El resto permanecerá en cola.`,
      });
    } else {
      toast({
        title: "Lote Finalizado",
        description: `${successCount} registros estructurados correctamente.`,
      });
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'orders', orderId));
    toast({ title: "Registro eliminado" });
  };

  const handleDeleteAll = async () => {
    if (!db || !orders) return;
    try {
      const batch = writeBatch(db);
      orders.forEach((order) => {
        batch.delete(doc(db, 'orders', order.id));
      });
      await batch.commit();
      toast({ title: "Base de datos purgada", description: "Todos los registros han sido eliminados." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al purgar", description: "No se pudieron eliminar los registros." });
    }
  };

  const filteredOrders = orders?.filter(o => {
    const searchStr = searchTerm.toLowerCase();
    const pid = String(o.projectId || o.projectInfo?.projectId || "").toLowerCase();
    const name = String(o.projectName || o.projectInfo?.projectName || "").toLowerCase();
    
    const matchesSearch = pid.includes(searchStr) || name.includes(searchStr);
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'pending' && !o.semanticAnalysis) ||
      (statusFilter === 'processed' && o.semanticAnalysis);

    return matchesSearch && matchesStatus;
  }) || [];

  const pendingCount = orders?.filter(o => !o.semanticAnalysis).length || 0;

  return (
    <div className="flex min-h-screen w-full bg-background/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Auditoría Semántica & Control</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="PID o Nombre..."
                className="pl-9 w-[220px] h-9 bg-slate-50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {statusFilter === 'all' ? 'Ver Todos' : statusFilter === 'pending' ? 'Pendientes' : 'Procesados'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>Todos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>Sin analizar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('processed')}>Analizados por IA</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-6" />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2" disabled={!orders || orders.length === 0}>
                  <Eraser className="h-4 w-4" /> Purgar Base
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-rose-600">¿Confirmar purga total?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción es irreversible. Se eliminarán permanentemente todos los registros (PDF y Excel) del sistema de auditoría.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">
                    Eliminar todos los registros
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>

        <main className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Control de Procesamiento</h2>
              <p className="text-sm text-slate-500">
                Extracción detallada y estructuración semántica de registros. (Límites de IA aplicados para estabilidad).
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="h-11 px-4 text-sm font-bold border-primary/20 text-primary bg-primary/5">
                {pendingCount} PENDIENTES
              </Badge>
              <Button 
                onClick={isBulkProcessing ? () => setIsBulkProcessing(false) : handleBulkProcess} 
                disabled={!isBulkProcessing && pendingCount === 0}
                className={`${isBulkProcessing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary/90'} gap-2 h-11 px-6 shadow-md transition-all active:scale-95`}
              >
                {isBulkProcessing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                {isBulkProcessing ? 'Detener Cola' : 'Estructurar Cola'}
              </Button>
            </div>
          </div>

          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Estado</TableHead>
                    <TableHead>PID / Proyecto</TableHead>
                    <TableHead>Concepto IA</TableHead>
                    <TableHead>Causa Raíz Real</TableHead>
                    <TableHead className="text-right">Impacto Neto</TableHead>
                    <TableHead className="text-center">IA Auditor</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No hay registros que coincidan con los filtros.</TableCell></TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-primary/5 group transition-colors">
                      <TableCell>
                        {order.semanticAnalysis ? (
                          <Badge className="bg-emerald-500 text-[10px] uppercase font-bold tracking-tight">Procesado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px] uppercase font-bold tracking-tight">En Cola</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {order.createdFromPdf || order.pdfUrl ? (
                                  <FileText className="h-5 w-5 text-primary shrink-0" />
                                ) : (
                                  <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-[10px] font-bold uppercase">{order.createdFromPdf || order.pdfUrl ? 'Fuente: Formato PDF' : 'Fuente: Reporte Excel'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="flex flex-col">
                            <span className="font-bold text-primary">{order.projectId || order.projectInfo?.projectId || "S/P"}</span>
                            <span className="text-[10px] text-muted-foreground uppercase truncate max-w-[180px]">{order.projectName || order.projectInfo?.projectName || "Sin Nombre"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.semanticAnalysis?.conceptoNormalizado ? (
                          <span className="font-medium text-slate-700">{order.semanticAnalysis.conceptoNormalizado}</span>
                        ) : (
                          <span className="text-xs italic text-slate-400">Pendiente</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.semanticAnalysis?.causaRaizReal ? (
                          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 text-[10px]">
                            {order.semanticAnalysis.causaRaizReal}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-800">
                        ${formatAmount(order.impactoNeto || order.financialImpact?.netImpact || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.semanticAnalysis ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-primary gap-1 hover:bg-primary/10">
                                <Lightbulb className="h-4 w-4 text-accent" /> Insights
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-2xl font-headline">
                                  <BrainCircuit className="h-8 w-8 text-primary" />
                                  Detalle de Auditoría IA
                                </DialogTitle>
                                <DialogDescription className="text-lg">
                                  PID <span className="text-primary font-bold">{order.projectId || order.projectInfo?.projectId}</span> | {order.projectName || order.projectInfo?.projectName}
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="grid gap-6 py-4">
                                <div className="bg-slate-50 p-4 rounded-xl border border-primary/10">
                                  <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Descripción Estandarizada [QUÉ/POR QUÉ/RIESGO]</h4>
                                  <p className="text-sm text-slate-700 leading-relaxed italic">
                                    {order.standardizedDescription || order.semanticAnalysis.standardizedDescription || "No disponible"}
                                  </p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Hallazgos Clave
                                    </h4>
                                    <div className="space-y-2">
                                      {order.semanticAnalysis.summary?.map((s: string, i: number) => (
                                        <div key={i} className="flex gap-3 text-xs text-slate-600 bg-slate-50/50 p-2 rounded-lg">
                                          <span className="text-primary font-bold">•</span>
                                          {s}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                      <AlertTriangle className="h-4 w-4 text-accent" /> Prevención & Alertas
                                    </h4>
                                    <div className="space-y-2">
                                      {order.semanticAnalysis.preventiveChecks?.map((c: string, i: number) => (
                                        <div key={i} className="flex gap-2 text-xs text-slate-700 bg-amber-50 p-2 rounded-lg border border-amber-100/50">
                                          <span className="font-bold text-amber-600">!</span>
                                          {c}
                                        </div>
                                      ))}
                                      {order.semanticAnalysis.auditAlerts?.map((a: any, i: number) => (
                                        <div key={`alert-${i}`} className={`flex gap-2 text-[10px] p-2 rounded-lg border ${a.severity === 'High' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                                          <AlertTriangle className="h-3 w-3 shrink-0" />
                                          <div>
                                            <p className="font-bold uppercase">{a.type}</p>
                                            <p>{a.message}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
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
                            className="text-[10px] h-8 gap-1 hover:border-primary hover:text-primary transition-all active:scale-95"
                          >
                            {isAnalyzing === order.id ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Analizar
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se borrará permanentemente la orden del PID <span className="font-bold">{order.projectId || order.projectInfo?.projectId}</span> de la base de datos de auditoría.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteOrder(order.id)} className="bg-destructive">
                                Confirmar eliminación
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
