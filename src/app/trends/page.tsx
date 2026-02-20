
"use client"

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  BarChart3, 
  BrainCircuit, 
  Target,
  AlertCircle,
  Loader2,
  FileDown,
  Zap,
  LayoutList,
  History,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  CalendarDays,
  Filter,
  Search,
  ChevronDown,
  Activity
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { analyzeStrategicTrends, TrendAnalysisOutput } from '@/ai/flows/trend-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const YEAR_COLORS = ['#2962FF', '#FF8F00', '#00C853', '#D50000', '#6200EA', '#00B8D4', '#AA00FF'];

export default function TrendsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiInsight, setAiInsight] = useState<TrendAnalysisOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Filtros Avanzados
  const [filters, setFilters] = useState({
    discipline: 'all',
    format: 'all',
    executionType: 'all',
    search: ''
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const getOrderDate = (o: any) => {
    return o.fechaSolicitud || o.requestDate || o.header?.requestDate || o.projectInfo?.requestDate || o.processedAt;
  };

  const getOrderYear = (o: any): number | null => {
    const dateStr = getOrderDate(o);
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getFullYear())) return date.getFullYear();
      const yearMatch = String(dateStr).match(/\b(202[2-6])\b/);
      if (yearMatch) return parseInt(yearMatch[1]);
      return null;
    } catch { return null; }
  };

  const availableYears = useMemo(() => {
    if (!orders) return [];
    const years = new Set<number>();
    orders.forEach(o => {
      const yr = getOrderYear(o);
      if (yr && yr >= 2020 && yr <= 2030) years.add(yr);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      const yr = getOrderYear(o);
      const date = new Date(getOrderDate(o));
      const monthIdx = date.getMonth();

      const yearMatch = selectedYears.includes(yr!);
      const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(monthIdx);
      const disciplineMatch = filters.discipline === 'all' || o.disciplina_normalizada === filters.discipline;
      const formatMatch = filters.format === 'all' || o.format === filters.format || o.type === filters.format;
      const executionMatch = filters.executionType === 'all' || o.executionType === filters.executionType;
      const searchMatch = !filters.search || 
        String(o.projectId).toLowerCase().includes(filters.search.toLowerCase()) || 
        String(o.projectName).toLowerCase().includes(filters.search.toLowerCase());

      return yearMatch && monthMatch && disciplineMatch && formatMatch && executionMatch && searchMatch;
    });
  }, [orders, selectedYears, selectedMonths, filters]);

  const trendData = useMemo(() => {
    const monthly = MONTH_NAMES.map((name, i) => {
      const entry: any = { month: name };
      selectedYears.forEach(yr => {
        entry[`impact_${yr}`] = 0;
        entry[`count_${yr}`] = 0;
      });
      return entry;
    });

    filteredOrders.forEach(o => {
      const yr = getOrderYear(o);
      const date = new Date(getOrderDate(o));
      const monthIdx = date.getMonth();
      if (monthIdx >= 0 && monthIdx < 12 && selectedYears.includes(yr!)) {
        const impactValue = o.impactoNeto || 0;
        monthly[monthIdx][`impact_${yr}`] += impactValue;
        monthly[monthIdx][`count_${yr}`] += 1;
      }
    });

    return monthly;
  }, [filteredOrders, selectedYears]);

  const paretoData = useMemo(() => {
    const causesMap = new Map<string, { impact: number, count: number }>();
    filteredOrders.forEach(o => {
      const cause = o.causa_raiz_normalizada || 'No definida';
      const impact = o.impactoNeto || 0;
      const existing = causesMap.get(cause) || { impact: 0, count: 0 };
      causesMap.set(cause, { impact: existing.impact + impact, count: existing.count + 1 });
    });

    const totalImpact = Array.from(causesMap.values()).reduce((acc, curr) => acc + curr.impact, 0);
    const sorted = Array.from(causesMap.entries())
      .map(([cause, stats]) => ({
        cause,
        ...stats,
        percentage: totalImpact > 0 ? (stats.impact / totalImpact) * 100 : 0
      }))
      .sort((a, b) => b.impact - a.impact);

    let cumulative = 0;
    return sorted.map(item => {
      cumulative += item.percentage;
      return { ...item, cumulativePercentage: cumulative };
    });
  }, [filteredOrders]);

  const kpis = useMemo(() => {
    const totalImpact = filteredOrders.reduce((acc, o) => acc + (o.impactoNeto || 0), 0);
    const totalOrders = filteredOrders.length;
    const avgTicket = totalOrders > 0 ? totalImpact / totalOrders : 0;
    
    // Top Causa (Estrategia 80/20)
    const topCause = paretoData[0]?.cause || 'N/A';
    const topImpactPct = paretoData[0]?.percentage?.toFixed(1) || '0';

    return { totalImpact, totalOrders, avgTicket, topCause, topImpactPct };
  }, [filteredOrders, paretoData]);

  const toggleYear = (year: number) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? (prev.length > 1 ? prev.filter(y => y !== year) : prev) 
        : [...prev, year].sort((a, b) => b - a)
    );
  };

  const toggleMonth = (idx: number) => {
    setSelectedMonths(prev => 
      prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const runAiTrendAnalysis = async () => {
    if (filteredOrders.length === 0) return;
    setIsAnalyzing(true);
    try {
      const aggregatedMonthlyData = MONTH_NAMES.map((name, idx) => {
        let impactSum = 0;
        let countSum = 0;
        selectedYears.forEach(yr => {
          impactSum += trendData[idx][`impact_${yr}`] || 0;
          countSum += trendData[idx][`count_${yr}`] || 0;
        });
        return { month: name, impact: impactSum, count: countSum };
      });

      const paretoTop80 = paretoData
        .filter(p => p.cumulativePercentage <= 85)
        .map(p => p.cause);

      const result = await analyzeStrategicTrends({
        monthlyData: aggregatedMonthlyData,
        years: selectedYears,
        totalImpact: kpis.totalImpact,
        rootCauseSummary: paretoData.slice(0, 10).map(p => ({
          cause: p.cause,
          impact: p.impact,
          count: p.count,
          percentage: Number(p.percentage.toFixed(1))
        })),
        paretoTop80
      });
      setAiInsight(result);
      toast({ title: "Plan de Acción Generado", description: "Estrategia 80/20 aplicada con éxito." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fallo en IA", description: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    toast({ title: "Preparando Reporte", description: "Generando informe ejecutivo de alta resolución..." });

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const element = reportRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Walmart_Strategic_Action_Plan_${new Date().getTime()}.pdf`);
      toast({ title: "Reporte Generado", description: "El informe corporativo está listo." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al exportar", description: "Fallo técnico en la generación del PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN', 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(val);
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight">Estrategia 80/20 & Acción Plan</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handleDownloadPdf} 
              disabled={isExporting || !aiInsight}
              className="gap-2 border-primary/20 text-primary h-10 shadow-sm"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Exportar Reporte
            </Button>
            <Button 
              onClick={runAiTrendAnalysis} 
              disabled={isAnalyzing || isLoading || filteredOrders.length === 0}
              className="bg-primary hover:bg-primary/90 gap-2 shadow-lg h-10 px-6 rounded-xl"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              Generar IA Action Plan
            </Button>
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-6">
          {/* Filtros Superiores */}
          <Card className="border-none shadow-sm bg-white p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase">Periodos Anuales</label>
                <div className="flex flex-wrap gap-1">
                  {availableYears.map(y => (
                    <button
                      key={y}
                      onClick={() => toggleYear(y)}
                      className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${selectedYears.includes(y) ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-500 hover:border-slate-300'}`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase">Meses</label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-between h-8 text-[10px] font-bold">
                      {selectedMonths.length === 0 ? "Todos los meses" : `${selectedMonths.length} seleccionados`}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto">
                    {MONTH_NAMES.map((name, i) => (
                      <DropdownMenuCheckboxItem
                        key={i}
                        checked={selectedMonths.includes(i)}
                        onCheckedChange={() => toggleMonth(i)}
                        className="text-[10px] font-bold uppercase"
                      >
                        {name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase">Disciplina</label>
                <Select value={filters.discipline} onValueChange={(v) => setFilters(f => ({...f, discipline: v}))}>
                  <SelectTrigger className="h-8 bg-slate-50 border-none text-[10px] font-bold uppercase"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Eléctrica">Eléctrica</SelectItem>
                    <SelectItem value="Civil">Civil</SelectItem>
                    <SelectItem value="HVAC">HVAC</SelectItem>
                    <SelectItem value="Estructura Metálica">Estructura</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase">Formato / Ejecución</label>
                <div className="flex gap-2">
                  <Select value={filters.format} onValueChange={(v) => setFilters(f => ({...f, format: v}))}>
                    <SelectTrigger className="h-8 bg-slate-50 border-none text-[10px] font-bold uppercase flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Formato</SelectItem>
                      <SelectItem value="OC">OC</SelectItem>
                      <SelectItem value="OT">OT</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filters.executionType} onValueChange={(v) => setFilters(f => ({...f, executionType: v}))}>
                    <SelectTrigger className="h-8 bg-slate-50 border-none text-[10px] font-bold uppercase flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Ejecución</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="URGENTE">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase">Buscar PID/Proyecto</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3 w-3 text-slate-400" />
                  <Input 
                    value={filters.search}
                    onChange={(e) => setFilters(f => ({...f, search: e.target.value}))}
                    className="h-8 pl-7 bg-slate-50 border-none text-[10px] font-medium"
                    placeholder="Escriba aquí..."
                  />
                </div>
              </div>
            </div>
          </Card>

          <div className="max-w-[1200px] mx-auto">
            <div 
              ref={reportRef} 
              data-report-container 
              className="space-y-8 bg-white p-10 rounded-3xl border shadow-xl overflow-hidden min-h-screen"
            >
              {/* Encabezado Corporativo */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-2">
                 <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-900 p-2 rounded-lg">
                        <Building2 className="text-white h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Walmart International</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real Estate & Construction Development • 80/20 Action Platform</p>
                      </div>
                    </div>
                    <h3 className="text-4xl font-headline font-bold text-slate-800 pt-4">Análisis Estratégico de Concentración de Impacto</h3>
                    <div className="flex items-center gap-6 pt-2">
                      <div className="flex items-center gap-2 text-slate-500">
                        <CalendarDays className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Periodo: {selectedYears.sort().join(' - ')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold uppercase">Enfoque: Estrategia de Pareto (80/20)</span>
                      </div>
                    </div>
                 </div>
                 <div className="text-right space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidencialidad</p>
                   <Badge variant="destructive" className="uppercase text-[9px] font-bold tracking-tight">Privado - Uso Interno</Badge>
                   <p className="text-[10px] text-slate-400 font-medium pt-4">Generado: {new Date().toLocaleDateString('es-MX')}</p>
                 </div>
              </div>

              {/* KPIs de Impacto */}
              <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Total Auditado</p>
                  <h3 className="text-xl font-headline font-bold text-slate-900">{formatCurrency(kpis.totalImpact)}</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">{kpis.totalOrders} Órdenes de Cambio</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Promedio Desviación</p>
                  <h3 className="text-xl font-headline font-bold text-slate-900">{formatCurrency(kpis.avgTicket)}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <Activity className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Costo Promedio / OC</span>
                  </div>
                </div>
                <div className="bg-primary text-white p-5 rounded-2xl shadow-lg shadow-primary/10">
                  <p className="text-[9px] font-black text-white/60 uppercase tracking-widest mb-1">Driver Dominante (Top Cause)</p>
                  <h3 className="text-xl font-headline font-bold truncate">{kpis.topCause}</h3>
                  <p className="text-[10px] font-bold mt-1 uppercase text-accent">Representa el {kpis.topImpactPct}% del Gasto</p>
                </div>
                <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ahorro Proyectado (IA)</p>
                  <h3 className="text-xl font-headline font-bold text-emerald-400">{aiInsight?.estimatedReduction || 'Calcuando...'}</h3>
                  <p className="text-[10px] font-bold mt-1 uppercase text-slate-500 italic">Impacto mitigado vía Action Plan</p>
                </div>
              </section>

              {aiInsight ? (
                <div className="space-y-8 animate-in fade-in duration-700">
                  <section className="grid lg:grid-cols-3 gap-8">
                    <Card className="lg:col-span-2 border-none bg-slate-50/50 shadow-none">
                      <CardHeader className="pb-2">
                        <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">01. Diagnóstico Estratégico 80/20</h4>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-base font-medium text-slate-800 leading-relaxed border-l-4 border-primary pl-6 py-2 italic">
                          "{aiInsight.narrative}"
                        </p>
                        <div className="grid md:grid-cols-2 gap-6 mt-6">
                          <div className="space-y-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <AlertCircle className="h-3 w-3 text-rose-500" /> Drivers Críticos Identificados
                            </p>
                            <div className="space-y-2">
                              {aiInsight.keyDrivers.map((d, i) => (
                                <div key={i} className="text-xs text-slate-700 flex gap-2 font-bold p-3 bg-white rounded-xl shadow-sm border border-slate-100">
                                  <span className="text-primary font-black">{i + 1}.</span> {d}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <TrendingUp className="h-3 w-3 text-emerald-500" /> Proyecciones & Riesgo Proyectado
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl italic">
                              {aiInsight.projections}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-6">
                      <Card className="bg-slate-900 text-white border-none shadow-xl rounded-3xl overflow-hidden relative">
                        <Zap className="absolute top-2 right-2 h-24 w-24 text-white/5" />
                        <CardContent className="pt-8">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Salud de Gestión</p>
                          <div className="flex items-center justify-between mb-6">
                            <h3 className={`text-4xl font-headline font-bold ${aiInsight.sentiment === 'Optimista' ? 'text-emerald-400' : aiInsight.sentiment === 'Estable' ? 'text-amber-400' : 'text-rose-400'}`}>
                              {aiInsight.sentiment}
                            </h3>
                            <Badge className="bg-white/10 text-white border-white/20">ESTADO ACTUAL</Badge>
                          </div>
                          <Separator className="bg-white/10 my-4" />
                          <div className="space-y-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recomendaciones Top</p>
                            {aiInsight.recommendations.slice(0, 3).map((r, i) => (
                              <div key={i} className="flex gap-3 text-[11px] font-medium opacity-90 leading-relaxed">
                                <ArrowRight className="h-3 w-3 shrink-0 text-accent mt-1" /> {r}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  {/* Pareto Chart Section */}
                  <section className="space-y-4 pt-4">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <Target className="h-4 w-4" /> 02. Análisis de Concentración (Pareto)
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={paretoData.slice(0, 8)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="cause" tick={{ fontSize: 8, fontWeight: 'bold' }} interval={0} height={60} angle={-15} textAnchor="end" />
                            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `$${Math.round(v/1000000)}M`} />
                            <Tooltip 
                              formatter={(value: number) => [formatCurrency(value), 'Impacto']}
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="impact" radius={[4, 4, 0, 0]}>
                              {paretoData.slice(0, 8).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#2962FF' : index < 3 ? '#FF8F00' : '#cbd5e1'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">El Grupo Crítico (80%)</h5>
                          <div className="space-y-3">
                            {paretoData.filter(p => p.cumulativePercentage <= 85).map((p, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-2 w-2 rounded-full bg-primary" />
                                  <span className="text-xs font-bold text-slate-700">{p.cause}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-black text-slate-900">{formatCurrency(p.impact)}</span>
                                  <p className="text-[9px] text-slate-400 font-bold">{p.percentage.toFixed(1)}% del total</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-6 pt-4 border-t border-dashed flex justify-between items-center text-primary">
                            <span className="text-[10px] font-black uppercase">Impacto Acumulado Grupo</span>
                            <span className="text-sm font-black">{Math.round(paretoData.filter(p => p.cumulativePercentage <= 85).reduce((acc, curr) => acc + curr.percentage, 0))}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Intelligent Action Plan */}
                  <section className="space-y-4">
                     <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">03. Hoja de Ruta Priorizada para Mitigación</h4>
                     <div className="grid md:grid-cols-3 gap-6">
                        {aiInsight.actionPlan.map((plan, i) => (
                          <div key={i} className="bg-white border-2 border-slate-100 p-6 rounded-3xl shadow-sm hover:border-primary/20 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                            <div className="flex items-start justify-between mb-4">
                              <h5 className="text-sm font-black text-slate-900 uppercase leading-tight group-hover:text-primary transition-colors">{plan.title}</h5>
                              <ShieldCheck className="h-5 w-5 text-primary opacity-20" />
                            </div>
                            <ul className="space-y-3 mb-6">
                              {plan.steps.map((step, si) => (
                                <li key={si} className="text-[11px] text-slate-600 flex gap-3 leading-relaxed font-medium">
                                  <span className="h-4 w-4 bg-slate-100 text-slate-900 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0">{si + 1}</span>
                                  {step}
                                </li>
                              ))}
                            </ul>
                            <div className="pt-4 border-t border-dashed border-slate-100 flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Impacto Esperado</span>
                              <Badge variant="outline" className="text-[10px] font-black text-emerald-700 bg-emerald-50 border-emerald-100">
                                {plan.expectedImpact}
                              </Badge>
                            </div>
                          </div>
                        ))}
                     </div>
                  </section>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-4">
                  <div className="relative">
                    <BrainCircuit className="h-16 w-16 opacity-10 text-primary" />
                    <Zap className="h-8 w-8 text-accent absolute -bottom-2 -right-2 animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-black uppercase tracking-widest text-slate-300">Auditoría Estratégica en Espera</p>
                    <p className="text-xs font-medium text-slate-400 max-w-xs">Ajuste los filtros y presione el botón de IA para generar el diagnóstico basado en Pareto.</p>
                  </div>
                </div>
              )}

              {/* Charts Section */}
              <section className="space-y-6 pt-12">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">04. Visualización Analítica Detallada</h4>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2 border-none shadow-none bg-white min-h-[400px]">
                    <CardHeader className="px-0">
                      <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" /> Comparativa de Impacto Mensual
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] px-0 pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `$${Math.round(v/1000)}k`} />
                          <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} formatter={(value) => formatCurrency(value as number)} />
                          <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                          {selectedYears.map((yr, i) => (
                            <Area key={yr} type="monotone" dataKey={`impact_${yr}`} name={`${yr}`} stroke={YEAR_COLORS[i % YEAR_COLORS.length]} fill={YEAR_COLORS[i % YEAR_COLORS.length]} fillOpacity={0.05} strokeWidth={3} isAnimationActive={false} />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 gap-4 h-fit">
                     <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Muestra de Análisis</p>
                        <h3 className="text-2xl font-headline font-bold text-slate-900">{filteredOrders.length} Registros</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <History className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Filtro Sincronizado</span>
                        </div>
                     </div>
                     <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Acumulado</p>
                        <h3 className="text-2xl font-headline font-bold text-primary">{formatCurrency(kpis.totalImpact)}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Total en Periodo</span>
                        </div>
                     </div>
                  </div>
                </div>
              </section>

              {/* Footer Corporativo */}
              <div className="pt-12 mt-12 border-t border-slate-100 flex items-center justify-between opacity-50">
                 <div className="flex items-center gap-3">
                    <div className="h-6 w-6 bg-slate-900 rounded flex items-center justify-center">
                      <BarChart3 className="text-white h-3 w-3" />
                    </div>
                    <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest">WAI Forensic Intelligence Platform • Walmart International</span>
                 </div>
                 <p className="text-[8px] text-slate-400 font-bold uppercase">Reporte Estratégico 80/20 • Folio Interno: {selectedYears.join('-')}-{Date.now().toString().slice(-6)}</p>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
