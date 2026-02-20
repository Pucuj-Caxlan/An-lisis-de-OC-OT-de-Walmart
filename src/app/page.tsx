
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  ShieldAlert,
  ShieldCheck,
  Building2,
  CalendarDays,
  FileDown,
  Activity,
  ChevronDown,
  LayoutGrid,
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
  Area
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { analyzeStrategicTrends, TrendAnalysisOutput } from '@/ai/flows/trend-analysis-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

const YEARS = [2022, 2023, 2024, 2025, 2026];
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function VpDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [actionPlan, setActionPlan] = useState<TrendAnalysisOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const [filters, setFilters] = useState({
    month: 'all',
    discipline: 'all',
    format: 'all',
    executionType: 'all',
    search: ''
  });

  useEffect(() => { setMounted(true); }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), limit(1000));
  }, [db]);

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

  const filteredData = useMemo(() => {
    if (!rawOrders) return [];
    return rawOrders.filter(o => {
      const yr = getOrderYear(o);
      const date = new Date(getOrderDate(o));
      const monthIdx = date.getMonth();

      const yearMatch = selectedYear === 'all' || yr === selectedYear;
      const monthMatch = filters.month === 'all' || monthIdx === parseInt(filters.month);
      const discMatch = filters.discipline === 'all' || (o.disciplina_normalizada || o.semanticAnalysis?.disciplina_normalizada) === filters.discipline;
      const formatMatch = filters.format === 'all' || o.format === filters.format || o.type === filters.format;
      const execMatch = filters.executionType === 'all' || o.executionType === filters.executionType;
      const searchMatch = !filters.search || 
        String(o.projectId).toLowerCase().includes(filters.search.toLowerCase()) || 
        String(o.projectName).toLowerCase().includes(filters.search.toLowerCase());

      return yearMatch && monthMatch && discMatch && formatMatch && execMatch && searchMatch;
    });
  }, [rawOrders, selectedYear, filters]);

  const metrics = useMemo(() => {
    const totalImpact = filteredData.reduce((acc, o) => acc + (o.impactoNeto || 0), 0);
    const count = filteredData.length;

    // Pareto por Causa Raíz
    const causesMap: Record<string, { impact: number, count: number }> = {};
    filteredData.forEach(o => {
      const cause = o.causa_raiz_normalizada || o.causaRaiz || 'Sin definir';
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

    // Análisis por Disciplina
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

    return { totalImpact, count, paretoData, discData, vitalFew, concentrationRatio };
  }, [filteredData]);

  const handleGenerateActionPlan = async () => {
    if (filteredData.length === 0) return;
    setIsGeneratingPlan(true);
    try {
      const result = await analyzeStrategicTrends({
        monthlyData: [], // Agregado simplificado si es necesario
        years: selectedYear === 'all' ? YEARS : [Number(selectedYear)],
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
      toast({ title: "Action Plan Generado", description: "Estrategia 80/20 disponible." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error IA", description: e.message });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 
    }).format(val);
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
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">VP Construction Intelligence</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl border gap-1">
              <button 
                onClick={() => setSelectedYear('all')} 
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${selectedYear === 'all' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}
              >
                TODO
              </button>
              {YEARS.map(y => (
                <button 
                  key={y} 
                  onClick={() => setSelectedYear(y)} 
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${selectedYear === y ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}
                >
                  {y}
                </button>
              ))}
            </div>
            <Button 
              onClick={handleGenerateActionPlan} 
              disabled={isGeneratingPlan || filteredData.length === 0}
              className="bg-primary hover:bg-primary/90 gap-2 h-9 px-4 rounded-xl shadow-lg shadow-primary/20 text-xs font-bold"
            >
              {isGeneratingPlan ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-accent fill-accent" />}
              {actionPlan ? "Actualizar Plan" : "Generar IA Action Plan"}
            </Button>
          </div>
        </header>

        <main className="p-6 space-y-6">
          {/* Filtros Enterprise */}
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
                    <SelectItem value="all">Todas las Especialidades</SelectItem>
                    <SelectItem value="Eléctrica">Eléctrica</SelectItem>
                    <SelectItem value="Civil">Civil</SelectItem>
                    <SelectItem value="Estructura Metálica">Estructura</SelectItem>
                    <SelectItem value="HVAC">HVAC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><LayoutGrid className="h-3 w-3" /> Formato / Ejecución</label>
                <div className="flex gap-2">
                  <Select value={filters.format} onValueChange={(v) => setFilters({...filters, format: v})}>
                    <SelectTrigger className="h-8 bg-slate-50 border-none text-[10px] font-bold uppercase flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">OC/OT</SelectItem>
                      <SelectItem value="OC">OC</SelectItem>
                      <SelectItem value="OT">OT</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filters.executionType} onValueChange={(v) => setFilters({...filters, executionType: v})}>
                    <SelectTrigger className="h-8 bg-slate-50 border-none text-[10px] font-bold uppercase flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tipo</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="URGENTE">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Search className="h-3 w-3" /> Buscar Proyecto / PID</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-slate-400" />
                  <Input 
                    placeholder="Escriba aquí para filtrar registros..." 
                    className="h-8 pl-8 bg-slate-50 border-none text-[10px] font-medium"
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* KPIs Ejecutivos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary overflow-hidden">
              <CardContent className="pt-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Auditado</p>
                <h2 className="text-2xl font-headline font-bold text-slate-800">{formatCurrency(metrics.totalImpact)}</h2>
                <Badge variant="outline" className="mt-2 text-[8px] bg-primary/5 text-primary border-primary/20 uppercase font-black">{metrics.count} Órdenes Activas</Badge>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md bg-slate-900 text-white overflow-hidden relative">
              <Zap className="absolute -bottom-2 -right-2 h-16 w-16 opacity-5 text-accent" />
              <CardContent className="pt-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Concentración 80/20</p>
                <div className="flex items-end gap-2">
                  <h2 className="text-2xl font-headline font-bold text-accent">{Math.round(metrics.concentrationRatio)}%</h2>
                  <span className="text-[10px] text-slate-500 font-bold mb-1">del Gasto</span>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[8px] font-black uppercase">
                    <span>Índice de Riesgo</span>
                    <span className={metrics.concentrationRatio > 70 ? "text-rose-400" : "text-emerald-400"}>{metrics.concentrationRatio > 70 ? "CRÍTICO" : "CONTROLADO"}</span>
                  </div>
                  <Progress value={metrics.concentrationRatio} className="h-1 bg-white/10" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 overflow-hidden">
              <CardContent className="pt-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Driver Dominante</p>
                <h2 className="text-lg font-headline font-bold text-slate-800 truncate">{metrics.paretoData[0]?.name || "N/A"}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black text-emerald-600">{formatCurrency(metrics.paretoData[0]?.impact || 0)}</span>
                  <Badge className="bg-emerald-50 text-emerald-700 text-[8px] border-none">TOP CAUSA</Badge>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-amber-500 overflow-hidden">
              <CardContent className="pt-6">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Especialidad Crítica</p>
                <h2 className="text-lg font-headline font-bold text-slate-800 truncate">{metrics.discData[0]?.name || "N/A"}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black text-amber-600">{formatCurrency(metrics.discData[0]?.impact || 0)}</span>
                  <Badge className="bg-amber-50 text-amber-700 text-[8px] border-none">DISCIPLINA TOP</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfica de Pareto */}
            <Card className="lg:col-span-2 border-none shadow-lg bg-white overflow-hidden rounded-2xl">
              <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
                <div>
                  <CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Curva de Pareto: Causa Raíz vs Impacto Acumulado
                  </CardTitle>
                  <CardDescription className="text-[10px] font-medium uppercase mt-1">Identificación del Grupo Crítico (Estrategia 80/20)</CardDescription>
                </div>
                <Badge variant="outline" className="text-[8px] font-black border-primary/20 text-primary">SINCRO TOTAL</Badge>
              </CardHeader>
              <CardContent className="h-[450px] pt-10">
                {metrics.paretoData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={metrics.paretoData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 8, fontWeight: 'bold' }} 
                        height={80} 
                        interval={0} 
                        angle={-25} 
                        textAnchor="end"
                      />
                      <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${Math.round(v/1000000)}M`} />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9 }} />
                      <Tooltip 
                        formatter={(value: number, name: string) => [name === 'impact' ? formatCurrency(value) : `${value.toFixed(1)}%`, name === 'impact' ? 'Impacto' : 'Acumulado %']}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      />
                      <Bar yAxisId="left" dataKey="impact" radius={[4, 4, 0, 0]}>
                        {metrics.paretoData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.cumulativePercentage <= 85 ? '#2962FF' : '#cbd5e1'} />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" stroke="#FF8F00" strokeWidth={3} dot={{ r: 4, fill: '#FF8F00', strokeWidth: 2, stroke: '#fff' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4">
                    <Database className="h-12 w-12 opacity-20" />
                    <p className="text-xs font-black uppercase tracking-widest">Sin datos para el periodo seleccionado</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-slate-50 border-t py-3 flex justify-between items-center text-[9px] font-black uppercase text-slate-400">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary" /> Grupo Crítico (80%)</span>
                  <span className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-slate-300" /> Otros (20%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3 w-3 text-emerald-500" /> Modelo Pareto Activo
                </div>
              </CardFooter>
            </Card>

            {/* Panel de IA Action Plan o Diagnóstico */}
            <div className="space-y-6">
              {actionPlan ? (
                <Card className="border-none shadow-xl bg-slate-900 text-white rounded-3xl overflow-hidden animate-in fade-in slide-in-from-right-5 duration-700">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className="bg-accent text-slate-900 border-none text-[8px] font-black uppercase">IA Strategic Plan</Badge>
                      <span className={`text-[10px] font-black uppercase ${actionPlan.sentiment === 'Optimista' ? 'text-emerald-400' : 'text-rose-400'}`}>{actionPlan.sentiment}</span>
                    </div>
                    <CardTitle className="text-xl font-headline font-bold uppercase tracking-tight mt-4">Diagnóstico 80/20</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-xs font-medium text-slate-300 leading-relaxed italic">"{actionPlan.narrative}"</p>
                    </div>
                    
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Target className="h-3 w-3 text-accent" /> Mitigación Prioritaria</p>
                      <div className="space-y-2">
                        {actionPlan.actionPlan.slice(0, 3).map((plan, i) => (
                          <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 group hover:bg-white/10 transition-all cursor-default">
                            <p className="text-[10px] font-black text-accent uppercase leading-none mb-1.5">{plan.title}</p>
                            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{plan.steps[0]}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                      <div className="space-y-0.5">
                        <p className="text-[8px] font-black text-slate-500 uppercase">Ahorro Proyectado</p>
                        <p className="text-lg font-headline font-bold text-emerald-400">{actionPlan.estimatedReduction}</p>
                      </div>
                      <Button variant="ghost" className="text-xs text-slate-400 hover:text-white" onClick={() => setActionPlan(null)}>Cerrar</Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden h-full">
                  <CardHeader className="bg-slate-50/50 border-b pb-4">
                    <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Desglose por Disciplina
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 h-[400px]">
                    {metrics.discData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metrics.discData} layout="vertical" margin={{ left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            tick={{ fontSize: 8, fontWeight: 'bold' }} 
                            width={80}
                          />
                          <Tooltip 
                            formatter={(v: number) => formatCurrency(v)}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          />
                          <Bar dataKey="impact" fill="#2962FF" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-200 gap-2">
                        <Layers className="h-10 w-10 opacity-20" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Sin registros clasificados</p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="bg-slate-50 border-t py-4 text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase italic mx-auto">Click en una barra para drill-down (Próximamente)</p>
                  </CardFooter>
                </Card>
              )}
            </div>
          </div>

          {/* Sección de Registros del Lote Actual */}
          <Card className="border-none shadow-md bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Registros en Segmento Actual</CardTitle>
                <CardDescription className="text-[9px] font-medium uppercase mt-1">Muestra de {filteredData.length} registros que alimentan este análisis</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-emerald-50 text-emerald-700 text-[8px] font-black border-none px-3 py-1 uppercase">Filtro Sincronizado</Badge>
              </div>
            </CardHeader>
            <ScrollArea className="h-60">
              <Table>
                <TableHeader className="bg-slate-50/30 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[9px] font-black uppercase">PID / Proyecto</TableHead>
                    <TableHead className="text-[9px] font-black uppercase">Disciplina</TableHead>
                    <TableHead className="text-[9px] font-black uppercase">Causa Raíz</TableHead>
                    <TableHead className="text-[9px] font-black uppercase text-right">Impacto Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.slice(0, 50).map((o, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/50 border-slate-100 group transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-primary text-xs">{o.projectId}</span>
                          <span className="text-[9px] text-slate-400 uppercase truncate max-w-[200px]">{o.projectName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-slate-600">{o.disciplina_normalizada || "—"}</TableCell>
                      <TableCell className="text-[10px] font-bold text-slate-600">{o.causa_raiz_normalizada || o.causaRaiz}</TableCell>
                      <TableCell className="text-right font-black text-slate-800 text-xs">{formatCurrency(o.impactoNeto || 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <CardFooter className="bg-slate-50/50 border-t py-2 flex justify-center">
               <p className="text-[8px] font-bold text-slate-400 uppercase">Mostrando los primeros 50 registros del segmento filtrado</p>
            </CardFooter>
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
