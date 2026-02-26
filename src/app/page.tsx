
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  BrainCircuit, 
  Database, 
  RefreshCcw, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Target,
  Layers,
  Search,
  Zap,
  ShieldCheck,
  Building2,
  CalendarDays,
  Activity,
  ChevronDown,
  LayoutGrid,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flag,
  FileText,
  Copy,
  X,
  ShieldAlert,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
  Cell,
  AreaChart,
  Area,
  LabelList
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, limit, getCountFromServer } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { analyzeStrategicTrends, TrendAnalysisOutput } from '@/ai/flows/trend-analysis-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';

const YEARS = [2022, 2023, 2024, 2025, 2026];
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const YEAR_COLORS: Record<number, string> = {
  2022: '#94a3b8',
  2023: '#64748b',
  2024: '#2962FF',
  2025: '#1E3A8A', 
  2026: '#6200EA'
};

const CORE_COLOR = '#1E3A8A'; 
const NEUTRAL_COLOR = '#E2E8F0'; 

// Motor de Normalización de Causa Raíz (Lógica Walmart 80/20) - Estándar Institucional
const normalizeCauseString = (cause: string): string => {
  if (!cause) return "Errores / Omisiones";
  const c = cause.toLowerCase().trim();
  
  if (c.includes("alcance") && c.includes("plan")) return "Alta de alcance en plan";
  if (c.includes("error") || c.includes("omision") || c.includes("omisión") || c.includes("humano") || c.includes("diseño") || c.includes("ingeniería")) return "Errores / Omisiones";
  if (c.includes("cumplimiento") || c.includes("autoridad") || c.includes("regulatorio") || c.includes("normativa")) return "Solicitud de Cumplimiento / Autoridad";
  if (c.includes("prototipo") || c.includes("actualización") || c.includes("ci ")) return "Actualización de Prototipo";
  if (c.includes("estratégica") || c.includes("scope") || c.includes("iniciativa") || c.includes("pickup") || c.includes("self")) return "Iniciativas estratégicas y adiciones a scope fuera de Prototipo";
  if (c.includes("alcance conocido") || c.includes("concursos") || c.includes("contratista")) return "Alcance conocido no asignado por Concursos";
  if (c.includes("siniestro") || c.includes("siniestros") || c.includes("inundación") || c.includes("desastre")) return "Imprevistos por siniestro";
  if (c.includes("hallazgo") || c.includes("sitio") || c.includes("subsuelo") || c.includes("terreno") || c.includes("construcción") || c.includes("roca") || c.includes("freático")) return "Hallazgos / imprevistos en sitio durante proceso de Construcción";
  
  return "Errores / Omisiones";
};

