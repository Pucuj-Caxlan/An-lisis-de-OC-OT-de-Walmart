
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
  SearchCode,
  Database,
  CheckCircle2,
  Clock,
  ChevronDown,
  Calendar,
  X,
  History,
  Sparkles
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, limit, orderBy, doc, setDoc, getDoc } from 'firebase/firestore';
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
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type WordConcept = {
  text: string;
  weight: number;
  impact: number;
  frequency: number;
  sentiment: 'Crítico' | 'Riesgo' | 'Estable';
  category: 'Disciplina' | 'Causa Raíz' | 'Concepto Técnico';
  trend: string;
};

export default function WordCloudPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cloudData, setCloudData] = useState<WordCloudOutput | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    year: 'TODO',
    month: 'all',
    discipline: 'all',
    format: 'all',
    status: 'all',
    search: ''
  });

  useEffect(() => { setMounted(true); }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), orderBy('impactoNeto', 'desc'), limit(1000));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  // Intentar cargar análisis previo guardado al cambiar filtros
  const snapshotId = useMemo(() => {
    const filterKey = JSON.stringify(filters).replace(/[^a-zA-Z0-9]/g, '_');
    return `cloud_snapshot_${filterKey}`;
  }, [filters]);

  useEffect(() => {
    const loadSnapshot = async () => {
      if (!db || !snapshotId) return;
      const snap = await getDoc(doc(db, 'word_cloud_snapshots', snapshotId));
      if (snap.exists()) {
        setCloudData(snap.data() as WordCloudOutput);
      } else {
        setCloudData(null);
      }
    };
    loadSnapshot();
  }, [db, snapshotId]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      const dateStr = o.fechaSolicitud || o.requestDate || "";
      const yearMatch = filters.year === 'TODO' || dateStr.includes(filters.year);
      const monthMatch = filters.month === 'all' || new Date(dateStr).getMonth() === parseInt(filters.month);
      const discMatch = filters.discipline === 'all' || o.disciplina_normalizada === filters.discipline;
      const formatMatch = filters.format === 'all' || o.format === filters.format || o.type === filters.format;
      const statusMatch = filters.status === 'all' || o.classification_status === filters.status;
      const searchMatch = !filters.search || 
        String(o.projectId).toLowerCase().includes(filters.search.toLowerCase()) || 
        String(o.projectName).toLowerCase().includes(filters.search.toLowerCase());
      
      return yearMatch && monthMatch && discMatch && formatMatch && statusMatch && searchMatch;
    });
  }, [orders, filters]);

  const stats = useMemo(() => {
    if (!orders) return { total: 0, classified: 0, pending: 0 };
    const total = orders.length;
    const classified = orders.filter(o => o.classification_status === 'auto' || o.classification_status === 'reviewed').length;
    return { total, classified, pending: total - classified };
  }, [orders]);

  // MODELO MATEMÁTICO: Cálculo de pesos local (Sin IA)
  const localCloudWeights = useMemo(() => {
    const groups: Record<string, { impact: number; count: number; disc: string; causa: string; desc: string[] }> = {};
    let maxImpact = 0;
    let maxCount = 0;

    filteredOrders.forEach(o => {
      const disc = o.disciplina_normalizada || 'Indefinida';
      const causa = o.causa_raiz_normalizada || o.causaRaiz || 'Sin definir';
      const key = `${disc}|${causa}`;
      
      if (!groups[key]) groups[key] = { impact: 0, count: 0, disc, causa, desc: [] };
      groups[key].impact += (o.impactoNeto || 0);
      groups[key].count += 1;
      if (o.descripcion && groups[key].desc.length < 3) groups[key].desc.push(String(o.descripcion).substring(0, 100));
      
      if (groups[key].impact > maxImpact) maxImpact = groups[key].impact;
      if (groups[key].count > maxCount) maxCount = groups[key].count;
    });

    return Object.values(groups).map(g => {
      // Ponderación: 70% Impacto Económico, 30% Frecuencia
      const impactNorm = maxImpact > 0 ? g.impact / maxImpact : 0;
      const countNorm = maxCount > 0 ? g.count / maxCount : 0;
      const weight = (impactNorm * 70) + (countNorm * 30);

      return {
        text: g.causa === 'Sin definir' ? g.disc : g.causa,
        weight: Math.max(10, weight),
        impact: g.impact,
        frequency: g.count,
        sentiment: g.impact > (maxImpact * 0.5) ? 'Crítico' : g.impact > (maxImpact * 0.2) ? 'Riesgo' : 'Estable',
        category: 'Causa Raíz',
        trend: 'Calculado desde DB'
      } as WordConcept;
    }).sort((a, b) => b.impact - a.impact);
  }, [filteredOrders]);

  const runAnalysis = async (forceIA = false) => {
    if (filteredOrders.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "Cargue registros primero." });
      return;
    }

    if (!forceIA && localCloudWeights.length > 0) {
      // Generar vista instantánea basada solo en DB
      setCloudData({
        concepts: localCloudWeights,
        executiveDiagnosis: "Análisis generado instantáneamente desde la base estructurada. Presione 'Refinar con IA' para un diagnóstico estratégico profundo.",
        coreProblem: localCloudWeights[0]?.text || "Indefinido",
        concentrationPercentage: Math.round((localCloudWeights.slice(0, 5).reduce((a, b) => a + b.impact, 0) / (localCloudWeights.reduce((a, b) => a + b.impact, 0) || 1)) * 100),
        strategicRecommendations: ["Validar registros pendientes de clasificación para mejorar precisión."]
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const groups = localCloudWeights.map(w => ({
        disciplina: w.text,
        causa: w.text,
        impactoTotal: w.impact,
        frecuencia: w.frequency,
        descripcionesMuestra: "Muestra estructurada en DB"
      }));

      const result = await analyzeWordCloud({ groups });
      setCloudData(result);

      // Persistir en Firebase para evitar reprocesamiento
      if (db) {
        await setDoc(doc(db, 'word_cloud_snapshots', snapshotId), {
          ...result,
          id: snapshotId,
          generatedAt: new Date().toISOString(),
          filters,
          stats: {
            sampleSize: filteredOrders.length,
            totalImpact: filteredOrders.reduce((a, b) => a + (b.impactoNeto || 0), 0)
          }
        });
      }

      toast({ title: "Análisis Persistido", description: "Resultado guardado para acceso inmediato." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Servidor", description: "La IA está saturada. Intente más tarde." });
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
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Inteligencia Semántica 80/20</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-xl h-10 px-4 gap-2 transition-all ${showFilters ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600'}`}
            >
              <Filter className="h-4 w-4" />
              {showFilters ? 'Cerrar Filtros' : 'Filtros Avanzados'}
            </Button>
            <div className="h-8 w-px bg-slate-200 mx-1" />
            <Button 
              onClick={() => runAnalysis(false)} 
              disabled={isAnalyzing || filteredOrders.length === 0}
              variant="outline"
              className="border-primary/20 text-primary hover:bg-primary/5 rounded-xl h-10 px-6 font-bold"
            >
              {isAnalyzing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              Vista Instantánea (DB)
            </Button>
            <Button 
              onClick={() => runAnalysis(true)} 
              disabled={isAnalyzing || filteredOrders.length === 0}
              className="bg-primary hover:bg-primary/90 gap-2 shadow-lg rounded-xl h-10 px-6 font-bold"
            >
              {isAnalyzing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Refinar con IA
            </Button>
          </div>
        </header>

        {showFilters && (
          <div className="bg-white border-b p-6 animate-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 max-w-7xl mx-auto">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase">Periodo Anual</label>
                <Select value={filters.year} onValueChange={(v) => setFilters({...filters, year: v})}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODO">Todos los años</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase">Mes</label>
                <Select value={filters.month} onValueChange={(v) => setFilters({...filters, month: v})}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Enero - Diciembre</SelectItem>
                    {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => (
                      <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase">Disciplina</label>
                <Select value={filters.discipline} onValueChange={(v) => setFilters({...filters, discipline: v})}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Eléctrica">Eléctrica</SelectItem>
                    <SelectItem value="Civil">Civil</SelectItem>
                    <SelectItem value="Estructura Metálica">Estructura</SelectItem>
                    <SelectItem value="HVAC">HVAC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase">Formato</label>
                <Select value={filters.format} onValueChange={(v) => setFilters({...filters, format: v})}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">OC / OT</SelectItem>
                    <SelectItem value="OC">OC</SelectItem>
                    <SelectItem value="OT">OT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase">Buscar Proyecto / PID</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Escriba aquí..." 
                    className="h-9 pl-9 bg-slate-50 border-none text-xs font-medium"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Muestra Activa</p>
                  <h4 className="text-xl font-headline font-bold text-slate-800 leading-none">{filteredOrders.length} Registros</h4>
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] font-black">ESTRUCTURADO</Badge>
            </Card>
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Impacto Analizado</p>
                  <h4 className="text-xl font-headline font-bold text-emerald-600 leading-none">
                    {formatCurrency(filteredOrders.reduce((a, b) => a + (b.impactoNeto || 0), 0))}
                  </h4>
                </div>
              </div>
              <p className="text-[10px] font-black text-slate-300">100% COBERTURA</p>
            </Card>
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Persistencia</p>
                  <h4 className="text-xl font-headline font-bold text-amber-600 leading-none">
                    {cloudData?.concepts ? 'Análisis Guardado' : 'Sin Guardar'}
                  </h4>
                </div>
              </div>
              <Badge variant="outline" className="text-[8px] font-black uppercase">{filters.year}</Badge>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-3 border-none shadow-xl bg-white rounded-3xl overflow-hidden min-h-[600px] flex flex-col">
              <CardHeader className="bg-slate-900 text-white p-6 shrink-0">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight flex items-center gap-2">
                      <Layers className="h-5 w-5 text-accent" /> Mapa de Calor Semántico
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs font-medium uppercase">Visualización ponderada por Impacto (70%) y Frecuencia (30%)</CardDescription>
                  </div>
                  {cloudData && (
                    <div className="text-right">
                      <p className="text-[8px] font-black text-slate-500 uppercase">Última actualización</p>
                      <p className="text-[10px] font-bold text-accent">{new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-6 relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center text-primary space-y-4">
                    <RefreshCcw className="h-12 w-12 animate-spin opacity-40" />
                    <div className="text-center space-y-1">
                      <p className="text-xs font-black uppercase tracking-[0.2em]">Ejecutando Motor Forense...</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold italic">Analizando coherencia en {filteredOrders.length} registros</p>
                    </div>
                  </div>
                ) : !cloudData ? (
                  <div className="flex flex-col items-center justify-center text-slate-300 space-y-6 py-20">
                    <div className="relative">
                      <BrainCircuit className="h-24 w-24 opacity-10" />
                      <Search className="h-10 w-10 text-primary absolute -bottom-2 -right-2 opacity-20" />
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Sin Análisis Activo para estos filtros</p>
                      <Button onClick={() => runAnalysis(false)} className="bg-primary/10 text-primary hover:bg-primary/20 border-none shadow-none rounded-xl font-bold">Generar desde Base Estructurada</Button>
                    </div>
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
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" />
                  <span>Modelo de Ponderación 80/20 Activo</span>
                </div>
              </CardFooter>
            </Card>

            <aside className="space-y-6">
              <Card className="border-none shadow-lg bg-slate-900 text-white rounded-3xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] font-black uppercase text-accent tracking-widest flex items-center gap-2">
                    <Target className="h-4 w-4" /> Diagnóstico Ejecutivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cloudData ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Concentración del Impacto</p>
                        <div className="flex items-end gap-2">
                          <span className="text-4xl font-headline font-bold text-white">{cloudData.concentrationPercentage}%</span>
                          <span className="text-xs text-emerald-400 font-bold mb-1">del Gasto</span>
                        </div>
                        <Progress value={cloudData.concentrationPercentage} className="h-1.5 bg-white/10" />
                      </div>
                      <Separator className="bg-white/5" />
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Núcleo del Problema (IA)</p>
                        <p className="text-xs font-bold text-accent leading-relaxed">"{cloudData.coreProblem}"</p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/5 italic text-[11px] leading-relaxed text-slate-300">
                        {cloudData.executiveDiagnosis}
                      </div>
                    </>
                  ) : (
                    <div className="py-12 text-center text-slate-500 space-y-3">
                      <SearchCode className="h-8 w-8 mx-auto opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">Analice los datos para ver concentración de impacto.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedConcept ? (
                <Card className="border-none shadow-xl bg-white rounded-3xl animate-in slide-in-from-right-5 duration-500">
                  <CardHeader className="border-b bg-slate-50/50 pb-4">
                    <div className="flex justify-between items-start">
                      <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase">{selectedConcept.category}</Badge>
                      <button onClick={() => setSelectedConcept(null)} className="text-slate-300 hover:text-slate-600"><X className="h-3 w-3" /></button>
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
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-primary uppercase tracking-widest">Ejemplos en Base Estructurada</p>
                      <ScrollArea className="h-32 pr-4">
                        <div className="space-y-2">
                          {orders
                            ?.filter(o => o.causa_raiz_normalizada === selectedConcept.text || o.disciplina_normalizada === selectedConcept.text || o.causaRaiz === selectedConcept.text)
                            .slice(0, 10)
                            .map((o, idx) => (
                              <div key={idx} className="p-2 border-l-2 border-slate-200 bg-slate-50/50 rounded-r-lg">
                                <div className="flex justify-between items-center mb-1">
                                  <p className="text-[9px] font-black text-primary">{o.projectId}</p>
                                  <span className="text-[8px] font-bold text-slate-400">{formatCurrency(o.impactoNeto || 0)}</span>
                                </div>
                                <p className="text-[8px] text-slate-500 font-medium italic truncate">{o.descripcion}</p>
                              </div>
                            ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-60 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300 p-8 text-center bg-white/50">
                  <Info className="h-8 w-8 mb-3 opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Seleccione un concepto para ver detalle financiero y ejemplos.</p>
                </div>
              )}
            </aside>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
