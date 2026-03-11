"use client"

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  BrainCircuit, 
  Target,
  Loader2,
  FileDown,
  Zap,
  ShieldCheck,
  Building2,
  CalendarDays,
  Focus,
  Activity,
  RefreshCcw,
  CheckCircle2
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  Cell,
  ComposedChart,
  Line
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { analyzeStrategicTrends, TrendAnalysisOutput } from '@/ai/flows/trend-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const CORE_COLOR = '#2962FF'; // Azul Vital Few (80%)
const MUTED_COLOR = '#E2E8F0'; // Gris Useful Many (20%)
const ACCENT_COLOR = '#FF8F00'; // Naranja Curva Pareto

const GET_RAMO = (discipline: string): string => {
  const d = String(discipline || '').toUpperCase().trim();
  
  if (d.includes('CIVIL') || d.includes('ARQUITECTÓNICA') || d.includes('TERRACERÍAS') || d.includes('EDIFICACIÓN') || d.includes('OBRA GRIS') || d.includes('ESTRUCTURA')) 
    return 'OBRA CIVIL';
  
  if (d.includes('INGENIERÍA') || d.includes('DISEÑO') || d.includes('ARQUITECTURA') || d.includes('PROYECTO')) 
    return 'INGENIERÍA Y DISEÑO';
  
  if (d.includes('ELÉCTRICA') || d.includes('HIDRÁULICA') || d.includes('AIRE') || d.includes('REFRIGERACIÓN') || d.includes('SANITARIA') || d.includes('PCI') || d.includes('VOZ') || d.includes('ESPECIALES') || d.includes('FUME')) 
    return 'INSTALACIONES (MEP)';
  
  if (d.includes('GESTIÓN') || d.includes('ADMINISTRACIÓN') || d.includes('SUPERVISIÓN') || d.includes('GERENCIA') || d.includes('TRÁMITES') || d.includes('LICENCIAS') || d.includes('LEGAL')) 
    return 'GESTIÓN Y ADMON';
  
  if (d.includes('MOBILIARIO') || d.includes('EQUIPO') || d.includes('COCINA') || d.includes('RACKS') || d.includes('SEÑALIZACIÓN')) 
    return 'EQUIPAMIENTO';

  return 'OTROS';
};

