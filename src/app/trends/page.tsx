
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
  CalendarDays
} from 'lucide-react';
import {
  AreaChart,
  Area,
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
import { Separator } from '@/components/ui/separator';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
    try {
      let cleanedDateStr = String(dateStr).toLowerCase();
      const monthsEs: Record<string, string> = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
        'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
      };
      Object.entries(monthsEs).forEach(([name, num]) => {
        cleanedDateStr = cleanedDateStr.replace(name, num);
      });
      cleanedDateStr = cleanedDateStr.replace(/\s/g, '');

      const date = new Date(cleanedDateStr);
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
        const yr = getOrderYear(o);
        if (yr === year) {
          const dateStr = getOrderDate(o);
          if (!dateStr) return;
          const date = new Date(dateStr);
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

      const yearTotalOrders = yearMonthlyData.reduce((acc, curr) => acc + curr.count, 0);
      totalAvgOrdersPerMonth += yearTotalOrders / 12;

      const yearAnnualTotal = yearMonthlyData.reduce((acc, curr) => acc + curr.impact, 0);
      totalDev += simulatedBudget > 0 ? ((yearAnnualTotal - simulatedBudget) / simulatedBudget) * 100 : 0;

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
      const aggregatedMonthlyData = MONTH_NAMES.map((name, idx) => {
        let impactSum = 0;
        let countSum = 0;
        selectedYears.forEach(yr => {
          impactSum += trendData[idx][`impact_${yr}`] || 0;
          countSum += trendData[idx][`count_${yr}`] || 0;
        });
        return { month: name, impact: impactSum, count: countSum };
      });

      const totalImpact = aggregatedMonthlyData.reduce((acc, curr) => acc + curr.impact, 0);
      
      const causesMap = new Map<string, { impact: number, count: number }>();
      orders?.forEach(o => {
        const yr = getOrderYear(o);
        if (yr && selectedYears.includes(yr)) {
            const cause = o.semanticAnalysis?.causaRaizReal || o.causaRaiz || 'No definida';
            const impact = o.impactoNeto || o.financialImpact?.netImpact || 0;
            const existing = causesMap.get(cause) || { impact: 0, count: 0 };
            causesMap.set(cause, { impact: existing.impact + impact, count: existing.count + 1 });
        }
      });
      const rootCauseSummary = Array.from(causesMap.entries()).map(([cause, stats]) => ({
        cause,
        ...stats
      })).sort((a, b) => b.impact - a.impact).slice(0, 10);

      const result = await analyzeStrategicTrends({
        monthlyData: aggregatedMonthlyData,
        years: selectedYears,
        totalImpact,
        rootCauseSummary
      });
      setAiInsight(result);
      toast({ title: "Análisis Estratégico Completo", description: "Se ha procesado la totalidad del histórico seleccionado." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fallo en IA", description: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    
    toast({ title: "Preparando Reporte", description: "Generando visuales corporativos..." });

    try {
      // Esperar un momento para asegurar que los gráficos de Recharts estén renderizados
      await new Promise(resolve => setTimeout(resolve, 800));

      const element = reportRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const finalImgWidth = imgWidth * ratio;
      const finalImgHeight = imgHeight * ratio;

      // Centrar el reporte en la página PDF
      const xOffset = (pdfWidth - finalImgWidth) / 2;
      
      pdf.addImage(imgData, 'PNG', xOffset, 0, finalImgWidth, finalImgHeight);
      pdf.save(`Walmart_Audit_Forensic_${selectedYears.join('_')}.pdf`);
      
      toast({ title: "Reporte Corporativo Generado", description: "El entregable ejecutivo ha sido descargado." });
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast({ variant: "destructive", title: "Error al exportar", description: "No se pudo generar el reporte PDF." });
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
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight">Histórico Comparativo & Impacto</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-50 p-1.5 rounded-xl border items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Periodos:</span>
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
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5 h-10 shadow-sm"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Reporte Corporativo
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
          <div className="max-w-[1200px] mx-auto">
            <div ref={reportRef} className="space-y-8 bg-white p-10 rounded-3xl border shadow-xl overflow-hidden">
              {/* Encabezado Corporativo */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-2">
                 <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-900 p-2 rounded-lg">
                        <Building2 className="text-white h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Walmart International</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real Estate & Construction Development • Forensic Audit</p>
                      </div>
                    </div>
                    <h3 className="text-4xl font-headline font-bold text-slate-800 pt-4">Informe Estratégico de Control de Cambios</h3>
                    <div className="flex items-center gap-6 pt-2">
                      <div className="flex items-center gap-2 text-slate-500">
                        <CalendarDays className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Periodo: {selectedYears.sort().join(' - ')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500">
                        <ShieldCheck className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase">Estado: Auditado por WAI (Gemini 2.5)</span>
                      </div>
                    </div>
                 </div>
                 <div className="text-right space-y-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confidencialidad</p>
                   <Badge variant="destructive" className="uppercase text-[9px] font-bold tracking-tight">Privado - Uso Interno</Badge>
                   <p className="text-[10px] text-slate-400 font-medium pt-4">Generado: {new Date().toLocaleDateString('es-MX')}</p>
                 </div>
              </div>

              {aiInsight && (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
                  {/* Executive Summary */}
                  <section className="grid lg:grid-cols-3 gap-8">
                    <Card className="lg:col-span-2 border-none bg-slate-50/50 shadow-none">
                      <CardHeader className="pb-2">
                        <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">01. Resumen Ejecutivo Transversal</h4>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-lg font-medium text-slate-800 leading-relaxed border-l-4 border-primary pl-6 py-2 italic">
                          "{aiInsight.narrative}"
                        </p>
                        <div className="grid md:grid-cols-2 gap-4 mt-6">
                          <div className="space-y-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <Target className="h-3 w-3 text-primary" /> Drivers de Costo Identificados
                            </p>
                            <ul className="space-y-1">
                              {aiInsight.keyDrivers.map((d, i) => (
                                <li key={i} className="text-xs text-slate-600 flex gap-2 font-medium">
                                  <span className="text-primary">•</span> {d}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <TrendingUp className="h-3 w-3 text-emerald-500" /> Proyecciones Estratégicas
                            </p>
                            <p className="text-[11px] text-slate-600 leading-relaxed">{aiInsight.projections}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-6">
                      <Card className="bg-slate-900 text-white border-none shadow-xl">
                        <CardContent className="pt-6">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Sentiment de Gestión</p>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-4xl font-headline font-bold">{aiInsight.sentiment}</h3>
                            <Zap className={`h-10 w-10 ${aiInsight.sentiment === 'Optimista' ? 'text-emerald-400' : aiInsight.sentiment === 'Estable' ? 'text-amber-400' : 'text-rose-400'}`} />
                          </div>
                          <Separator className="bg-white/10 my-4" />
                          <div className="space-y-2">
                            {aiInsight.recommendations.slice(0, 3).map((r, i) => (
                              <div key={i} className="flex gap-2 text-[10px] opacity-80 italic">
                                <ArrowRight className="h-3 w-3 shrink-0" /> {r}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </section>

                  {/* Intelligent Action Plan */}
                  <section className="space-y-4">
                     <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">02. Hoja de Ruta para Mejora Continua</h4>
                     <div className="grid md:grid-cols-3 gap-4">
                        {aiInsight.actionPlan.map((plan, i) => (
                          <div key={i} className="bg-white border-2 border-slate-100 p-6 rounded-2xl shadow-sm hover:border-primary/20 transition-all group">
                            <div className="flex items-start justify-between mb-4">
                              <h5 className="text-sm font-black text-slate-900 uppercase leading-tight group-hover:text-primary transition-colors">{plan.title}</h5>
                              <Target className="h-5 w-5 text-primary opacity-20" />
                            </div>
                            <ul className="space-y-3 mb-6">
                              {plan.steps.map((step, si) => (
                                <li key={si} className="text-[11px] text-slate-600 flex gap-3 leading-relaxed">
                                  <span className="h-4 w-4 bg-slate-100 text-slate-900 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0">{si + 1}</span>
                                  {step}
                                </li>
                              ))}
                            </ul>
                            <div className="pt-4 border-t border-dashed border-slate-100 flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Impacto Estimado</span>
                              <Badge variant="outline" className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border-emerald-100">
                                {plan.expectedImpact}
                              </Badge>
                            </div>
                          </div>
                        ))}
                     </div>
                  </section>
                </div>
              )}

              {/* Charts Section */}
              <section className="space-y-6 pt-6">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">03. Visualización Analítica de Datos</h4>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <Card className="lg:col-span-2 border-none shadow-none bg-white min-h-[400px]">
                    <CardHeader className="px-0">
                      <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" /> Impacto Mensual Comparativo (Agregado)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px] px-0 pt-4">
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
                              fillOpacity={0.05}
                              strokeWidth={3}
                              activeDot={{ r: 6 }}
                              isAnimationActive={false} // Desactivar para captura de PDF más fiable
                            />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 gap-4 h-fit">
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Total Auditado</p>
                        <h3 className="text-2xl font-headline font-bold text-slate-900">{formatCurrency(trendData.reduce((acc, curr) => {
                          let sum = 0;
                          selectedYears.forEach(y => sum += curr[`impact_${y}`] || 0);
                          return acc + sum;
                        }, 0))}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Tendencia {kpis.acceleration}%</span>
                        </div>
                     </div>
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Promedio de Órdenes / Mes</p>
                        <h3 className="text-2xl font-headline font-bold text-slate-900">{kpis.averageOrders} OC</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <LayoutList className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Muestra Multi-anual</span>
                        </div>
                     </div>
                     <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pico de Gasto Detectado</p>
                        <h3 className="text-2xl font-headline font-bold text-rose-600 uppercase">{kpis.peakMonth}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <AlertCircle className="h-3 w-3 text-rose-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Riesgo Estacional</span>
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
                    <span className="text-[8px] font-black text-slate-900 uppercase tracking-widest">WAI Forensic Intelligence Platform</span>
                 </div>
                 <p className="text-[8px] text-slate-400 font-bold uppercase">Página 01 / 01 • Folio Interno: {selectedYears.join('-')}-{Date.now().toString().slice(-6)}</p>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
