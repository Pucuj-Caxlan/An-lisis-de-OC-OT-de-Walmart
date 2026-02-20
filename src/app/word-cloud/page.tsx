
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BrainCircuit, 
  RefreshCcw, 
  Target, 
  Zap, 
  TrendingUp, 
  Activity, 
  AlertTriangle, 
  ShieldCheck,
  LayoutGrid,
  Filter,
  Search,
  ArrowRight,
  Info,
  Layers,
  PieChart as PieChartIcon,
  SearchCode
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit } from 'firebase/firestore';
import { analyzeWordCloud, WordCloudOutput } from '@/ai/flows/word-cloud-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function WordCloudPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cloudData, setCloudData] = useState<WordCloudOutput | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  const [filters, setFilters] = useState({
    year: 'TODO',
    discipline: 'all',
    type: 'all'
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    // Limitamos a 100 para estabilidad del payload y evitar Failed to fetch
    return query(collection(db, 'orders'), limit(100));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      const dateStr = o.fechaSolicitud || o.requestDate || "";
      const yearMatch = filters.year === 'TODO' || dateStr.includes(filters.year);
      const discMatch = filters.discipline === 'all' || o.disciplina_normalizada === filters.discipline;
      const typeMatch = filters.type === 'all' || o.dataSource === filters.type;
      return yearMatch && discMatch && typeMatch;
    });
  }, [orders, filters]);

  const runAnalysis = async () => {
    if (filteredOrders.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "No hay registros para analizar con los filtros actuales." });
      return;
    }
    setIsAnalyzing(true);
    setCloudData(null);
    
    try {
      // Optimizamos el payload: solo enviamos lo necesario y truncamos descripciones a 300 chars
      const simplifiedOrders = filteredOrders.map(o => ({
        id: o.id,
        impactoNeto: o.impactoNeto || 0,
        disciplina_normalizada: o.disciplina_normalizada || 'Indefinida',
        causa_raiz_normalizada: o.causa_raiz_normalizada || o.causaRaiz || 'Sin definir',
        descripcion: String(o.descripcion || "").substring(0, 300),
        standardizedDescription: o.standardizedDescription,
        fechaSolicitud: o.fechaSolicitud
      }));

      const result = await analyzeWordCloud({ orders: simplifiedOrders as any });
      setCloudData(result);
      toast({ title: "Nube Forense Generada", description: "Análisis semántico 80/20 completado." });
    } catch (error: any) {
      console.error("Word Cloud Analysis Failed:", error);
      toast({ 
        variant: "destructive", 
        title: "Error de IA", 
        description: "La petición excedió el límite de tiempo. Intente filtrar por un periodo más corto o con menos registros." 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  const getWordSize = (weight: number) => {
    if (weight > 85) return 'text-5xl md:text-6xl font-black';
    if (weight > 70) return 'text-4xl md:text-5xl font-extrabold';
    if (weight > 50) return 'text-2xl md:text-3xl font-bold';
    if (weight > 30) return 'text-lg md:text-xl font-semibold';
    return 'text-sm font-medium';
  };

  const getWordColor = (sentiment: string) => {
    switch(sentiment) {
      case 'Crítico': return 'text-rose-600 hover:text-rose-700';
      case 'Riesgo': return 'text-amber-600 hover:text-amber-700';
      default: return 'text-primary hover:text-primary/80';
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Inteligencia Semántica 80/20</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex bg-slate-100 p-1 rounded-xl border gap-1">
              {['2024', '2025', 'TODO'].map(y => (
                <button 
                  key={y}
                  onClick={() => setFilters({...filters, year: y})}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${filters.year === y ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-white'}`}
                >
                  {y}
                </button>
              ))}
            </div>
            <Button 
              onClick={runAnalysis} 
              disabled={isAnalyzing || filteredOrders.length === 0}
              className="bg-primary hover:bg-primary/90 gap-2 shadow-lg rounded-xl h-10 px-6"
            >
              {isAnalyzing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Generar Nube Forense
            </Button>
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Panel de Nube de Palabras */}
            <Card className="lg:col-span-3 border-none shadow-xl bg-white rounded-3xl overflow-hidden min-h-[600px] flex flex-col">
              <CardHeader className="bg-slate-900 text-white p-6 shrink-0">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight flex items-center gap-2">
                      <Layers className="h-5 w-5 text-accent" /> Mapa de Calor Semántico
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs font-medium uppercase">Ponderación: (0.7 Impacto + 0.3 Recurrencia) × Confianza IA</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-white/10 text-white border-white/20 px-4 py-1 uppercase text-[10px] font-black">
                    MUESTRA: {filteredOrders.length} REGISTROS
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-6 relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center text-primary space-y-4">
                    <RefreshCcw className="h-12 w-12 animate-spin opacity-40" />
                    <p className="text-xs font-black uppercase tracking-[0.2em]">Analizando Patrones 80/20...</p>
                  </div>
                ) : !cloudData ? (
                  <div className="flex flex-col items-center justify-center text-slate-300 space-y-4">
                    <BrainCircuit className="h-20 w-20 opacity-10" />
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Esperando ejecución del motor semántico...</p>
                  </div>
                ) : (
                  cloudData.concepts.map((word, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedConcept(word)}
                      className={`transition-all duration-300 transform hover:scale-110 active:scale-95 text-center ${getWordSize(word.weight)} ${getWordColor(word.sentiment)} ${selectedConcept?.text === word.text ? 'scale-110 ring-4 ring-primary/10 rounded-xl px-4 py-2 bg-primary/5 z-10' : ''}`}
                    >
                      {word.text}
                    </button>
                  ))
                )}
              </CardContent>
              <CardFooter className="bg-slate-50 border-t p-4 flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <div className="flex gap-6">
                  <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-rose-500" /> Alerta Crítica</span>
                  <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-amber-500" /> Riesgo de Control</span>
                  <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary" /> Tendencia Estable</span>
                </div>
                <span>Algoritmo Forense v2.5 • Walmart Intelligence</span>
              </CardFooter>
            </Card>

            {/* Panel de Control e Inteligencia */}
            <aside className="space-y-6">
              <Card className="border-none shadow-lg bg-slate-900 text-white rounded-3xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-2">
                    <Target className="h-4 w-4" /> Diagnóstico 80/20
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cloudData ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Concentración del Impacto</p>
                        <div className="flex items-end gap-2">
                          <span className="text-4xl font-headline font-bold text-white">{cloudData.concentrationPercentage}%</span>
                          <span className="text-xs text-emerald-400 font-bold mb-1">Top 5</span>
                        </div>
                        <Progress value={cloudData.concentrationPercentage} className="h-1.5 bg-white/10" />
                      </div>
                      <Separator className="bg-white/5" />
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Núcleo del Problema</p>
                        <p className="text-xs font-bold text-accent leading-relaxed">"{cloudData.coreProblem}"</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 italic text-[11px] leading-relaxed text-slate-300">
                        {cloudData.executiveDiagnosis}
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center text-slate-500 space-y-3">
                      <SearchCode className="h-8 w-8 mx-auto opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">Ejecute el análisis para identificar la concentración de impacto.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detalle del Concepto Seleccionado */}
              {selectedConcept ? (
                <Card className="border-none shadow-xl bg-white rounded-3xl animate-in slide-in-from-right-5 duration-500">
                  <CardHeader className="border-b bg-slate-50/50 pb-4">
                    <div className="flex justify-between items-start">
                      <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase">{selectedConcept.category}</Badge>
                      <button onClick={() => setSelectedConcept(null)} className="text-slate-300 hover:text-slate-600"><RefreshCcw className="h-3 w-3" /></button>
                    </div>
                    <CardTitle className="text-xl font-headline font-bold text-slate-800 uppercase mt-2">{selectedConcept.text}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Impacto Total</p>
                        <p className="text-sm font-black text-slate-800">{formatCurrency(selectedConcept.impact)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Frecuencia</p>
                        <p className="text-sm font-black text-slate-800">{selectedConcept.frequency} Órdenes</p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Tendencia Temporal</p>
                        <Badge className={`text-[8px] font-black uppercase ${selectedConcept.trend === 'Creciente' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                          {selectedConcept.trend}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className={`h-4 w-4 ${selectedConcept.trend === 'Creciente' ? 'text-rose-500' : 'text-emerald-500'}`} />
                        <span className="text-[10px] font-bold text-slate-600">Alta concentración en el periodo</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest">Ejemplos en Base</p>
                      <ScrollArea className="h-32 pr-4">
                        <div className="space-y-2">
                          {orders
                            ?.filter(o => o.causa_raiz_normalizada === selectedConcept.text || o.disciplina_normalizada === selectedConcept.text || o.descripcion?.includes(selectedConcept.text))
                            .slice(0, 5)
                            .map((o, idx) => (
                              <div key={idx} className="p-2 border-l-2 border-slate-200 bg-slate-50/50 rounded-r-lg">
                                <p className="text-[9px] font-bold text-slate-700 truncate">{o.projectId}</p>
                                <p className="text-[8px] text-slate-400 font-medium italic truncate">{o.descripcion}</p>
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button variant="outline" className="w-full h-9 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 border-primary/10 text-primary hover:bg-primary/5">
                      Ver Auditoría Completa <ArrowRight className="h-3 w-3 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <div className="h-60 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300 p-8 text-center bg-white/50">
                  <Info className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Seleccione un concepto de la nube para profundizar en su impacto forense.</p>
                </div>
              )}
            </aside>
          </div>

          {/* Recomendaciones Estratégicas AI */}
          {cloudData && (
            <section className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-accent animate-pulse" />
                <h2 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Estrategia de Mitigación Priorizada</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-6">
                {cloudData.strategicRecommendations.map((rec, i) => (
                  <Card key={i} className="border-none shadow-md bg-white hover:border-primary/20 transition-all rounded-3xl group overflow-hidden">
                    <div className="h-1.5 w-full bg-primary/10 group-hover:bg-primary transition-colors" />
                    <CardContent className="p-6 flex gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0">
                        <span className="text-primary font-black text-lg">{i + 1}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-700 leading-relaxed">{rec}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </main>
      </SidebarInset>
    </div>
  );
}
