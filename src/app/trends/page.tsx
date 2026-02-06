
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
  LayoutList
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
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function TrendsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [selectedYear, setSelectedYear] = useState(2025);
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

  const trendData = useMemo(() => {
    const monthly = Array(12).fill(0).map((_, i) => ({
      month: MONTH_NAMES[i],
      impact: 0,
      count: 0,
      cumulative: 0
    }));

    if (!orders) return monthly;

    let cumulativeSum = 0;
    orders.forEach(o => {
      const dateStr = getOrderDate(o);
      if (!dateStr) return;
      
      const date = new Date(dateStr);
      if (date.getFullYear() === selectedYear) {
        const month = date.getMonth();
        if (month >= 0 && month < 12) {
          const impactValue = o.impactoNeto || o.financialImpact?.netImpact || 0;
          monthly[month].impact += impactValue;
          monthly[month].count += 1;
        }
      }
    });

    return monthly.map(m => {
      cumulativeSum += m.impact;
      return { ...m, cumulative: cumulativeSum };
    });
  }, [orders, selectedYear]);

  const kpis = useMemo(() => {
    if (trendData.length === 0) return { acceleration: '0', averageOrders: '0', peakMonth: 'N/A', deviation: '0' };

    let totalGrowth = 0;
    let growthCounts = 0;
    for (let i = 1; i < trendData.length; i++) {
      if (trendData[i-1].impact > 0) {
        const growth = (trendData[i].impact - trendData[i-1].impact) / trendData[i-1].impact;
        totalGrowth += growth;
        growthCounts++;
      }
    }
    const acceleration = growthCounts > 0 ? (totalGrowth / growthCounts) * 100 : 0;
    const totalOrders = trendData.reduce((acc, curr) => acc + curr.count, 0);
    const averageOrders = totalOrders / 12;
    const peak = trendData.reduce((prev, curr) => (prev.impact > curr.impact) ? prev : curr, trendData[0]);
    const annualTotal = trendData.reduce((acc, curr) => acc + curr.impact, 0);
    const simulatedBudget = 150000000;
    const deviation = simulatedBudget > 0 ? ((annualTotal - simulatedBudget) / simulatedBudget) * 100 : 0;

    return { 
      acceleration: acceleration.toFixed(1), 
      averageOrders: averageOrders.toFixed(1), 
      peakMonth: peak.impact > 0 ? peak.month : 'N/A', 
      deviation: deviation.toFixed(1) 
    };
  }, [trendData]);

  const runAiTrendAnalysis = async () => {
    if (trendData.length === 0) return;
    setIsAnalyzing(true);
    try {
      const totalImpact = trendData.reduce((acc, curr) => acc + curr.impact, 0);
      
      const causesMap = new Map<string, { impact: number, count: number }>();
      orders?.forEach(o => {
        const dateStr = getOrderDate(o);
        if (!dateStr) return;
        const date = new Date(dateStr);
        if (date.getFullYear() === selectedYear) {
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
        monthlyData: trendData.map(d => ({ month: d.month, impact: d.impact, count: d.count })),
        year: selectedYear,
        totalImpact,
        rootCauseSummary
      });
      setAiInsight(result);
      toast({ title: "Análisis Estratégico Completo", description: "Se han generado planes de acción basados en las causas raíz detectadas." });
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
      pdf.save(`reporte-tendencias-${selectedYear}.pdf`);
      toast({ title: "Reporte Exportado", description: "El PDF ha sido generado con éxito." });
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
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
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight">Tendencia e Impacto</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex bg-slate-100 p-1 rounded-lg border">
              {[2023, 2024, 2025].map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${selectedYear === y ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {y}
                </button>
              ))}
            </div>
            <Button 
              variant="outline" 
              onClick={handleDownloadPdf} 
              disabled={isExporting || !aiInsight}
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Exportar Informe
            </Button>
            <Button 
              onClick={runAiTrendAnalysis} 
              disabled={isAnalyzing || isLoading}
              className="bg-slate-800 hover:bg-slate-700 gap-2 shadow-md transition-all active:scale-95"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              Analizar Tendencia con IA
            </Button>
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-6" id="trends-report-container">
          <div ref={reportRef} className="space-y-6 bg-slate-50/50 p-4 rounded-3xl">
            {aiInsight && (
              <div className="space-y-6">
                <Card className="border-primary/20 bg-primary/5 shadow-md border-l-4 border-l-primary overflow-hidden">
                  <CardHeader className="pb-2 bg-white/50 border-b border-primary/10">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2 text-primary font-headline">
                        <BrainCircuit className="h-5 w-5" />
                        Análisis Estratégico Gemini 2.5
                      </CardTitle>
                      <Badge variant={aiInsight.sentiment === 'Crítico' ? 'destructive' : 'default'} className="uppercase font-bold tracking-tight">
                        Estado: {aiInsight.sentiment}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid md:grid-cols-2 gap-6 pt-6">
                    <div className="space-y-4">
                      <div className="bg-white/60 p-4 rounded-2xl border border-white">
                        <h4 className="text-xs font-black flex items-center gap-2 mb-2 text-slate-400 uppercase tracking-widest">
                          <Target className="h-4 w-4 text-primary" /> Resumen Narrativo
                        </h4>
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{aiInsight.narrative}</p>
                      </div>
                      <div className="bg-white/60 p-4 rounded-2xl border border-white">
                        <h4 className="text-xs font-black flex items-center gap-2 mb-2 text-slate-400 uppercase tracking-widest">
                          <AlertCircle className="h-4 w-4 text-rose-500" /> Factores de Riesgo
                        </h4>
                        <ul className="space-y-2">
                          {aiInsight.keyDrivers.map((d, i) => (
                            <li key={i} className="text-xs text-slate-600 flex gap-2">
                              <span className="text-rose-500 font-bold">•</span>
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-white/80 p-5 rounded-2xl border border-primary/10 shadow-sm h-full">
                        <h4 className="text-xs font-black flex items-center gap-2 mb-3 text-primary uppercase tracking-widest">
                          <Zap className="h-4 w-4 text-accent" /> Planes de Acción Inteligentes
                        </h4>
                        <div className="space-y-4">
                          {aiInsight.actionPlan?.map((plan, i) => (
                            <div key={i} className="p-4 bg-primary/5 rounded-xl border border-primary/5 space-y-2">
                              <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">{i+1}</span>
                                {plan.title}
                              </h5>
                              <div className="pl-7 space-y-1">
                                {plan.steps.map((step, si) => (
                                  <p key={si} className="text-[11px] text-slate-600 flex gap-2">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                                    {step}
                                  </p>
                                ))}
                              </div>
                              <div className="mt-2 pl-7 pt-2 border-t border-primary/10 flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Impacto:</span>
                                <span className="text-[10px] font-bold text-emerald-600 uppercase">{plan.expectedImpact}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-white border-b py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-widest">Flujo Mensual de Impacto</CardTitle>
                      <CardDescription className="text-xs">Evolución del costo de OC/OT por mes</CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Total Anual {selectedYear}</p>
                      <p className="text-xl font-headline font-bold text-primary">
                        {formatCurrency(trendData.reduce((acc, curr) => acc + curr.impact, 0))}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="h-[350px] pt-8 bg-white">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorImpact" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2962FF" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#2962FF" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
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
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value) => formatCurrency(value as number)}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="impact" 
                        stroke="#2962FF" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorImpact)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm bg-slate-800 text-white overflow-hidden">
                <CardHeader className="border-b border-slate-700 bg-slate-900/50">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Impacto Acumulado</CardTitle>
                  <CardDescription className="text-[10px] text-slate-500 uppercase">Crecimiento del sobrecosto año corriente</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] p-2">
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
                        itemStyle={{ color: '#38bdf8' }}
                        formatter={(value) => formatCurrency(value as number)}
                      />
                      <Line 
                        type="stepAfter" 
                        dataKey="cumulative" 
                        stroke="#38bdf8" 
                        strokeWidth={4} 
                        dot={{ fill: '#38bdf8', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               <Card className="border-none shadow-sm bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-100 p-3 rounded-xl">
                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tasa de Aceleración</p>
                        <h3 className="text-xl font-headline font-bold text-slate-800">
                          {Number(kpis.acceleration) > 0 ? '+' : ''}{kpis.acceleration}%
                        </h3>
                      </div>
                    </div>
                  </CardContent>
               </Card>
               <Card className="border-none shadow-sm bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-amber-100 p-3 rounded-xl">
                        <LayoutList className="h-6 w-6 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Órdenes / Mes</p>
                        <h3 className="text-xl font-headline font-bold text-slate-800">
                          {kpis.averageOrders}
                        </h3>
                      </div>
                    </div>
                  </CardContent>
               </Card>
               <Card className="border-none shadow-sm bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-3 rounded-xl">
                        <Target className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pico de Impacto</p>
                        <h3 className="text-xl font-headline font-bold text-slate-800 uppercase">
                          {kpis.peakMonth}
                        </h3>
                      </div>
                    </div>
                  </CardContent>
               </Card>
               <Card className="border-none shadow-sm bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-rose-100 p-3 rounded-xl">
                        <AlertCircle className="h-6 w-6 text-rose-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Desviación Ppto</p>
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
