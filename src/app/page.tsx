"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  RefreshCcw, 
  Target, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Focus,
  Zap,
  DollarSign,
  ArrowUpRight,
  PieChart as PieChartIcon,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const CORE_COLOR = '#2962FF'; // Walmart Blue
const ACCENT_COLOR = '#FF8F00'; // Walmart Orange (Pareto Line)
const NEUTRAL_COLOR = '#E2E8F0'; 

export default function VpDashboard() {
  const db = useFirestore();
  const { user, isAuthReady } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Leer Agregados Materializados (Single Source of Truth para Dashboards)
  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg, isLoading: isAggLoading } = useDoc(aggRef);

  // 1. Cálculo de Datos de Pareto (80/20)
  const paretoData = useMemo(() => {
    if (!globalAgg?.disciplines) return [];
    
    const items = Object.entries(globalAgg.disciplines)
      .map(([name, stats]: any) => ({ 
        name: name.toUpperCase(), 
        impact: stats.impact || 0, 
        count: stats.count || 0 
      }))
      .sort((a, b) => b.impact - a.impact);

    const totalImpact = items.reduce((acc, c) => acc + c.impact, 0);
    let cumulative = 0;
    
    return items.map(c => {
      cumulative += c.impact;
      return {
        ...c,
        cumulativePercentage: totalImpact > 0 ? Math.min(100, (cumulative / totalImpact) * 100) : 0
      };
    });
  }, [globalAgg]);

  // 2. Identificación de "Vital Few" (Las causas que concentran el 80% del gasto)
  const vitalFew = useMemo(() => {
    return paretoData.filter(p => p.cumulativePercentage <= 85); // 85% para capturar el núcleo crítico
  }, [paretoData]);

  const concentrationRatio = useMemo(() => {
    const totalImpact = globalAgg?.totalImpact || 1;
    const vitalImpact = vitalFew.reduce((acc, p) => acc + p.impact, 0);
    return (vitalImpact / totalImpact) * 100;
  }, [vitalFew, globalAgg]);

  // 3. Resumen de Causas Raíz (Análisis Nivel 2)
  const rootCauseSummary = useMemo(() => {
    if (!globalAgg?.rootCauses) return [];
    return Object.entries(globalAgg.rootCauses)
      .map(([name, stats]: any) => ({
        name,
        value: stats.impact || 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [globalAgg]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  const formatFullCurrency = (val: number) => {
    if (!mounted) return "$0.00";
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
  };

  if (isAggLoading || !isAuthReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCcw className="h-10 w-10 animate-spin text-primary opacity-20" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Sincronizando Estrategia 80/20...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between border-b bg-white px-8 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-6">
            <SidebarTrigger />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter font-headline">Executive Dashboard VP</h1>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Walmart International • Universe: {(globalAgg?.totalOrders || 0).toLocaleString()} Records</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="h-8 bg-emerald-50 text-emerald-700 border-emerald-100 gap-2 px-3 uppercase font-black text-[9px]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Integridad: {((globalAgg?.totalProcessed / globalAgg?.totalOrders) * 100).toFixed(1)}%
            </Badge>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="h-10 border-slate-200 gap-2 text-[10px] font-black uppercase rounded-xl">
              <RefreshCcw className="h-3.5 w-3.5" /> Recalcular
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          {/* Tarjetas de Alto Impacto (KPIs Estratégicos) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary overflow-hidden">
              <CardContent className="p-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Impacto Materializado</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(globalAgg?.totalImpact || 0)}</h2>
                  <span className="text-[10px] font-bold text-emerald-500 flex items-center"><ArrowUpRight className="h-3 w-3" /> 100% Auditado</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-2 uppercase font-bold">Consolidado Global en MXN</p>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-md bg-slate-900 text-white border-l-4 border-l-accent overflow-hidden">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Concentración 80/20</p>
                  <Target className="h-4 w-4 text-accent opacity-50" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-black text-white tracking-tighter">{Math.round(concentrationRatio)}%</h2>
                  <span className="text-[10px] font-bold text-accent uppercase">del Gasto</span>
                </div>
                <div className="mt-3">
                  <Progress value={concentrationRatio} className="h-1 bg-white/10" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-blue-600 overflow-hidden">
              <CardContent className="p-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Integridad de Análisis</p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{(globalAgg?.totalProcessed || 0).toLocaleString()}</h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Registros</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-2 uppercase font-bold">Con Clasificación IA Gemini</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">Vital Few (Core)</p>
                  <Zap className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{vitalFew.length}</h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Disciplinas</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-2 uppercase font-bold">Drivers Críticos del Presupuesto</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Gráfica de Pareto Principal */}
            <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden rounded-3xl">
              <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-6 px-8">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Focus className="h-5 w-5" /> Curva de Concentración de Impacto (Pareto)
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Análisis Transversal por Disciplina Técnica</CardDescription>
                </div>
                <Badge className="bg-primary text-white border-none text-[9px] font-black uppercase px-4 py-1.5 shadow-lg shadow-primary/20">ESTRATEGIA 80/20</Badge>
              </CardHeader>
              <CardContent className="h-[450px] pt-12 px-8">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoData.slice(0, 15)} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748B' }} 
                      height={80} 
                      interval={0} 
                      angle={-35} 
                      textAnchor="end" 
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      yAxisId="left" 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#1E293B' }} 
                      tickFormatter={(v) => `$${Math.round(v/1000000)}M`} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <YAxis 
                      yAxisId="right" 
                      orientation="right" 
                      domain={[0, 100]} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: ACCENT_COLOR }} 
                      tickFormatter={(v) => `${v}%`} 
                      axisLine={false} 
                      tickLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}
                    />
                    <Bar yAxisId="left" dataKey="impact" radius={[8, 8, 0, 0]} barSize={40} name="Impacto Económico">
                      {paretoData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cumulativePercentage <= 85 ? CORE_COLOR : NEUTRAL_COLOR} />
                      ))}
                    </Bar>
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="cumulativePercentage" 
                      stroke={ACCENT_COLOR} 
                      strokeWidth={4} 
                      dot={{ r: 6, fill: ACCENT_COLOR, strokeWidth: 3, stroke: '#fff' }} 
                      activeDot={{ r: 8, strokeWidth: 0 }}
                      name="% Acumulado"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Análisis de Causa Raíz (Drill-down) */}
            <div className="space-y-8 flex flex-col">
              <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden flex-1 flex flex-col">
                <CardHeader className="bg-slate-50/50 border-b p-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[11px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                      <Layers className="h-4 w-4" /> Top Causa Raíz
                    </CardTitle>
                    <Badge variant="outline" className="text-[8px] font-black uppercase">Consolidado</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8 flex-1">
                  {rootCauseSummary.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                      <RefreshCcw className="h-12 w-12 animate-spin text-slate-200" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Causas...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {rootCauseSummary.map((rc, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight truncate max-w-[200px]">{rc.name}</span>
                            <span className="text-[10px] font-bold text-primary">{formatCurrency(rc.value)}</span>
                          </div>
                          <Progress value={(rc.value / (globalAgg?.totalImpact || 1)) * 100 * 5} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-8 p-6 bg-primary/5 rounded-2xl border border-dashed border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Focus className="h-4 w-4 text-primary" />
                      <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Diagnóstico 80/20</h4>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed italic">
                      "El análisis forense identifica que las primeras <strong>{vitalFew.length} disciplinas</strong> concentran el <strong>{Math.round(concentrationRatio)}%</strong> de las desviaciones totales de construcción. Se recomienda priorizar auditoría en {vitalFew[0]?.name || 'el núcleo crítico'}."
                    </p>
                  </div>
                </CardContent>
                <div className="p-6 border-t bg-slate-50/50">
                  <Button asChild className="w-full h-12 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-xl transition-all active:scale-95">
                    <a href="/analysis">Ver Análisis Detallado</a>
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Sección de Auditoría de Sub-disciplinas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <Card className="border-none shadow-md bg-white rounded-3xl p-8 border-t-4 border-t-primary">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Presupuesto Auditado</h4>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(globalAgg?.totalImpact || 0)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-slate-400">Certificación Global</span>
                    <span className="text-emerald-600">100%</span>
                  </div>
                  <Progress value={100} className="h-1 bg-slate-100" />
                </div>
             </Card>

             <Card className="border-none shadow-md bg-white rounded-3xl p-8 border-t-4 border-t-accent">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Desviación Vital Few</h4>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(vitalFew.reduce((a, b) => a + b.impact, 0))}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-slate-400">Concentración de Riesgo</span>
                    <span className="text-accent">{Math.round(concentrationRatio)}%</span>
                  </div>
                  <Progress value={concentrationRatio} className="h-1 bg-slate-100" />
                </div>
             </Card>

             <Card className="border-none shadow-md bg-white rounded-3xl p-8 border-t-4 border-t-slate-900">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-slate-900/10 flex items-center justify-center">
                    <PieChartIcon className="h-6 w-6 text-slate-900" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Volumen Operativo</h4>
                    <p className="text-2xl font-black text-slate-900 tracking-tighter">{(globalAgg?.totalOrders || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase">
                    <span className="text-slate-400">Avance de Integridad IA</span>
                    <span className="text-primary">{((globalAgg?.totalProcessed / globalAgg?.totalOrders) * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={(globalAgg?.totalProcessed / globalAgg?.totalOrders) * 100} className="h-1 bg-slate-100" />
                </div>
             </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
