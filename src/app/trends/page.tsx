
"use client"

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  BrainCircuit, 
  Calendar,
  ArrowUpRight,
  Target,
  AlertCircle,
  Lightbulb,
  Loader2,
  FileDown,
  CheckCircle2,
  Zap,
  LayoutList,
  History,
  Layers
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { analyzeStrategicTrends, TrendAnalysisOutput } from '@/ai/flows/trend-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import html2canvas from 'html2canvas';
import jsPDF from 'jsPDF';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const YEAR_COLORS = ['#2962FF', '#FF8F00', '#00C853', '#D50000', '#6200EA', '#00B8D4', '#AA00FF'];

export default function TrendsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiInsight, setAiInsight] = useState<TrendAnalysisOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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
    const date = new Date(dateStr);
    return isNaN(date.getFullYear()) ? null : date.getFullYear();
  };

  const availableYears = useMemo(() => {
    if (!orders) return [];
    const years = new Set<number>();
    orders.forEach(o => {
      const yr = getOrderYear(o);
      if (yr && yr >= 2020 && yr <= 2030) years.add(yr);
    });
    const sorted = Array.from(years).sort((a, b) => b - a);
    return sorted.length > 0 ? sorted : [new Date().getFullYear()];
  }, [orders]);

  const trendData = useMemo(() => {
    const monthly = MONTH_NAMES.map((name, i) => {
      const entry: any = { month: name };
      selectedYears.forEach(yr => {
        entry[`impact_${yr}`] = 0;
        entry[`count_${yr}`] = 0;
        entry[`cumulative_${yr}`] = 0;
      });
      return entry;
    });

    if (!orders || selectedYears.length === 0) return monthly;

    selectedYears.forEach(year => {
      let cumulativeSum = 0;
      orders.forEach(o => {
        const dateStr = getOrderDate(o);
        if (!dateStr) return;
        const date = new Date(dateStr);
        if (date.getFullYear() === year) {
          const monthIdx = date.getMonth();
          if (monthIdx >= 0 && monthIdx < 12) {
            const impactValue = o.impactoNeto || o.financialImpact?.netImpact || 0;
            monthly[monthIdx][`impact_${year}`] += impactValue;
            monthly[monthIdx][`count_${year}`] += 1;
          }
        }
      });
      
      monthly.forEach(m => {
        cumulativeSum += m[`impact_${year}`];
        m[`cumulative_${year}`] = cumulativeSum;
      });
    });

    return monthly;
  }, [orders, selectedYears]);

  const kpis = useMemo(() => {
    if (trendData.length === 0 || selectedYears.length === 0) {
      return { acceleration: '0', averageOrders: '0', peakMonth: 'N/A', deviation: '0' };
    }

    let totalAccel = 0;
    let totalAvgOrdersPerMonth = 0;
    let totalDev = 0;
    const simulatedBudget = 150000000;
    const aggregatedMonthlyImpacts = MONTH_NAMES.map(() => 0);

    selectedYears.forEach(year => {
      const yearMonthlyData = trendData.map(d => ({
        impact: d[`impact_${year}`] || 0,
        count: d[`count_${year}`] || 0
      }));

      // Accel for this year
      let yearTotalGrowth = 0;
      let yearGrowthCounts = 0;
      for (let i = 1; i < yearMonthlyData.length; i++) {
        if (yearMonthlyData[i-1].impact > 0) {
          const growth = (yearMonthlyData[i].impact - yearMonthlyData[i-1].impact) / yearMonthlyData[i-1].impact;
          yearTotalGrowth += growth;
          yearGrowthCounts++;
        }
      }
      totalAccel += yearGrowthCounts > 0 ? (yearTotalGrowth / yearGrowthCounts) * 100 : 0;

      // Avg Orders for this year
      const yearTotalOrders = yearMonthlyData.reduce((acc, curr) => acc + curr.count, 0);
      totalAvgOrdersPerMonth += yearTotalOrders / 12;

      // Dev for this year
      const yearAnnualTotal = yearMonthlyData.reduce((acc, curr) => acc + curr.impact, 0);
      totalDev += simulatedBudget > 0 ? ((yearAnnualTotal - simulatedBudget) / simulatedBudget) * 100 : 0;

      // Aggregate for Peak Month
      yearMonthlyData.forEach((d, i) => {
        aggregatedMonthlyImpacts[i] += d.impact;
      });
    });

    const numYears = selectedYears.length;
    const avgPeakIdx = aggregatedMonthlyImpacts.indexOf(Math.max(...aggregatedMonthlyImpacts));

    return { 
      acceleration: (totalAccel / numYears).toFixed(1), 
      averageOrders: (totalAvgOrdersPerMonth / numYears).toFixed(1), 
      peakMonth: aggregatedMonthlyImpacts[avgPeakIdx] > 0 ? MONTH_NAMES[avgPeakIdx] : 'N/A', 
      deviation: (totalDev / numYears).toFixed(1)
    };
  }, [trendData, selectedYears]);

  const toggleYear = (year: number) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? (prev.length > 1 ? prev.filter(y => y !== year) : prev) 
        : [...prev, year].sort((a, b) => b - a)
    );
  };

  const runAiTrendAnalysis = async () => {
    if (trendData.length === 0 || selectedYears.length === 0) return;
    setIsAnalyzing(true);
    try {
      const primaryYear = selectedYears[0];
      const primaryMonthlyData = trendData.map(d => ({
        month: d.month,
        impact: d[`impact_${primaryYear}`],
        count: d[`count_${primaryYear}`]
      }));
      const totalImpact = primaryMonthlyData.reduce((acc, curr) => acc + curr.impact, 0);
      
      const causesMap = new Map<string, { impact: number, count: number }>();
      orders?.forEach(o => {
        const yr = getOrderYear(o);
        if (yr === primaryYear) {
            const cause = o.semanticAnalysis?.causaRaizReal || o.causaRaiz || 'No definida';
            const impact = o.impactoNeto || o.financialImpact?.netImpact || 0;
            const existing = causesMap.get(cause) || { impact: 0, count: 0 };
            causesMap.set(cause, { impact: existing.impact + impact, count: existing.count + 1 });
        }
      });
      const rootCauseSummary = Array.from(causesMap.entries()).map(([cause, stats]) => ({
        cause,
        ...stats
      })).sort((a, b) => b.impact - a.impact).slice(0, 5);

      const result = await analyzeStrategicTrends({
        monthlyData: primaryMonthlyData,
        year: primaryYear,
        totalImpact,
        rootCauseSummary
      });
      setAiInsight(result);
      toast({ title: "Análisis Estratégico Completo", description: `Planes de acción generados para el periodo seleccionado.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fallo en IA", description: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`reporte-comparativo-oc-ot.pdf`);
      toast({ title: "Reporte Exportado", description: "El PDF comparativo ha sido generado con éxito." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al exportar", description: "No se pudo generar el PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0.00";
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
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight">Histórico Comparativo & Impacto</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-50 p-1.5 rounded-xl border items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Años:</span>
              <div className="flex gap-1">
                {availableYears.map(y => (
                  <button
                    key={y}
                    onClick={() => toggleYear(y)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all border ${selectedYears.includes(y) ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleDownloadPdf} 
              disabled={isExporting || !aiInsight}
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5 h-10"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Exportar Informe
            </Button>
            <Button 
              onClick={runAiTrendAnalysis} 
              disabled={isAnalyzing || isLoading || selectedYears.length === 0}
              className="bg-slate-800 hover:bg-slate-700 gap-2 shadow-md h-10 px-6"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              IA Action Plan
            </Button>
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-6">
          <div ref={reportRef} className="space-y-6 bg-slate-50/50 p-6 rounded-3xl border border-white">
            <div className="flex items-center justify-between mb-2">
               <div className="space-y-1">
                  <h2 className="text-2xl font-headline font-bold text-slate-800">Análisis Comparativo Multi-anual</h2>
                  <p className="text-sm text-slate-500">Superposición de tendencias para la detección de picos recurrentes y variaciones de desempeño.</p>
               </div>
               <div className="flex gap-4">
                 {selectedYears.map((yr, i) => (
                   <div key={yr} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border shadow-sm">
                     <div className="h-3 w-3 rounded-full" style={{ backgroundColor: YEAR_COLORS[i % YEAR_COLORS.length] }} />
                     <span className="text-xs font-bold text-slate-700">{yr}</span>
                   </div>
                 ))}
               </div>
            </div>

            {aiInsight && (
              <Card className="border-primary/20 bg-primary/5 shadow-md border-l-4 border-l-primary overflow-hidden">
                <CardHeader className="pb-2 bg-white/50 border-b border-primary/10">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2 text-primary font-headline">
                      <Zap className="h-5 w-5 text-accent" />
                      Hojas de Ruta de Mejora Continua
                    </CardTitle>
                    <Badge variant={aiInsight.sentiment === 'Crítico' ? 'destructive' : 'default'} className="uppercase font-bold tracking-tight">
                      Sentimiento: {aiInsight.sentiment}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6 pt-6">
                  <div className="bg-white/60 p-4 rounded-2xl border border-white space-y-4">
                    <div>
                      <h4 className="text-[10px] font-black flex items-center gap-2 mb-2 text-slate-400 uppercase tracking-widest">
                        Narrativa de Tendencia
                      </h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{aiInsight.narrative}</p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="text-[10px] font-black flex items-center gap-2 mb-2 text-slate-400 uppercase tracking-widest">
                        Proyecciones al Cierre
                      </h4>
                      <p className="text-xs text-slate-600 italic">{aiInsight.projections}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {aiInsight.actionPlan?.map((plan, i) => (
                      <div key={i} className="p-4 bg-white/80 rounded-xl border border-white shadow-sm space-y-2">
                        <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" /> {plan.title}
                        </h5>
                        <ul className="pl-6 space-y-1">
                          {plan.steps.map((step, si) => (
                            <li key={si} className="text-[11px] text-slate-600 flex gap-2">
                              <span className="text-primary font-bold">•</span> {step}
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[9px] font-black text-slate-400 uppercase">Impacto Esperado:</span>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase">{plan.expectedImpact}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/50 border-b py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" /> Comparativa de Impacto Mensual
                      </CardTitle>
                      <CardDescription className="text-xs">Superposición de costos por año seleccionado</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="h-[400px] pt-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: '#64748b' }} 
                        tickFormatter={(v) => `$${Math.round(v/1000)}k`}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                        formatter={(value) => formatCurrency(value as number)}
                      />
                      <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                      {selectedYears.map((yr, i) => (
                        <Area 
                          key={yr}
                          type="monotone" 
                          dataKey={`impact_${yr}`} 
                          name={`${yr}`}
                          stroke={YEAR_COLORS[i % YEAR_COLORS.length]} 
                          fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                          fillOpacity={0.1}
                          strokeWidth={3}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-slate-800 text-white overflow-hidden">
                <CardHeader className="border-b border-slate-700 bg-slate-900/50">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Curva de Acumulación</CardTitle>
                  <CardDescription className="text-[10px] text-slate-500 uppercase">Progresión del sobrecosto interanual</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px] p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fill: '#94a3b8' }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                        formatter={(value) => formatCurrency(value as number)}
                      />
                      <Legend verticalAlign="top" align="right" height={36} />
                      {selectedYears.map((yr, i) => (
                        <Line 
                          key={yr}
                          type="stepAfter" 
                          dataKey={`cumulative_${yr}`} 
                          name={`${yr}`}
                          stroke={YEAR_COLORS[i % YEAR_COLORS.length]} 
                          strokeWidth={3} 
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 p-3 rounded-xl">
                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {selectedYears.length > 1 ? 'Aceleración Promedio' : 'Tasa Aceleración'}
                        </p>
                        <h3 className="text-xl font-headline font-bold text-slate-800">
                          {Number(kpis.acceleration) > 0 ? '+' : ''}{kpis.acceleration}%
                        </h3>
                      </div>
                    </div>
                  </CardContent>
               </Card>
               <Card className="border-none shadow-md bg-white border-l-4 border-l-amber-500">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-amber-100 p-3 rounded-xl">
                        <LayoutList className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {selectedYears.length > 1 ? 'Promedio OC/Mes (Multi)' : 'Promedio OC/Mes'}
                        </p>
                        <h3 className="text-xl font-headline font-bold text-slate-800">
                          {kpis.averageOrders}
                        </h3>
                      </div>
                    </div>
                  </CardContent>
               </Card>
               <Card className="border-none shadow-md bg-white border-l-4 border-l-primary">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-3 rounded-xl">
                        <Target className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {selectedYears.length > 1 ? 'Pico Consolidado' : 'Pico de Gasto'}
                        </p>
                        <h3 className="text-xl font-headline font-bold text-slate-800 uppercase">
                          {kpis.peakMonth}
                        </h3>
                      </div>
                    </div>
                  </CardContent>
               </Card>
               <Card className="border-none shadow-md bg-white border-l-4 border-l-rose-500">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-rose-100 p-3 rounded-xl">
                        <AlertCircle className="h-6 w-6 text-rose-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {selectedYears.length > 1 ? 'Desviación Promedio' : 'Desviación Ppto'}
                        </p>
                        <h3 className="text-xl font-headline font-bold text-slate-800">
                          {Number(kpis.deviation) > 0 ? '+' : ''}{kpis.deviation}%
                        </h3>
                      </div>
                    </div>
                  </CardContent>
               </Card>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}

