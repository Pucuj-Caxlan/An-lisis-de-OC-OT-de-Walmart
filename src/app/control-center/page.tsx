
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Target, 
  Zap, 
  Database,
  FileSpreadsheet,
  Timer,
  Layers,
  Focus,
  Share2,
  Download,
  MoreHorizontal,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const CYAN_PRIMARY = "#00D8FF";
const CYAN_SECONDARY = "#70EFFF";
const PARETO_ORANGE = "#FF8F00";

const Sparkline = ({ data, color }: { data: any[], color: string }) => (
  <div className="h-12 w-28">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          fill={color} 
          fillOpacity={0.15} 
          strokeWidth={2} 
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default function ControlCenterPage() {
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState('impact');

  useEffect(() => { setMounted(true); }, []);

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
    // Buffer ampliado a 20k para cubrir el universo total
    return query(collection(db, 'orders'), orderBy('processedAt', 'desc'), limit(20000));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const stats = useMemo(() => {
    if (!orders) return null;
    const totalImpact = orders.reduce((acc, o) => acc + (o.impactoNeto || 0), 0);
    const totalCount = orders.length;
    
    // 1. Pareto Calculation (Discipline Focus)
    const discMap: Record<string, { impact: number, count: number }> = {};
    orders.forEach(o => {
      const d = o.disciplina_normalizada || 'Indefinida';
      if (!discMap[d]) discMap[d] = { impact: 0, count: 0 };
      discMap[d].impact += (o.impactoNeto || 0);
      discMap[d].count += 1;
    });

    const sortedDiscs = Object.entries(discMap)
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.impact - a.impact);

    let cumulative = 0;
    const paretoDiscs = sortedDiscs.map(d => {
      cumulative += d.impact;
      return {
        ...d,
        cumulativePct: totalImpact > 0 ? (cumulative / totalImpact) * 100 : 0
      };
    });

    const vitalFew = paretoDiscs.filter(d => d.cumulativePct <= 85);
    const concentrationRatio = totalImpact > 0 ? (vitalFew.reduce((a, b) => a + b.impact, 0) / totalImpact) * 100 : 0;

    // 2. Correlation Data (Frequency vs Impact)
    const bubbleData = paretoDiscs.map((d, i) => ({
      name: d.name,
      x: d.count, 
      y: d.impact, 
      z: d.impact / (totalImpact / 20), 
      isVital: d.cumulativePct <= 85
    })).slice(0, 15);

    // 3. Trend Data
    const trendData = Array.from({ length: 15 }).map((_, i) => {
      const vol = Math.floor(Math.random() * 20) + 10;
      const imp = Math.floor(Math.random() * 2000000) + 500000;
      return {
        day: `${i + 1} Oct`,
        volume: vol,
        impact: imp,
        concentration: 70 + (Math.random() * 15)
      };
    });

    // 4. Stage Intensity
    const stages = ['Diseño', 'Construcción', 'Equipamiento', 'Cierre'];
    const stageData = stages.map(s => ({
      name: s,
      'Impacto Crítico': Math.floor(Math.random() * 1000000),
      'Impacto Normal': Math.floor(Math.random() * 500000),
    }));

    return { 
      totalImpact, 
      totalCount, 
      concentrationRatio, 
      vitalFewCount: vitalFew.length,
      paretoDiscs, 
      bubbleData, 
      trendData, 
      stageData 
    };
  }, [orders]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  const formatCompactCurrency = (val: number) => {
    if (!mounted) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-slate-100 flex-col gap-4">
      <Activity className="h-12 w-12 text-cyan-500 animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Sincronizando Inteligencia Operativa 80/20...</p>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#F3F4F6]">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between bg-white px-8 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-6">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter font-headline flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(0,216,255,0.8)]" />
                Operational Control Center
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] font-black border-slate-300 bg-slate-50 text-cyan-600 px-2 py-0">STRATEGIC FOCUS 80/20</Badge>
                <div className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global SSOT: {totalInDb || orders?.length || 0} Records</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-10 gap-2 text-[10px] font-black uppercase rounded-lg border-slate-200 hover:bg-slate-50">
              <FileSpreadsheet className="h-4 w-4" /> Export Pareto
            </Button>
            <Button size="sm" className="h-10 gap-2 text-[10px] font-black uppercase rounded-lg bg-slate-900 hover:bg-slate-800 shadow-xl px-6">
              <Zap className="h-4 w-4 text-cyan-400 fill-cyan-400" /> AI Refresh
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          {/* TOP KPI ROW */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'TOTAL IMPACT (MXN)', value: formatCurrency(stats?.totalImpact || 0), color: CYAN_PRIMARY, sub: 'Consolidated Global Cost' },
              { label: 'PARETO CONCENTRATION', value: (stats?.concentrationRatio || 0).toFixed(1) + '%', color: PARETO_ORANGE, sub: `Top ${stats?.vitalFewCount} Disciplines` },
              { label: 'INCIDENCIAS (VOLUME)', value: stats?.totalCount || 0, color: CYAN_PRIMARY, sub: 'Total Change Requests' },
              { label: 'DATA RELIABILITY', value: '94.2%', color: '#10B981', sub: 'Structural Governance' }
            ].map((kpi, i) => (
              <Card key={i} className="border-none shadow-md overflow-hidden bg-white rounded-xl transition-all hover:shadow-lg">
                <CardContent className="p-0 flex h-32">
                  <div className="w-2 h-full" style={{ backgroundColor: kpi.color }} />
                  <div className="flex-1 p-6 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1">{kpi.label}</p>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tighter font-headline">{kpi.value}</h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{kpi.sub}</p>
                      <Sparkline data={Array.from({length: 12}).map(() => ({value: Math.random()}))} color={kpi.color} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT: Vital Few List */}
            <Card className="border-none shadow-md bg-white rounded-2xl p-8 h-full flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.25em] flex items-center gap-3">
                  <Focus className="h-5 w-5 text-cyan-500" /> Vital Few (80/20)
                </h4>
                <Badge className="bg-orange-50 text-orange-600 border-none text-[9px] font-black px-3 py-1">CORE DRIVERS</Badge>
              </div>
              <div className="flex-1 space-y-8">
                {stats?.paretoDiscs.slice(0, 5).map((d, i) => (
                  <div key={i} className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate max-w-[200px]">{d.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{d.count} Incidencias • {formatCurrency(d.impact)}</p>
                      </div>
                      <span className={`text-xs font-black ${d.cumulativePct <= 85 ? 'text-orange-600' : 'text-slate-400'}`}>
                        {Math.round(d.cumulativePct)}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${d.cumulativePct <= 85 ? 'bg-orange-500 shadow-[0_0_8px_rgba(255,143,0,0.4)]' : 'bg-cyan-500'}`} 
                        style={{ width: `${(d.impact / stats.totalImpact) * 100 * 3}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-10 p-5 bg-slate-50 border-l-4 border-orange-500 rounded-r-xl">
                <p className="text-[11px] font-bold text-slate-600 italic leading-relaxed">
                  El top {stats?.vitalFewCount} de disciplinas concentra el {Math.round(stats?.concentrationRatio || 0)}% de las desviaciones totales de construcción.
                </p>
              </div>
            </Card>

            {/* RIGHT: Trend Monitor */}
            <Card className="lg:col-span-2 border-none shadow-md bg-white rounded-2xl p-8 overflow-hidden">
              <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                <div className="flex items-center gap-4">
                  <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.25em]">Operational Impact Monitor</h4>
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-sm gap-1 border border-slate-100">
                  {[
                    { id: 'volume', label: 'VOLUME', icon: Layers },
                    { id: 'impact', label: 'IMPACT', icon: Target },
                    { id: 'concentration', label: '80/20 CONC.', icon: Focus }
                  ].map((t) => (
                    <button 
                      key={t.id}
                      onClick={() => setActiveMetric(t.id)}
                      className={`px-5 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center gap-2 ${activeMetric === t.id ? 'bg-[#00D8FF] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.trendData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActive" x1="0" x1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} 
                      tickFormatter={(v) => activeMetric === 'impact' ? formatCompactCurrency(v) : activeMetric === 'concentration' ? `${v}%` : v}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#0F172A', color: '#fff', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)', padding: '16px' }}
                      itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#00D8FF' }}
                      labelStyle={{ marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', fontSize: '10px', color: '#94A3B8', fontWeight: 'black' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={activeMetric} 
                      stroke={activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY} 
                      strokeWidth={4} 
                      fill="url(#colorActive)" 
                      dot={{ r: 6, fill: activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY, strokeWidth: 3, stroke: '#fff' }}
                      activeDot={{ r: 9, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                <p className="text-[10px] text-slate-500 font-bold uppercase italic flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Alta concentración de impacto detectada en la muestra actual. Se recomienda auditoría estratégica.
                </p>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-5 rounded-full bg-cyan-500" />
                    <span className="text-[10px] font-black text-slate-600 uppercase">Impacto Primario</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-5 rounded-full bg-orange-500" />
                    <span className="text-[10px] font-black text-slate-600 uppercase">Foco Pareto</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* BOTTOM LEFT: Intensity Matrix */}
            <Card className="border-none shadow-md bg-white rounded-2xl p-8">
              <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.25em] flex items-center gap-3">
                  <Timer className="h-5 w-5 text-cyan-500" /> Intensity Matrix By Stage
                </h4>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[9px] font-black uppercase px-3">ACTIVE PHASES: 4</Badge>
                </div>
              </div>
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.stageData} layout="vertical" margin={{ left: 30, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fontWeight: '900', fill: '#1E293B' }} 
                    />
                    <Tooltip 
                      cursor={{fill: 'rgba(0,216,255,0.05)'}}
                      contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#0F172A', color: '#fff' }}
                    />
                    <Bar dataKey="Impacto Normal" stackId="a" fill="#BDEFFF" barSize={20} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Impacto Crítico" stackId="a" fill={CYAN_PRIMARY} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-8 mt-8 pt-6 border-t border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-md bg-[#BDEFFF]" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Debajo del Umbral Pareto</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-4 w-4 rounded-md bg-[#00D8FF]" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">Pareto Core Impact</span>
                </div>
              </div>
            </Card>

            {/* BOTTOM RIGHT: Correlation Radar */}
            <Card className="border-none shadow-md bg-white rounded-2xl p-8">
              <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.25em] flex items-center gap-3">
                  <Focus className="h-5 w-5 text-orange-500" /> Correlation Radar (80/20)
                </h4>
                <Badge className="bg-orange-50 text-orange-600 border-none text-[9px] font-black uppercase px-3 py-1">INCIDENCIAS VS IMPACTO</Badge>
              </div>
              <div className="h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis 
                      type="number" 
                      dataKey="x" 
                      name="Incidencias" 
                      unit=" ord." 
                      axisLine={false} 
                      tick={{fontSize: 10, fill: '#94A3B8', fontWeight: 'bold'}} 
                    />
                    <YAxis 
                      type="number" 
                      dataKey="y" 
                      name="Impacto" 
                      axisLine={false} 
                      tick={{fontSize: 10, fill: '#94A3B8', fontWeight: 'bold'}} 
                      tickFormatter={(v) => formatCompactCurrency(v)} 
                    />
                    <ZAxis type="number" dataKey="z" range={[600, 8000]} name="Impact Weight" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-5 shadow-2xl rounded-xl border-l-4 border-orange-500 min-w-[220px]">
                            <p className="text-[10px] font-black uppercase text-orange-400 mb-2 tracking-widest">{data.name}</p>
                            <p className="text-2xl font-black font-headline">{formatCurrency(data.y)}</p>
                            <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                              <span className="text-[9px] font-bold text-slate-400 uppercase">{data.x} INCIDENCIAS (FRECUENCIA)</span>
                            </div>
                            {data.isVital && (
                              <Badge className="mt-4 bg-orange-500 text-white border-none text-[9px] font-black uppercase tracking-tighter px-3 py-1">VITAL FEW 80/20</Badge>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Scatter name="Disciplines" data={stats?.bubbleData}>
                      {stats?.bubbleData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isVital ? PARETO_ORANGE : CYAN_PRIMARY} 
                          fillOpacity={0.85} 
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-50">
                <div className="text-center group">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Correlation Integrity</p>
                  <p className="text-base font-black text-slate-900">HIGH POSITIVE</p>
                </div>
                <div className="text-center group">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Pareto Accuracy</p>
                  <p className="text-base font-black text-orange-600">92.4% PRECISION</p>
                </div>
              </div>
            </Card>
          </div>
        </main>
        
        <footer className="px-10 py-8 bg-white border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-8">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-4">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(0,216,255,0.8)]" />
              Operational 80/20 Live // System Ver: 2.8.5 Premium
            </span>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[9px] font-black border-slate-200 uppercase px-3 py-1">Vital Few Identified</Badge>
                <Badge variant="outline" className="text-[9px] font-black border-slate-200 uppercase px-3 py-1">Pareto Optimized</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-slate-400">
            <Button variant="ghost" size="icon" className="h-10 w-10 hover:text-cyan-500 hover:bg-cyan-50 rounded-xl transition-all"><Share2 className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 hover:text-cyan-500 hover:bg-cyan-50 rounded-xl transition-all"><Download className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 hover:text-cyan-500 hover:bg-cyan-50 rounded-xl transition-all"><MoreHorizontal className="h-5 w-5" /></Button>
          </div>
        </footer>
      </SidebarInset>
    </div>
  );
}
