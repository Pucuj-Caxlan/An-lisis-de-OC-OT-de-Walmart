
"use client"

import React, { useState, useMemo, useEffect } from 'react';
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
  Loader2
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

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function TrendsPage() {
  const db = useFirestore();
  const [selectedYear, setSelectedYear] = useState(2024);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<TrendAnalysisOutput | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  // Helper para extraer fecha de cualquier fuente (Excel o PDF)
  const getOrderDate = (o: any) => {
    return o.fechaSolicitud || o.requestDate || o.header?.requestDate || o.projectInfo?.requestDate;
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
        if (monthly[month]) {
          // Sumamos impacto de Excel (impactoNeto) o PDF (financialImpact.netImpact)
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

  const runAiTrendAnalysis = async () => {
    if (trendData.length === 0) return;
    setIsAnalyzing(true);
    try {
      const totalImpact = trendData.reduce((acc, curr) => acc + curr.impact, 0);
      const result = await analyzeStrategicTrends({
        monthlyData: trendData.map(d => ({ month: d.month, impact: d.impact, count: d.count })),
        year: selectedYear,
        totalImpact
      });
      setAiInsight(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
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

  const peakMonth = useMemo(() => {
    if (trendData.length === 0) return { month: 'N/A' };
    return trendData.reduce((prev, curr) => (prev.impact > curr.impact) ? prev : curr, trendData[0]);
  }, [trendData]);

  return (
    <div className="flex min-h-screen w-full bg-slate-50/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10">
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
              onClick={runAiTrendAnalysis} 
              disabled={isAnalyzing || isLoading}
              className="bg-slate-800 hover:bg-slate-700 gap-2"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              Analizar Tendencia con IA
            </Button>
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-6">
          {aiInsight && (
            <Card className="border-primary/20 bg-primary/5 shadow-md border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <BrainCircuit className="h-5 w-5" />
                    Análisis Estratégico Gemini 2.5
                  </CardTitle>
                  <Badge variant={aiInsight.sentiment === 'Crítico' ? 'destructive' : 'default'} className="uppercase">
                    Estado: {aiInsight.sentiment}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2 mb-1 text-slate-800">
                      <Target className="h-4 w-4" /> Resumen Narrativo
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">{aiInsight.narrative}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2 mb-1 text-slate-800">
                      <AlertCircle className="h-4 w-4" /> Factores de Riesgo
                    </h4>
                    <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                      {aiInsight.keyDrivers.map((d, i) => <li key={i}>{d}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="space-y-4 bg-white/50 p-4 rounded-xl border">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2 mb-1 text-slate-800">
                      <TrendingUp className="h-4 w-4 text-emerald-500" /> Proyecciones
                    </h4>
                    <p className="text-sm text-slate-600">{aiInsight.projections}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2 mb-1 text-slate-800">
                      <Lightbulb className="h-4 w-4 text-amber-500" /> Recomendaciones VP
                    </h4>
                    <div className="space-y-2">
                      {aiInsight.recommendations.map((r, i) => (
                        <div key={i} className="flex gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <span className="font-bold text-primary">#{i+1}</span>
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
              <CardHeader className="bg-white border-b py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider">Flujo Mensual de Impacto</CardTitle>
                    <CardDescription>Evolución del costo de OC/OT por mes</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Anual</p>
                    <p className="text-xl font-headline font-bold text-primary">
                      {formatCurrency(trendData.reduce((acc, curr) => acc + curr.impact, 0))}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[400px] pt-8 bg-white">
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
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">Impacto Acumulado</CardTitle>
                <CardDescription className="text-slate-500">Crecimiento del sobrecosto año corriente</CardDescription>
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
             <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-emerald-100 p-3 rounded-xl">
                      <TrendingUp className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Tasa de Aceleración</p>
                      <h3 className="text-xl font-headline font-bold text-slate-800">+4.2% mes/mes</h3>
                    </div>
                  </div>
                </CardContent>
             </Card>
             <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-xl">
                      <BarChart3 className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Órdenes Promedio/Mes</p>
                      <h3 className="text-xl font-headline font-bold text-slate-800">
                        {(trendData.reduce((acc, curr) => acc + curr.count, 0) / 12).toFixed(1)}
                      </h3>
                    </div>
                  </div>
                </CardContent>
             </Card>
             <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-xl">
                      <Target className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Mes de Mayor Impacto</p>
                      <h3 className="text-xl font-headline font-bold text-slate-800">
                        {peakMonth.month}
                      </h3>
                    </div>
                  </div>
                </CardContent>
             </Card>
             <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-rose-100 p-3 rounded-xl">
                      <AlertCircle className="h-6 w-6 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Desviación vs Ppto</p>
                      <h3 className="text-xl font-headline font-bold text-slate-800">12.5%</h3>
                    </div>
                  </div>
                </CardContent>
             </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