const CustomTooltip = ({ active, payload, label, currencyFormatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm p-4 border-none shadow-2xl rounded-2xl ring-1 ring-black/5 min-w-[240px]">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b pb-2">{label}</p>
        <div className="space-y-3">
          {payload.map((entry: any, i: number) => {
            const isCumulative = entry.dataKey === 'cumulativePercentage' || entry.name === 'Acumulado';
            return (
              <div key={i} className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color || entry.fill }} />
                  <span className="text-[10px] font-bold text-slate-600 uppercase">
                    {isCumulative ? 'Impacto Acumulado' : 'Monto de la Causa'}
                  </span>
                </div>
                <span className={`text-xs font-black ${isCumulative ? 'text-orange-600' : 'text-slate-900'}`}>
                  {isCumulative ? `${entry.value.toFixed(1)}%` : currencyFormatter(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center gap-2">
          <Info className="h-3 w-3 text-slate-300" />
          <p className="text-[8px] text-slate-400 font-medium uppercase italic leading-tight">
            Análisis basado en el Principio de Pareto (80/20)
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function VpDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [selectedYears, setSelectedYears] = useState<number[]>([2024, 2025]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [actionPlan, setActionPlan] = useState<TrendAnalysisOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);
  
  const [filters, setFilters] = useState({
    month: 'all',
    discipline: 'all',
    storeFormat: 'all',
    search: ''
  });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!db || !user?.uid) return;
    const fetchTotal = async () => {
      try {
        const snapshot = await getCountFromServer(collection(db, 'orders'));
        setTotalInDb(snapshot.data().count);
      } catch (e) {
        console.warn("Failed to fetch total count:", e);
      }
    };
    fetchTotal();
  }, [db, user?.uid]);

  const ordersQuery = useMemoFirebase(() => {
    // CRITICAL: Solo iniciar suscripción cuando el usuario esté autenticado para evitar race condition
    if (!db || !user?.uid) return null;
    return query(collection(db, 'orders'), limit(20000)); 
  }, [db, user?.uid]);

  const { data: rawOrders, isLoading } = useCollection(ordersQuery);

  const getOrderDate = (o: any) => o.fechaSolicitud || o.requestDate || o.processedAt || "";
  
  const getOrderYear = (o: any): number | null => {
    const dStr = getOrderDate(o);
    try {
      const d = new Date(dStr);
      if (!isNaN(d.getFullYear())) return d.getFullYear();
      const match = String(dStr).match(/\b(202[2-6])\b/);
      return match ? parseInt(match[1]) : null;
    } catch { return null; }
  };

  const yearStats = useMemo(() => {
    const stats: Record<string, number> = { total: 0 };
    YEARS.forEach(y => stats[y] = 0);
    rawOrders?.forEach(o => {
      const yr = getOrderYear(o);
      stats.total += 1;
      if (yr && stats[yr] !== undefined) stats[yr] += 1;
    });
    return stats;
  }, [rawOrders]);

  const uniqueFormats = useMemo(() => {
    const formats = new Set<string>();
    rawOrders?.forEach(o => { if (o.format) formats.add(o.format); });
    return Array.from(formats).sort();
  }, [rawOrders]);

  const filteredData = useMemo(() => {
    if (!rawOrders) return [];
    return rawOrders.filter(o => {
      const yr = getOrderYear(o);
      const dateStr = getOrderDate(o);
      const date = new Date(dateStr);
      const monthIdx = date.getMonth();

      const yearMatch = selectedYears.includes(yr!);
      const monthMatch = filters.month === 'all' || monthIdx === parseInt(filters.month);
      const discMatch = filters.discipline === 'all' || (o.disciplina_normalizada || o.semanticAnalysis?.disciplina_normalizada) === filters.discipline;
      const formatMatch = filters.storeFormat === 'all' || o.format === filters.storeFormat;
      const searchMatch = !filters.search || 
        String(o.projectId).toLowerCase().includes(filters.search.toLowerCase()) || 
        String(o.projectName).toLowerCase().includes(filters.search.toLowerCase());

      return yearMatch && monthMatch && discMatch && formatMatch && searchMatch;
    });
  }, [rawOrders, selectedYears, filters]);

  const metrics = useMemo(() => {
    const totalImpact = filteredData.reduce((acc, o) => acc + (o.impactoNeto || 0), 0);
    
    const impactsByYear: Record<number, number> = {};
    selectedYears.forEach(y => impactsByYear[y] = 0);
    filteredData.forEach(o => {
      const y = getOrderYear(o);
      if (y && impactsByYear[y] !== undefined) impactsByYear[y] += (o.impactoNeto || 0);
    });

    let variation = 0;
    if (selectedYears.length === 2) {
      const sorted = [...selectedYears].sort((a, b) => a - b);
      const v1 = impactsByYear[sorted[0]] || 0;
      const v2 = impactsByYear[sorted[1]] || 0;
      variation = v1 > 0 ? ((v2 - v1) / v1) * 100 : 0;
    }

    const causesMap: Record<string, { impact: number, count: number }> = {};
    filteredData.forEach(o => {
      const rawCause = o.causa_raiz_normalizada || o.causaRaiz || 'Errores / Omisiones';
      const cause = normalizeCauseString(rawCause);
      if (!causesMap[cause]) causesMap[cause] = { impact: 0, count: 0 };
      causesMap[cause].impact += (o.impactoNeto || 0);
      causesMap[cause].count += 1;
    });

    const sortedCauses = Object.entries(causesMap)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.impact - a.impact);

    let cumulative = 0;
    const paretoData = sortedCauses.map(c => {
      cumulative += c.impact;
      return {
        ...c,
        cumulativeImpact: cumulative,
        cumulativePercentage: totalImpact > 0 ? (cumulative / totalImpact) * 100 : 0
      };
    });

    const discMap: Record<string, number> = {};
    filteredData.forEach(o => {
      const d = o.disciplina_normalizada || 'Indefinida';
      discMap[d] = (discMap[d] || 0) + (o.impactoNeto || 0);
    });
    const discData = Object.entries(discMap)
      .map(([name, impact]) => ({ name, impact }))
      .sort((a, b) => b.impact - a.impact);

    const vitalFew = paretoData.filter(p => p.cumulativePercentage <= 85);
    const concentrationRatio = totalImpact > 0 ? (vitalFew.reduce((a, b) => a + b.impact, 0) / totalImpact) * 100 : 0;

    return { totalImpact, impactsByYear, variation, paretoData, discData, vitalFew, concentrationRatio };
  }, [filteredData, selectedYears]);

  const trendData = useMemo(() => {
    return MONTHS.map((name, idx) => {
      const entry: any = { month: name };
      selectedYears.forEach(y => {
        const impact = rawOrders?.filter(o => getOrderYear(o) === y && new Date(getOrderDate(o)).getMonth() === idx)
          .reduce((acc, o) => acc + (o.impactoNeto || 0), 0) || 0;
        entry[`impact_${y}`] = impact;
      });
      return entry;
    });
  }, [rawOrders, selectedYears]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 
    }).format(val);
  };

  const handleToggleYear = (y: number | 'all') => {
    if (y === 'all') {
      const areAllSelected = selectedYears.length === YEARS.length;
      setSelectedYears(areAllSelected ? [new Date().getFullYear()] : [...YEARS]);
      return;
    }
    setSelectedYears(prev => 
      prev.includes(y) ? (prev.length > 1 ? prev.filter(year => year !== y) : prev) : [...prev, y].sort()
    );
  };

  const handleGenerateActionPlan = async () => {
    if (filteredData.length === 0) return;
    setIsGeneratingPlan(true);
    try {
      const result = await analyzeStrategicTrends({
        monthlyData: [], 
        years: selectedYears,
        totalImpact: metrics.totalImpact,
        rootCauseSummary: metrics.paretoData.slice(0, 10).map(p => ({
          cause: p.name,
          impact: p.impact,
          count: p.count,
          percentage: (p.impact / metrics.totalImpact) * 100
        })),
        paretoTop80: metrics.vitalFew.map(v => v.name)
      });
      setActionPlan(result);
      toast({ title: "IA Action Plan Generado", description: "Listo para revisión ejecutiva." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error IA", description: e.message });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleCopySummary = () => {
    if (!actionPlan) return;
    const text = `DIAGNÓSTICO EJECUTIVO: ${actionPlan.narrative}\n\nACCIONES PRIORITARIAS:\n${actionPlan.actionPlan.map(p => `- ${p.title}: ${p.steps[0]}`).join('\n')}\n\nAHORRO ESTIMADO: ${actionPlan.estimatedReduction}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado al portapapeles" });
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">VP Construction Analytics</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl border gap-1">
              <button 
                onClick={() => handleToggleYear('all')} 
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${selectedYears.length === YEARS.length ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}
              >
                TODO <span className="opacity-60">({totalInDb || rawOrders?.length || 0})</span>
              </button>
              {YEARS.map(y => (
                <button 
                  key={y} 
                  onClick={() => handleToggleYear(y)} 
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${selectedYears.includes(y) && selectedYears.length !== YEARS.length ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}
                >
                  {y} <span className="opacity-60">({yearStats[y] || 0})</span>
                </button>
              ))}
            </div>
            <Button 
              onClick={handleGenerateActionPlan} 
              disabled={isGeneratingPlan || filteredData.length === 0}
              className="bg-slate-900 hover:bg-slate-800 text-white gap-2 h-9 px-4 rounded-xl shadow-lg text-xs font-bold"
            >
              {isGeneratingPlan ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4 text-accent" />}
              IA Action Plan
            </Button>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <Card className="border-none shadow-sm bg-white p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Mes</label>
                <Select value={filters.month} onValueChange={(v) => setFilters({...filters, month: v})}>
                  <SelectTrigger className="h-8 bg-slate-50 border-none text-[10px] font-bold uppercase"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Enero - Diciembre</SelectItem>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Layers className="h-3 w-3" /> Disciplina</label>
                <Select value={filters.discipline} onValueChange={(v) => setFilters({...filters, discipline: v})}>
                  <SelectTrigger className="h-8 bg-slate-50 border-none text-[10px] font-bold uppercase"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las especialidades</SelectItem>
                    <SelectItem value="Eléctrica">Eléctrica</SelectItem>
                    <SelectItem value="Civil">Civil</SelectItem>
                    <SelectItem value="HVAC">HVAC</SelectItem>
                    <SelectItem value="Estructura Metálica">Estructura</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Building2 className="h-3 w-3" /> Formato de Tienda</label>
                <Select value={filters.storeFormat} onValueChange={(v) => setFilters({...filters, storeFormat: v})}>
                  <SelectTrigger className="h-8 bg-slate-50 border-none text-[10px] font-bold uppercase"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Formatos</SelectItem>
                    {uniqueFormats.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Search className="h-3 w-3" /> Filtrar Proyecto / PID</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
                  <Input 
                    placeholder="Folio o nombre..." 
                    className="h-8 pl-8 bg-slate-50 border-none text-[10px] font-medium"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary overflow-hidden">
              <CardContent className="pt-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Auditado Acumulado</p>
                <h2 className="text-2xl font-headline font-bold text-slate-800">{formatCurrency(metrics.totalImpact)}</h2>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="outline" className="text-[8px] bg-primary/5 text-primary border-primary/20 uppercase font-black">{filteredData.length} Órdenes</Badge>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">{selectedYears.length === YEARS.length ? 'UNIVERSO TOTAL' : selectedYears.join(' + ')}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md bg-slate-900 text-white overflow-hidden relative">
              <Zap className="absolute -bottom-2 -right-2 h-16 w-16 opacity-5 text-accent" />
              <CardContent className="pt-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Variación Interanual</p>
                <div className="flex items-center gap-3">
                  <h2 className={`text-2xl font-headline font-bold ${metrics.variation > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {metrics.variation > 0 ? '+' : ''}{Math.round(metrics.variation)}%
                  </h2>
                  {metrics.variation !== 0 && (
                    <div className={`p-1 rounded-full ${metrics.variation > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {metrics.variation > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                  )}
                </div>
                <p className="text-[8px] text-slate-500 mt-2 uppercase font-bold tracking-tight">Comparativa de Periodos Seleccionados</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-amber-500 overflow-hidden">
              <CardContent className="pt-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Concentración 80/20</p>
                <div className="flex items-end gap-2">
                  <h2 className="text-2xl font-headline font-bold text-slate-800">{Math.round(metrics.concentrationRatio)}%</h2>
                  <span className="text-[10px] text-slate-400 font-bold mb-1">del Gasto</span>
                </div>
                <Progress value={metrics.concentrationRatio} className="h-1 mt-3 bg-slate-100" />
              </CardContent>
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 overflow-hidden">
              <CardContent className="pt-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Driver Crítico Dominante</p>
                <h2 className="text-lg font-headline font-bold text-slate-800 truncate">{metrics.paretoData[0]?.name || "N/A"}</h2>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] font-black text-emerald-600">{formatCurrency(metrics.paretoData[0]?.impact || 0)}</span>
                  <Badge className="bg-emerald-50 text-emerald-700 text-[8px] border-none">TOP 1</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden rounded-3xl">
              <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Target className="h-4 w-4" /> Curva de Pareto: Concentración de Impacto
                  </CardTitle>
                  <CardDescription className="text-[9px] font-bold text-slate-400 uppercase mt-1">Identificación del Grupo Crítico para Mitigación Estratégica</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                   <Badge className="bg-primary text-white border-none text-[8px] font-black uppercase tracking-tight px-3 py-1">Estrategia 80/20</Badge>
                </div>
              </CardHeader>
              <CardContent className="h-[450px] pt-10 px-6">
                {metrics.paretoData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={metrics.paretoData.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 8, fontWeight: 'bold', fill: '#64748b' }} 
                        height={100} 
                        interval={0} 
                        angle={-35} 
                        textAnchor="end"
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${Math.round(v/1000000)}M`} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip currencyFormatter={formatCurrency} />} />
                      <Bar yAxisId="left" dataKey="impact" name="Monto" radius={[6, 6, 0, 0]} barSize={45}>
                        {metrics.paretoData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.cumulativePercentage <= 85 ? CORE_COLOR : NEUTRAL_COLOR} 
                          />
                        ))}
                        <LabelList 
                          dataKey="impact" 
                          position="top" 
                          content={(props: any) => {
                            const { x, y, width, value } = props;
                            return (
                              <text x={x + width / 2} y={y - 10} fill="#1E3A8A" textAnchor="middle" fontSize={8} fontWeight="900">
                                {formatCurrency(value)}
                              </text>
                            );
                          }} 
                        />
                      </Bar>
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="cumulativePercentage" 
                        name="Acumulado" 
                        stroke="#FF8F00" 
                        strokeWidth={4} 
                        dot={{ r: 5, fill: '#FF8F00', strokeWidth: 2, stroke: '#fff' }} 
                        activeDot={{ r: 7 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4">
                    <Database className="h-12 w-12 opacity-20" />
                    <p className="text-xs font-black uppercase tracking-widest">Sin datos normalizados disponibles</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-slate-50 border-t py-3 flex justify-between items-center text-[9px] font-black uppercase text-slate-400 px-6">
                <div className="flex gap-6">
                  <span className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-md shadow-sm" style={{ backgroundColor: CORE_COLOR }} /> 
                    <span style={{ color: CORE_COLOR }} className="font-black tracking-widest">NÚCLEO CRÍTICO 80/20</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-md shadow-sm" style={{ backgroundColor: NEUTRAL_COLOR }} /> 
                    <span>INCIDENCIAS MENORES</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Flag className="h-3 w-3 text-orange-500" />
                  <span className="text-slate-500">CORTE ESTRATÉGICO INSTITUCIONAL</span>
                </div>
              </CardFooter>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden h-full flex flex-col">
                <CardHeader className="bg-slate-50/50 border-b pb-4">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Desglose por Disciplina Técnico-Económico
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 pt-6 px-4">
                  {metrics.discData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.discData} layout="vertical" margin={{ left: 20, right: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          tick={{ fontSize: 8, fontWeight: 'bold', fill: '#64748b' }} 
                          width={100}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip currencyFormatter={formatCurrency} />} />
                        <Bar dataKey="impact" fill="#2962FF" radius={[0, 6, 6, 0]} barSize={24}>
                          <LabelList 
                            dataKey="impact" 
                            position="right" 
                            formatter={(v: any) => `${Math.round((v / (metrics.totalImpact || 1)) * 100)}%`}
                            style={{ fontSize: '9px', fontWeight: 'bold', fill: '#94a3b8' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-200 gap-2">
                      <Layers className="h-10 w-10 opacity-20" />
                      <p className="text-[9px] font-black uppercase tracking-widest">Sin registros clasificados</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-slate-50/50 border-t py-4 text-center">
                  <p className="text-[9px] text-slate-400 font-bold uppercase italic mx-auto">Impacto Semántico Normalizado</p>
                </CardFooter>
              </Card>
            </div>
          </div>

          <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Tendencia de Impacto Mensual Interanual
                </CardTitle>
                <CardDescription className="text-[9px] font-bold uppercase text-slate-400 mt-1">Comparativa directa de estacionalidad entre periodos seleccionados</CardDescription>
              </div>
              <div className="flex gap-4">
                {selectedYears.map(y => (
                  <div key={y} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ backgroundColor: YEAR_COLORS[y] }} />
                    <span className="text-[10px] font-black text-slate-600">{y}</span>
                  </div>
                ))}
              </div>
            </CardHeader>
            <CardContent className="h-[300px] pt-8 px-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    {selectedYears.map(y => (
                      <linearGradient key={`grad_${y}`} id={`color_${y}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={YEAR_COLORS[y]} stopOpacity={0.1}/>
                        <stop offset="95%" stopColor={YEAR_COLORS[y]} stopOpacity={0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `$${Math.round(v/1000)}k`} />
                  <Tooltip content={<CustomTooltip currencyFormatter={formatCurrency} />} />
                  <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                  {selectedYears.map(y => (
                    <Area 
                      key={y}
                      type="monotone" 
                      dataKey={`impact_${y}`} 
                      name={`Periodo ${y}`}
                      stroke={YEAR_COLORS[y]} 
                      fill={`url(#color_${y})`}
                      strokeWidth={4}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <div className="space-y-1">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" /> Muestra de Registros para el Periodo {selectedYears.length === YEARS.length ? 'TOTAL' : selectedYears.join(', ')}
                </CardTitle>
                <CardDescription className="text-[9px] font-medium uppercase text-slate-400">Exhibiendo hasta 100 registros de la muestra filtrada</CardDescription>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 text-[9px] font-black border-none px-4 py-1.5 uppercase flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" /> Sincronización Certificada
              </Badge>
            </CardHeader>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader className="bg-slate-50/30 sticky top-0 z-10 backdrop-blur-md">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase py-4">PID / Proyecto</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Formato</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Disciplina</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Causa Raíz IA</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right pr-8">Impacto Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.slice(0, 100).map((o, idx) => (
                    <TableRow key={o.id || idx} className="hover:bg-slate-50/50 border-slate-100 group transition-colors">
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-primary text-xs tracking-tight">{o.projectId}</span>
                          <span className="text-[9px] text-slate-400 uppercase font-bold truncate max-w-[250px]">{o.projectName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[8px] border-none bg-slate-100 font-black uppercase text-slate-500">{o.format || "N/A"}</Badge>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-slate-700 uppercase">{o.disciplina_normalizada || "—"}</TableCell>
                      <TableCell className="text-[10px] font-bold text-slate-600 uppercase">{normalizeCauseString(o.causa_raiz_normalizada || o.causaRaiz)}</TableCell>
                      <TableCell className="text-right font-black text-slate-900 text-xs pr-8">{formatCurrency(o.impactoNeto || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <CardFooter className="bg-slate-50/50 border-t py-3 flex justify-center">
               <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2">
                 <AlertCircle className="h-3 w-3" /> Basado en el universo completo de la base de datos de Walmart International
               </p>
            </CardFooter>
          </Card>
        </main>

        <Dialog open={!!actionPlan} onOpenChange={(open) => !open && setActionPlan(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-[2.5rem] border-none shadow-2xl bg-slate-50 outline-none">
            <header className="bg-slate-900 text-white p-8 flex justify-between items-center sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="bg-accent p-3 rounded-2xl">
                  <BrainCircuit className="h-8 w-8 text-slate-900" />
                </div>
                <div>
                  <Badge className="bg-accent text-slate-900 border-none text-[9px] font-black uppercase mb-1">Audit Intelligence 360</Badge>
                  <DialogTitle className="text-2xl font-headline font-bold uppercase tracking-tight">IA Strategic Action Plan</DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                    <CalendarDays className="h-3 w-3" /> Generado: {new Date().toLocaleDateString()} • {selectedYears.join(', ')}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 h-10 w-10 p-0 rounded-xl" onClick={() => setActionPlan(null)}>
                  <X className="h-6 w-6" />
                </Button>
              </div>
            </header>

            <div className="p-10 space-y-10">
              <section className="grid md:grid-cols-3 gap-8">
                <Card className="md:col-span-2 border-none bg-white p-8 rounded-3xl shadow-sm space-y-6">
                  <div className="flex items-center gap-3 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em]">Diagnóstico Ejecutivo Forense</h4>
                  </div>
                  <p className="text-lg font-medium text-slate-800 leading-relaxed italic border-l-4 border-primary pl-8 py-2">
                    "{actionPlan?.narrative}"
                  </p>
                  <div className="grid md:grid-cols-2 gap-6 pt-4">
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-emerald-500" /> Salud de Gestión
                      </p>
                      <Badge className={`h-8 px-4 rounded-xl text-[10px] font-black uppercase ${actionPlan?.sentiment === 'Optimista' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        ESTADO: {actionPlan?.sentiment}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="h-3 w-3 text-accent" /> Ahorro Proyectado
                      </p>
                      <p className="text-2xl font-headline font-bold text-emerald-600">{actionPlan?.estimatedReduction}</p>
                    </div>
                  </div>
                </Card>

                <Card className="border-none bg-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between">
                  <ShieldAlert className="absolute -bottom-4 -right-4 h-32 w-32 opacity-5 text-accent" />
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-accent uppercase tracking-widest">Análisis 80/20</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">Concentración del impacto en el driver principal detectado durante el periodo analizado.</p>
                    <div className="pt-6">
                      <p className="text-[10px] font-black text-white/60 uppercase">Driver Crítico Dominante</p>
                      <p className="text-sm font-bold text-white mt-1 leading-tight">{metrics.paretoData[0]?.name}</p>
                    </div>
                  </div>
                  <div className="pt-8 flex justify-between items-end border-t border-white/10 mt-8">
                    <div>
                      <p className="text-[8px] font-black text-slate-500 uppercase">Concentración</p>
                      <p className="text-3xl font-headline font-bold text-accent">{Math.round(metrics.concentrationRatio)}%</p>
                    </div>
                    <Badge className="bg-white/10 text-white border-none uppercase text-[8px]">Núcleo Crítico</Badge>
                  </div>
                </Card>
              </section>

              <section className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" /> Principales Drivers Detectados
                  </h4>
                  <div className="space-y-3">
                    {actionPlan?.keyDrivers.map((driver, i) => (
                      <div key={i} className="bg-white p-4 rounded-2xl border-2 border-slate-100 flex gap-4 items-center group hover:border-primary/20 transition-all">
                        <div className="h-8 w-8 bg-slate-50 rounded-lg flex items-center justify-center text-[10px] font-black text-primary">0{i+1}</div>
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">{driver}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-500" /> Proyección Estratégica
                  </h4>
                  <Card className="bg-white p-6 rounded-[2rem] border-2 border-dashed border-slate-200">
                    <p className="text-xs text-slate-600 leading-relaxed italic">{actionPlan?.projections}</p>
                  </Card>
                </div>
              </section>

              <Separator className="opacity-50" />

              <section className="space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Hoja de Ruta Priorizada para Mitigación
                  </h4>
                  <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-400">Total: {actionPlan?.actionPlan.length} Acciones</Badge>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  {actionPlan?.actionPlan.map((plan, i) => (
                    <Card key={i} className="bg-white border-2 border-slate-100 p-6 rounded-3xl shadow-sm hover:border-primary/20 transition-all group relative overflow-hidden flex flex-col">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                      <div className="flex items-start justify-between mb-4">
                        <h5 className="text-xs font-black text-slate-900 uppercase leading-tight group-hover:text-primary transition-colors">{plan.title}</h5>
                        <ShieldCheck className="h-5 w-5 text-primary opacity-20" />
                      </div>
                      <ul className="space-y-3 mb-8 flex-1">
                        {plan.steps.map((step, si) => (
                          <li key={si} className="text-[11px] text-slate-600 flex gap-3 leading-relaxed font-medium">
                            <span className="h-4 w-4 bg-slate-100 text-slate-900 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0">{si + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ul>
                      <div className="pt-4 border-t border-dashed border-slate-100 flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Impacto</span>
                        <Badge className="bg-emerald-50 text-emerald-700 border-none text-[10px] font-black">
                          {plan.expectedImpact}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            </div>

            <footer className="p-8 bg-white border-t sticky bottom-0 z-20 flex justify-between items-center rounded-b-[2.5rem]">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
                <AlertCircle className="h-4 w-4 text-amber-500" /> Basado en el universo de registros auditados en el periodo.
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="rounded-xl h-11 px-6 uppercase text-[10px] font-black gap-2" onClick={handleCopySummary}>
                  <Copy className="h-4 w-4" /> Copiar Resumen
                </Button>
                <Button className="rounded-xl h-11 px-8 bg-primary hover:bg-primary/90 text-white uppercase text-[10px] font-black shadow-xl shadow-primary/20 gap-2">
                  <FileText className="h-4 w-4" /> Exportar Reporte PDF
                </Button>
              </div>
            </footer>
          </DialogContent>
        </Dialog>

      </SidebarInset>
    </div>
  );
}
