
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
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy, doc, setDoc, getDoc, getCountFromServer } from 'firebase/firestore';
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
  const [totalInDb, setTotalInDb] = useState<number | null>(null);

  const [filters, setFilters] = useState({
    year: 'TODO',
    month: 'all',
    discipline: 'all',
    format: 'all',
    status: 'all',
    search: ''
  });

  useEffect(() => { setMounted(true); }, []);

  // SSOT: Conteo global real
  useEffect(() => {
    if (!db) return;
    const fetchTotal = async () => {
      try {
        const snapshot = await getCountFromServer(collection(db, 'orders'));
        setTotalInDb(snapshot.data().count);
      } catch (e) {
        console.warn("Failed to fetch total count:", e);
      }
    };
    fetchTotal();
  }, [db]);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    // Buffer ampliado a 20k
    return query(collection(db, 'orders'), orderBy('impactoNeto', 'desc'), limit(20000));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const snapshotId = useMemo(() => {
    const filterKey = JSON.stringify(filters).replace(/[^a-zA-Z0-9]/g, '_');
    return `cloud_snapshot_${filterKey}`;
  }, [filters]);

  useEffect(() => {
    const loadSnapshot = async () => {
      if (!db || !snapshotId) return;
      try {
        const snap = await getDoc(doc(db, 'word_cloud_snapshots', snapshotId));
        if (snap.exists()) {
          setCloudData(snap.data() as WordCloudOutput);
        } else {
          setCloudData(null);
        }
      } catch (e) {
        console.error("Error loading snapshot:", e);
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

  const localCloudWeights = useMemo(() => {
    const groups: Record<string, { impact: number; count: number; disc: string; causa: string }> = {};
    let maxImpact = 0;
    let maxCount = 0;

    filteredOrders.forEach(o => {
      const disc = o.disciplina_normalizada || 'Indefinida';
      const causa = o.causa_raiz_normalizada || o.causaRaiz || 'Sin definir';
      const key = `${disc}|${causa}`;
      
      if (!groups[key]) groups[key] = { impact: 0, count: 0, disc, causa };
      groups[key].impact += (o.impactoNeto || 0);
      groups[key].count += 1;
      
      if (groups[key].impact > maxImpact) maxImpact = groups[key].impact;
      if (groups[key].count > maxCount) maxCount = groups[key].count;
    });

    return Object.values(groups).map(g => {
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
        trend: 'DB Analytics'
      } as WordConcept;
    }).sort((a, b) => b.impact - a.impact);
  }, [filteredOrders]);

  const runAnalysis = async (forceIA = false) => {
    if (filteredOrders.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "Cargue registros primero." });
      return;
    }

    const totalImpact = filteredOrders.reduce((a, b) => a + (b.impactoNeto || 0), 0);
    const top5Impact = localCloudWeights.slice(0, 5).reduce((a, b) => a + b.impact, 0);
    const concentration = totalImpact > 0 ? Math.round((top5Impact / totalImpact) * 100) : 0;

    if (!forceIA) {
      setCloudData({
        concepts: localCloudWeights,
        executiveDiagnosis: "Análisis generado instantáneamente desde la base estructurada. Presione 'Refinar con IA' para un diagnóstico estratégico profundo.",
        coreProblem: localCloudWeights[0]?.text || "Indefinido",
        concentrationPercentage: concentration,
        strategicRecommendations: ["Validar registros pendientes de clasificación para mejorar precisión."]
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const topGroupsForIA = localCloudWeights.slice(0, 30).map(w => ({
        disciplina: w.text,
        causa: w.text,
        impactoTotal: w.impact,
        frecuencia: w.frequency
      }));

      const result = await analyzeWordCloud({ 
        groups: topGroupsForIA,
        totalImpact,
        totalOrders: filteredOrders.length
      });

      const finalData: WordCloudOutput = {
        ...result,
        concepts: localCloudWeights,
        concentrationPercentage: result.concentrationPercentage || concentration
      };

      setCloudData(finalData);

      if (db) {
        await setDoc(doc(db, 'word_cloud_snapshots', snapshotId), {
          ...finalData,
          id: snapshotId,
          generatedAt: new Date().toISOString(),
          filters,
          stats: {
            sampleSize: filteredOrders.length,
            totalImpact
          }
        });
      }

      toast({ title: "Análisis Estratégico Completo" });
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Error de Conexión", 
        description: "Fallo al procesar inteligencia semántica." 
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

  const classifiedCount = orders?.filter(o => o.classification_status === 'reviewed' || o.classification_status === 'auto').length || 0;

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
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Universo Global (SSOT)</p>
                  <h4 className="text-xl font-headline font-bold text-slate-800 leading-none">{totalInDb || orders?.length || 0} Registros</h4>
                </div>
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] font-black">ACTIVO</Badge>
            </Card>
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Clasificados IA</p>
                  <h4 className="text-xl font-headline font-bold text-emerald-600 leading-none">{classifiedCount}</h4>
                </div>
              </div>
              <p className="text-[10px] font-black text-slate-300">{Math.round((classifiedCount / (totalInDb || 1)) * 100)}% COBERTURA</p>
            </Card>
            <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Pendientes IA</p>
                  <h4 className="text-xl font-headline font-bold text-amber-600 leading-none">{(totalInDb || orders?.length || 0) - classifiedCount}</h4>
                </div>
              </div>
              <Badge variant="outline" className="text-[8px] font-black uppercase">REQUERIDO</Badge>
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
                    <CardDescription className="text-slate-400 text-xs font-medium uppercase">Visualización basada en el universo total de {filteredOrders.length} registros</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-6 relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
                {isLoading ? (
                  <RefreshCcw className="h-12 w-12 animate-spin text-primary opacity-20" />
                ) : cloudData?.concepts?.map((word, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedConcept(word)}
                    className={`transition-all duration-300 transform hover:scale-110 active:scale-95 text-center ${cloudData.concepts && cloudData.concepts.length > 0 ? (word.weight > 85 ? 'text-5xl md:text-6xl font-black' : word.weight > 70 ? 'text-4xl md:text-5xl font-extrabold' : word.weight > 50 ? 'text-2xl md:text-3xl font-bold' : word.weight > 30 ? 'text-lg md:text-xl font-semibold' : 'text-sm font-medium') : 'text-sm'} ${word.sentiment === 'Crítico' ? 'text-rose-600' : word.sentiment === 'Riesgo' ? 'text-amber-600' : 'text-primary'} ${selectedConcept?.text === word.text ? 'scale-110 ring-4 ring-primary/10 rounded-xl px-4 py-2 bg-primary/5 z-10' : ''}`}
                  >
                    {word.text}
                  </button>
                ))}
              </CardContent>
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
            </aside>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
