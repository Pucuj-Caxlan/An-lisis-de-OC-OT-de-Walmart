"use client"

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  FileText
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
import { collection, query, limit, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
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
    return query(collection(db, 'orders'), limit(200));
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
        descripcion: order.descripcion || order.descripcionOriginal || order.standardizedDescription || "",
        causaDeclarada: order.causaRaiz,
        lineItems: order.lineItems || [],
        montoTotal: order.impactoNeto || order.impactAmount
      });

      if (db) {
        await updateDoc(doc(db, 'orders', order.id), {
          semanticAnalysis: result,
          standardizedDescription: result.standardizedDescription,
          processedAt: new Date().toISOString()
        });
      }

      toast({
        title: "Análisis Exitoso",
        description: `Registro ${order.projectId} estructurado correctamente.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Fallo en IA",
        description: "No se pudo completar la extracción semántica.",
      });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleBulkProcess = async () => {
    const pendingOrders = filteredOrders.filter(o => !o.semanticAnalysis);
    if (pendingOrders.length === 0) return;

    setIsBulkProcessing(true);
    let successCount = 0;

    toast({
      title: "Iniciando procesamiento de cola",
      description: `Estructurando ${pendingOrders.length} registros...`,
    });

    for (const order of pendingOrders) {
      try {
        const result = await analyzeOrderSemantically({
          descripcion: order.descripcion || order.descripcionOriginal || "",
          causaDeclarada: order.causaRaiz,
          lineItems: order.lineItems || []
        });
        if (db) {
          await updateDoc(doc(db, 'orders', order.id), {
            semanticAnalysis: result,
            standardizedDescription: result.standardizedDescription,
            processedAt: new Date().toISOString()
          });
          successCount++;
        }
      } catch (e) {
        console.error("Error en PID:", order.projectId);
      }
    }

    setIsBulkProcessing(false);
    toast({
      title: "Procesamiento Finalizado",
      description: `Éxito en ${successCount} de ${pendingOrders.length} registros.`,
    });
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      toast({ title: "Registro eliminado" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const handleDeleteAll = async () => {
    if (!db || !orders) return;
    try {
      const batch = writeBatch(db);
      orders.forEach((order) => {
        batch.delete(doc(db, 'orders', order.id));
      });
      await batch.commit();
      toast({ title: "Base de datos reiniciada" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const filteredOrders = orders?.filter(o => {
    const searchStr = searchTerm.toLowerCase();
    const matchesSearch = 
      o.projectId?.toLowerCase().includes(searchStr) ||
      o.orderNumber?.toLowerCase().includes(searchStr) ||
      o.projectName?.toLowerCase().includes(searchStr);
    
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
                  <AlertDialogTitle>¿Está seguro de purgar los datos?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará todos los registros de órdenes del sistema.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">
                    Sí, purgar todo
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
                Extracción detallada y estructuración semántica de registros.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="h-11 px-4 text-sm font-bold border-primary/20 text-primary">
                {pendingCount} PENDIENTES
              </Badge>
              <Button 
                onClick={handleBulkProcess} 
                disabled={isBulkProcessing || pendingCount === 0}
                className="bg-primary gap-2 h-11 px-6 shadow-md"
              >
                {isBulkProcessing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                Estructurar Cola
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
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No hay registros para mostrar.</TableCell></TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-primary/5 group">
                      <TableCell>
                        {order.semanticAnalysis ? (
                          <Badge className="bg-emerald-500 text-[10px] uppercase font-bold">Procesado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px] uppercase font-bold">En Cola</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-primary">{order.projectId}</span>
                          <span className="text-[10px] text-muted-foreground uppercase truncate max-w-[200px]">{order.projectName || "Sin Nombre"}</span>
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
                        ${formatAmount(order.impactoNeto || order.impactAmount || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.semanticAnalysis ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-primary gap-1">
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
                                  PID <span className="text-primary font-bold">{order.projectId}</span> | {order.projectName}
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="grid gap-6 py-4">
                                <div className="bg-slate-50 p-4 rounded-xl border">
                                  <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-3">Descripción Estandarizada</h4>
                                  <p className="text-sm text-slate-700 leading-relaxed italic">
                                    {order.standardizedDescription || "No disponible"}
                                  </p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                      <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Puntos Clave
                                    </h4>
                                    <div className="space-y-2">
                                      {order.semanticAnalysis.summary?.map((s: string, i: number) => (
                                        <div key={i} className="flex gap-3 text-xs text-slate-600">
                                          <span className="text-primary font-bold">•</span>
                                          {s}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                      <AlertTriangle className="h-4 w-4 text-accent" /> Prevención
                                    </h4>
                                    <div className="space-y-2">
                                      {order.semanticAnalysis.preventiveChecks?.map((c: string, i: number) => (
                                        <div key={i} className="flex gap-2 text-xs text-slate-700 bg-amber-50 p-2 rounded-lg">
                                          <span className="font-bold text-amber-600">!</span>
                                          {c}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                
                                {order.lineItems && order.lineItems.length > 0 && (
                                  <div>
                                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Desglose Financiero</h4>
                                    <div className="border rounded-lg overflow-hidden">
                                      <Table>
                                        <TableHeader className="bg-slate-50">
                                          <TableRow>
                                            <TableHead className="text-[10px]">Descripción</TableHead>
                                            <TableHead className="text-right text-[10px]">Importe</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {order.lineItems.map((item: any, i: number) => (
                                            <TableRow key={i}>
                                              <TableCell className="text-[11px] py-2">{item.descripcion}</TableCell>
                                              <TableCell className="text-right text-[11px] py-2 font-bold">${formatAmount(item.importe)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => processSingleOrder(order)}
                            disabled={isAnalyzing === order.id}
                            className="text-[10px] h-8 gap-1"
                          >
                            {isAnalyzing === order.id ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Analizar
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se borrará permanentemente la orden del PID <span className="font-bold">{order.projectId}</span>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteOrder(order.id)} className="bg-destructive">
                                Eliminar
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
