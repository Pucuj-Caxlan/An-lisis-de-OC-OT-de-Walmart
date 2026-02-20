
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
  Pause,
  ArrowUpRight,
  ShieldAlert
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'processed' | 'P0'>('all');
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
        description: `Registro ${order.projectId || order.id} estructurado con éxito. Prioridad: ${result.priorityCategory}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Fallo en IA",
        description: error.message || "No se pudo completar el análisis.",
      });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleBulkProcess = async () => {
    const pendingOrders = filteredOrders.filter(o => !o.semanticAnalysis);
    if (pendingOrders.length === 0) {
      toast({ title: "Sin pendientes", description: "No hay registros en la cola." });
      return;
    }

    setIsBulkProcessing(true);
    for (const order of pendingOrders) {
      if (!isBulkProcessing) break;
      await processSingleOrder(order);
      await new Promise(resolve => setTimeout(resolve, 3500));
    }
    setIsBulkProcessing(false);
  };

  const getPriorityBadge = (cat?: string) => {
    switch(cat) {
      case 'P0': return <Badge className="bg-rose-600 animate-pulse">P0 - Crítico</Badge>;
      case 'P1': return <Badge className="bg-amber-500">P1 - Alto</Badge>;
      case 'P2': return <Badge variant="secondary" className="bg-blue-100 text-blue-700">P2 - Medio</Badge>;
      case 'P3': return <Badge variant="outline" className="text-slate-400">P3 - Higiene</Badge>;
      default: return null;
    }
  };

  const filteredOrders = orders?.filter(o => {
    const searchStr = searchTerm.toLowerCase();
    const pid = String(o.projectId || "").toLowerCase();
    const name = String(o.projectName || "").toLowerCase();
    const matchesSearch = pid.includes(searchStr) || name.includes(searchStr);
    
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'pending' && !o.semanticAnalysis) ||
      (statusFilter === 'processed' && o.semanticAnalysis) ||
      (statusFilter === 'P0' && o.semanticAnalysis?.priorityCategory === 'P0');

    return matchesSearch && matchesStatus;
  }) || [];

  return (
    <div className="flex min-h-screen w-full bg-background/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Control Semántico & Priorización</h1>
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
                  {statusFilter === 'all' ? 'Ver Todos' : statusFilter === 'P0' ? 'Solo Críticos' : 'Filtro'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>Todos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('P0')}>P0 - Críticos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>Sin analizar</DropdownMenuItem>
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
                    <TableHead className="w-[120px]">Prioridad</TableHead>
                    <TableHead>PID / Proyecto</TableHead>
                    <TableHead>Concepto IA</TableHead>
                    <TableHead>Error / Driver</TableHead>
                    <TableHead className="text-right">Impacto Neto</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><RefreshCcw className="h-8 w-8 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow key={order.id} className={`hover:bg-primary/5 group ${order.semanticAnalysis?.priorityCategory === 'P0' ? 'bg-rose-50/30' : ''}`}>
                      <TableCell>
                        {order.semanticAnalysis ? getPriorityBadge(order.semanticAnalysis.priorityCategory) : <Badge variant="outline" className="text-slate-300">En Cola</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-primary">{order.projectId || "S/P"}</span>
                          <span className="text-[10px] text-muted-foreground uppercase truncate max-w-[150px]">{order.projectName || "Sin Nombre"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-700">{order.semanticAnalysis?.conceptoNormalizado || "Pendiente"}</span>
                      </TableCell>
                      <TableCell>
                         <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-600 bg-slate-50">
                            {order.semanticAnalysis?.tipoError || "—"}
                         </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-800">
                        ${formatAmount(order.impactoNeto || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.semanticAnalysis ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-primary gap-1">
                                <ArrowUpRight className="h-4 w-4" /> Detalle
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-2xl">
                                  {getPriorityBadge(order.semanticAnalysis.priorityCategory)}
                                  Score: {order.semanticAnalysis.priorityScore}
                                </DialogTitle>
                                <DialogDescription className="text-lg">
                                  {order.projectName} ({order.projectId})
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-6 py-4">
                                <div className="bg-slate-50 p-4 rounded-xl border border-primary/10">
                                  <h4 className="text-[10px] font-black uppercase text-primary mb-2">Razonamiento de Prioridad</h4>
                                  <p className="text-sm text-slate-700 italic">
                                    {order.semanticAnalysis.prioritizationReasoning || "Inferencia sistémica basada en impacto y riesgo regulatorio."}
                                  </p>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                   <Card className="p-4 border shadow-none bg-white">
                                      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Hallazgos IA
                                      </h4>
                                      <ul className="space-y-2">
                                        {order.semanticAnalysis.summary?.map((s: string, i: number) => (
                                          <li key={i} className="text-xs text-slate-600 flex gap-2">
                                            <span className="text-primary font-bold">•</span> {s}
                                          </li>
                                        ))}
                                      </ul>
                                   </Card>
                                   <Card className="p-4 border shadow-none bg-white">
                                      <h4 className="text-[10px] font-black uppercase text-rose-500 mb-3 flex items-center gap-2">
                                        <ShieldAlert className="h-4 w-4" /> Riesgos & Prevención
                                      </h4>
                                      <ul className="space-y-2">
                                        {order.semanticAnalysis.preventiveChecks?.map((c: string, i: number) => (
                                          <li key={i} className="text-xs text-slate-700 bg-rose-50/50 p-1.5 rounded">
                                            {c}
                                          </li>
                                        ))}
                                      </ul>
                                   </Card>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => processSingleOrder(order)} disabled={isAnalyzing === order.id}>
                            {isAnalyzing === order.id ? <RefreshCcw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                            Analizar
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
