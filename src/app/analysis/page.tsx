
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
  Table as TableIcon, 
  Filter, 
  RefreshCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Lightbulb
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
import { collection, query, limit, updateDoc, doc } from 'firebase/firestore';
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), limit(50));
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
        title: "Análisis Semántico Completado",
        description: "Se han extraído conceptos e insights preventivos.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de IA",
        description: "No se pudo realizar el análisis semántico.",
      });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const filteredOrders = orders?.filter(o => 
    o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.projectId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.format?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="flex min-h-screen w-full bg-background/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800">Análisis Semántico & QC</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por PID o OC..."
                className="pl-9 w-[300px] h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </header>

        <main className="p-6 md:p-8">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-lg font-headline">Registro de Órdenes Inteligentes</CardTitle>
              <CardDescription>Normalización automática de conceptos y especialidades via IA</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PID / Orden</TableHead>
                    <TableHead>Concepto IA</TableHead>
                    <TableHead>Especialidad</TableHead>
                    <TableHead>Causa Real (Inferencia)</TableHead>
                    <TableHead className="text-right">Impacto</TableHead>
                    <TableHead className="text-center">IA Insights</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10">Cargando datos...</TableCell></TableRow>
                  ) : filteredOrders.map((order) => (
                    <TableRow key={order.id} className="hover:bg-primary/5">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-primary">{order.projectId}</span>
                          <span className="text-[10px] text-muted-foreground">{order.orderNumber || order.id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.semanticAnalysis?.conceptoNormalizado ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            {order.semanticAnalysis.conceptoNormalizado}
                          </Badge>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">Pendiente</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{order.semanticAnalysis?.especialidadImpactada || "N/A"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[180px] truncate text-xs" title={order.semanticAnalysis?.causaRaizReal}>
                          {order.semanticAnalysis?.causaRaizReal || order.causaRaiz}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        ${formatAmount(order.impactoNeto || 0)}
                      </TableCell>
                      <TableCell className="text-center">
                        {order.semanticAnalysis ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-primary">
                                <Lightbulb className="h-4 w-4 mr-1" /> Insights
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <BrainCircuit className="h-6 w-6 text-primary" />
                                  Inteligencia Preventiva
                                </DialogTitle>
                                <DialogDescription>
                                  Análisis semántico del PID {order.projectId}
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="grid gap-6 py-4">
                                <div className="space-y-2">
                                  <h4 className="text-sm font-bold flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Resumen del Impacto
                                  </h4>
                                  <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                                    {order.semanticAnalysis.summary?.map((s: string, i: number) => (
                                      <li key={i}>{s}</li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="space-y-2 bg-amber-50 p-4 rounded-lg border border-amber-100">
                                  <h4 className="text-sm font-bold flex items-center gap-2 text-amber-800">
                                    <AlertTriangle className="h-4 w-4" /> Medidas Preventivas (Próximo Diseño)
                                  </h4>
                                  <ul className="list-disc pl-5 text-sm text-amber-700 space-y-1">
                                    {order.semanticAnalysis.preventiveChecks?.map((c: string, i: number) => (
                                      <li key={i}>{c}</li>
                                    ))}
                                  </ul>
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
                            className="text-[10px] h-7"
                          >
                            {isAnalyzing === order.id ? <RefreshCcw className="h-3 w-3 animate-spin" /> : "Ejecutar IA"}
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