export default function TrendsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [selectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiInsight, setAiInsight] = useState<TrendAnalysisOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  const analyticsQuery = useMemoFirebase(() => db ? query(collection(db, 'hitos_analytics')) : null, [db]);
  const { data: analyticsDocs, isLoading: isDataLoading } = useCollection(analyticsQuery);

  const paretoData = useMemo(() => {
    if (!analyticsDocs || analyticsDocs.length === 0) return [];
    
    const ramoMap = new Map<string, { impact: number, count: number }>();
    let totalImpact = 0;

    analyticsDocs.forEach(d => {
      const ramoName = GET_RAMO(d.discipline || 'OTROS');
      const impact = Number(d.impact || 0);
      const count = Number(d.count || 0);
      totalImpact += impact;

      const existing = ramoMap.get(ramoName) || { impact: 0, count: 0 };
      ramoMap.set(ramoName, {
        impact: existing.impact + impact,
        count: existing.count + count
      });
    });

    const sortedRamos = Array.from(ramoMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.impact - a.impact);

    let cumulative = 0;
    return sortedRamos.map((item, index) => {
      cumulative += item.impact;
      return {
        ...item,
        percentage: Number(((item.impact / (totalImpact || 1)) * 100).toFixed(1)),
        cumulativePercentage: (cumulative / (totalImpact || 1)) * 100,
        isVital: (cumulative / (totalImpact || 1)) * 100 <= 85 || index === 0
      };
    });
  }, [analyticsDocs]);

  const vitalFew = useMemo(() => paretoData.filter(p => p.isVital), [paretoData]);

  const runAiTrendAnalysis = async () => {
    if (paretoData.length === 0) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeStrategicTrends({
        monthlyData: [], 
        years: selectedYears,
        totalImpact: globalAgg?.totalImpact || 0,
        rootCauseSummary: paretoData.map(p => ({ cause: p.name, impact: p.impact, count: p.count, percentage: p.percentage })),
        paretoTop80: vitalFew.map(p => p.name)
      });
      setAiInsight(result);
      toast({ title: "Plan de Acción Generado", description: "Estrategia de mitigación basada en Ramos lista." });
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
      const element = reportRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
      pdf.save(`Walmart_Ramos_Strategic_Plan_${new Date().getTime()}.pdf`);
      toast({ title: "Reporte Exportado" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al exportar" });
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  if (isDataLoading || !globalAgg) return (
    <div className="flex h-screen items-center justify-center bg-slate-50 flex-col gap-4">
      <RefreshCcw className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Ramos Críticos...</p>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Estrategia 80/20 por Ramos</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleDownloadPdf} disabled={isExporting || !aiInsight} className="gap-2 border-slate-200 text-slate-600 h-10 shadow-sm rounded-xl text-[10px] font-black uppercase">
              {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />} Exportar PDF
            </Button>
            <Button onClick={runAiTrendAnalysis} disabled={isAnalyzing || paretoData.length === 0} className="bg-primary hover:bg-primary/90 gap-2 shadow-lg h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest">
              {isAnalyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <BrainCircuit className="h-3 w-3" />} Generar Mitigación IA
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8">
          <div className="max-w-[1200px] mx-auto">
            <div ref={reportRef} className="space-y-10 bg-white p-12 rounded-[40px] border shadow-2xl overflow-hidden min-h-screen">
              
              <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-slate-900 pb-8 gap-6">
                 <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-900 p-3 rounded-2xl shadow-xl">
                        <Building2 className="text-white h-8 w-8" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Walmart International</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">Real Estate Forensic Unit</p>
                      </div>
                    </div>
                    <h3 className="text-5xl font-headline font-bold text-slate-800 tracking-tight">Estrategia Vital Few por Ramo</h3>
                 </div>
                 <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-end">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Total Auditado</p>
                    <h4 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(globalAgg.totalImpact)}</h4>
                    <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] font-black mt-2">RAMOS SINCRONIZADOS</Badge>
                 </div>
              </div>

              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2"><Focus className="h-5 w-5" /> Curva de Concentración por Ramos Técnicos</h4>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: CORE_COLOR }} /><span className="text-[9px] font-black uppercase text-slate-500">Vital Few (85%)</span></div>
                    <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: MUTED_COLOR }} /><span className="text-[9px] font-black uppercase text-slate-500">Useful Many</span></div>
                  </div>
                </div>
                <div className="h-[400px] w-full pt-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={paretoData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: '900', fill: '#64748B' }} height={50} />
                      <YAxis yAxisId="left" tickFormatter={(v) => `$${Math.round(v/1000000)}M`} tick={{ fontSize: 10, fontWeight: 'bold' }} axisLine={false} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${Math.round(v)}%`} tick={{ fontSize: 10, fill: ACCENT_COLOR, fontWeight: 'bold' }} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontSize: '10px', textTransform: 'uppercase' }} />
                      <Bar yAxisId="left" dataKey="impact" radius={[8, 8, 0, 0]} barSize={60} name="Impacto por Ramo">
                        {paretoData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.isVital ? CORE_COLOR : MUTED_COLOR} 
                          />
                        ))}
                      </Bar>
                      <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" stroke={ACCENT_COLOR} strokeWidth={4} dot={{ r: 6, fill: ACCENT_COLOR, strokeWidth: 2, stroke: '#fff' }} name="% Acumulado" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-slate-900 p-6 rounded-3xl text-white flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Diagnóstico de Concentración por Ramo</p>
                    <p className="text-sm font-bold text-slate-300">Los <span className="text-white underline decoration-cyan-400 decoration-2">{vitalFew.length} Ramos Principales</span> concentran el impacto estratégico de la operación.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-black text-cyan-400">{Math.round((vitalFew.length / (paretoData.length || 1)) * 100)}%</span>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-tighter">De los Ramos Técnicos</p>
                  </div>
                </div>
              </section>

              {!aiInsight ? (
                <div className="py-20 text-center space-y-4 border-2 border-dashed rounded-[40px] border-slate-100 bg-slate-50/50">
                  <Activity className="h-16 w-16 text-slate-200 mx-auto animate-pulse" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Genere el plan de mitigación IA para analizar los Ramos detectados</p>
                </div>
              ) : (
                <div className="space-y-12 animate-in fade-in zoom-in duration-700">
                  <div className="grid md:grid-cols-2 gap-12">
                    <section className="space-y-6">
                      <h4 className="text-xs font-black uppercase text-primary tracking-[0.2em] flex items-center gap-3">
                        <Activity className="h-5 w-5" /> Diagnóstico del Universo de Ramos
                      </h4>
                      <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 text-sm text-slate-600 leading-relaxed text-justify relative">
                        <div className="absolute top-4 right-4"><Badge className="bg-white text-primary border-none shadow-sm text-[8px]">IA RAMOS ANALYSIS</Badge></div>
                        {aiInsight.narrative}
                      </div>
                    </section>
                    
                    <section className="space-y-6">
                      <h4 className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-3">
                        <Target className="h-5 w-5" /> Clasificación de Ramos (Top 80%)
                      </h4>
                      <div className="grid grid-cols-1 gap-3">
                        {vitalFew.map((d, i) => (
                          <div key={i} className="flex items-center justify-between p-4 bg-white border rounded-2xl shadow-sm group hover:border-primary transition-all">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">{i+1}</div>
                              <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight">{d.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] font-black text-slate-900">{formatCurrency(d.impact)}</span>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">{d.percentage}% del Capex</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <section className="space-y-8">
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-slate-100" />
                      <h4 className="text-xs font-black uppercase text-slate-400 tracking-[0.3em]">Planes de Acción por Especialidad</h4>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    <div className="grid md:grid-cols-3 gap-6">
                      {aiInsight.actionPlan.map((plan, i) => (
                        <Card key={i} className="border-none shadow-xl bg-white rounded-3xl overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
                          <CardHeader className="bg-slate-900 text-white p-6">
                            <div className="flex justify-between items-start mb-2">
                              <Badge className="bg-accent text-white border-none text-[8px] font-black px-2 py-0.5">PLAN RAMO {i+1}</Badge>
                              <Zap className="h-4 w-4 text-accent" />
                            </div>
                            <CardTitle className="text-sm font-black uppercase tracking-tight leading-tight">{plan.title}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-6 space-y-4">
                            <ul className="space-y-3">
                              {plan.steps.map((step, j) => (
                                <li key={j} className="flex gap-3 text-[10px] text-slate-600 leading-tight">
                                  <div className="h-4 w-4 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 font-bold">{j+1}</div>
                                  {step}
                                </li>
                              ))}
                            </ul>
                            <div className="pt-4 border-t border-dashed">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Estimado en Ramo</p>
                              <p className="text-[10px] font-bold text-emerald-600 uppercase italic">{plan.expectedImpact}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>

                  <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[40px] flex items-center justify-between shadow-inner">
                    <div className="flex items-center gap-6">
                      <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      </div>
                      <div className="space-y-1">
                        <h5 className="text-xl font-black text-emerald-900 uppercase tracking-tighter">Optimización de Capex por Ramos</h5>
                        <p className="text-xs font-bold text-emerald-700/70">Ahorro proyectado al mitigar el Vital Few del 80% del impacto.</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-5xl font-black text-emerald-600 tracking-tighter">{aiInsight.estimatedReduction}</span>
                      <p className="text-[9px] font-black text-emerald-800/50 uppercase tracking-[0.2em] mt-1">Eficiencia Estratégica</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-12 border-t border-slate-100 flex justify-between items-center opacity-50">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Walmart Real Estate Forensic Unit • Ramos Sincronizados</span>
                </div>
                <p className="text-[8px] font-mono text-slate-400 uppercase">Audit Ref: {globalAgg?.lastUpdate || 'N/A'}</p>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}