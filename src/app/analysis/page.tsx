
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
    return query(collection(db, 'orders'), limit(100));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const formatAmount = (amount: number) => {
    if (!mounted) return "0.00";
    return amount.toLocaleString(undefined, { minimumFractionDigits: 2 });
  };

  const handleSemanticAnalysis = async (order: any) => {
    setIsAnalyzing(order.id);
    try {
      const result = await analyzeOrderSemantically({
        descripcion: order.descripcion || order.standardizedDescription,
        causaDeclarada: order.causaRaiz,
        lineItems: order.lineItems
      });

      if (db) {
        await updateDoc(doc(db, 'orders', order.id), {
          semanticAnalysis: result
        });
      }

      toast({
        title: "Análisis Completado",
        description: `PID ${order.projectId} procesado exitosamente.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de IA",
        description: "No se pudo realizar el análisis.",
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
      title: "Iniciando procesamiento masivo",
      description: `Procesando ${pendingOrders.length} registros...`,
    });

    for (const order of pendingOrders) {
      try {
        const result = await analyzeOrderSemantically({
          descripcion: order.descripcion || order.standardizedDescription,
          causaDeclarada: order.causaRaiz,
          lineItems: order.lineItems
        });
        if (db) {
          await updateDoc(doc(db, 'orders', order.id), {
            semanticAnalysis: result
          });
          successCount++;
        }
      } catch (e) {
        console.error("Error en procesamiento masivo para PID:", order.projectId);
      }
    }

    setIsBulkProcessing(false);
    toast({
      title: "Procesamiento Finalizado",
      description: `Se procesaron ${successCount} de ${pendingOrders.length} registros.`,
    });
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      toast({
        title: "Registro eliminado",
        description: "El registro ha sido borrado permanentemente.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: "No se pudo eliminar el registro.",
      });
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
      toast({
        title: "Base de datos limpia",
        description: "Todos los registros locales han sido eliminados.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron eliminar todos los registros.",
      });
    }
  };

  const filteredOrders = orders?.filter(o => {
    const matchesSearch = 
      o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.projectId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.format?.toLowerCase().includes(searchTerm.toLowerCase());
    
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
            <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Registro de Órdenes Inteligentes</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por PID o OC..."
                className="pl-9 w-[250px] h-9 bg-slate-50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {statusFilter === 'all' ? 'Todos' : statusFilter === 'pending' ? 'En Cola' : 'Procesados'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>Mostrar Todos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>Solo en Cola (Pendientes)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('processed')}>Solo Procesados</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-6 w-px bg-slate-200" />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2" disabled={!orders || orders.length === 0}>
                  <Eraser className="h-4 w-4" /> Borrar Todo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará de forma permanente **todos** los registros de órdenes de la base de datos de producción. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90">
                    Sí, eliminar todo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>

        <main className="p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-slate-800">Control de Procesamiento</h2>
              <p className="text-sm text-slate-500">
                {pendingCount} órdenes pendientes en cola de inteligencia artificial.
              </p>
            </div>
            <Button 
              onClick={handleBulkProcess} 
              disabled={isBulkProcessing || pendingCount === 0}
              className="bg-primary gap-2 h-11 px-6 shadow-md hover:shadow-lg transition-all"
            >
              {isBulkProcessing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              Procesar Cola Masivamente
            </Button>
          </div>

          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold uppercase text-slate-500">Listado de Auditoría</CardTitle>
                  <CardDescription>Visualice y gestione la normalización semántica de sus registros</CardDescription>
                </div>
                <Badge variant="outline" className="bg-white">
                  {filteredOrders.length} Registros mostrados
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-[120px]">Estado</TableHead>
                    <TableHead>PID / Orden</TableHead>
                    <TableHead>Concepto Normalizado</TableHead>
                    <TableHead>Especialidad</TableHead>
                    <TableHead className="text-right">Impacto</TableHead>
                    <TableHead className="text-center">Acciones IA</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">No se encontraron registros que coincidan con los filtros.</TableCell></TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-primary/5 group">
                      <TableCell>
                        {order.semanticAnalysis ? (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[10px] uppercase">Procesado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px] uppercase">En Cola</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-primary">{order.projectId}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{order.orderNumber || "Sin Folio"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.semanticAnalysis?.conceptoNormalizado ? (
                          <span className="font-medium text-slate-700">{order.semanticAnalysis.conceptoNormalizado}</span>
                        ) : (
                          <span className="text-xs italic text-slate-400">Sin analizar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {order.semanticAnalysis?.especialidadImpactada ? (
                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">
                            {order.semanticAnalysis.especialidadImpactada}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-800">
                        ${formatAmount(order.impactoNeto || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.semanticAnalysis ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                                <Lightbulb className="h-4 w-4 mr-1 text-accent" /> Ver Insights
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl border-none shadow-2xl">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-2xl font-headline">
                                  <BrainCircuit className="h-8 w-8 text-primary" />
                                  Inteligencia Walmart
                                </DialogTitle>
                                <DialogDescription className="text-lg">
                                  Análisis semántico del PID <span className="text-primary font-bold">{order.projectId}</span>
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="grid gap-6 py-6">
                                <div className="space-y-3">
                                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Resumen Ejecutivo
                                  </h4>
                                  <div className="bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-100">
                                    {order.semanticAnalysis.summary?.map((s: string, i: number) => (
                                      <div key={i} className="flex gap-3 text-sm text-slate-600">
                                        <span className="text-primary font-bold">•</span>
                                        {s}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-accent" /> Checklist Preventivo
                                  </h4>
                                  <div className="bg-amber-50/50 p-4 rounded-xl space-y-2 border border-amber-100">
                                    {order.semanticAnalysis.preventiveChecks?.map((c: string, i: number) => (
                                      <div key={i} className="flex gap-3 text-sm text-amber-800">
                                        <div className="h-5 w-5 rounded border border-amber-300 flex-shrink-0 mt-0.5" />
                                        {c}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleSemanticAnalysis(order)}
                            disabled={isAnalyzing === order.id}
                            className="text-[10px] h-8 bg-slate-50 hover:bg-primary hover:text-white transition-all gap-1"
                          >
                            {isAnalyzing === order.id ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Ejecutar IA
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-opacity">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción eliminará permanentemente la orden del PID <span className="font-bold">{order.projectId}</span> de la base de datos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteOrder(order.id)} className="bg-destructive hover:bg-destructive/90">
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
