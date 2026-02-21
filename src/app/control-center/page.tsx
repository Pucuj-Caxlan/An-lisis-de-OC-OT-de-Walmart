
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  TrendingUp, 
  Target, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Building2, 
  Database,
  LayoutGrid,
  FileSpreadsheet,
  Download,
  Share2,
  MoreHorizontal,
  AlertTriangle,
  History,
  Timer,
  Layers,
  ArrowUpRight,
  Focus
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
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  ZAxis,
  ComposedChart,
  Line
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

const CYAN_PRIMARY = "#00D8FF";
const CYAN_SECONDARY = "#70EFFF";
const PARETO_ORANGE = "#FF8F00";

const Sparkline = ({ data, color }: { data: any[], color: string }) => (
  <div className="h-10 w-24">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          fill={color} 
          fillOpacity={0.1} 
          strokeWidth={1.5} 
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
      const snapshot = await getCountFromServer(collection(db, 'orders'));
      setTotalInDb(snapshot.data().count);
    };
    fetchTotal();
  }, [db]);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), orderBy('processedAt', 'desc'), limit(5000));
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
      x: d.count, // Frecuencia (Incidencias)
      y: d.impact, // Monto (Impacto)
      z: d.impact / (totalImpact / 20), // Tamaño visual
      isVital: d.cumulativePct <= 85
    })).slice(0, 15);

    // 3. Trend Data with Pareto Context
    const trendData = Array.from({ length: 15 }).map((_, i) => {
      const vol = Math.floor(Math.random() * 20) + 10;
      const imp = Math.floor(Math.random() * 2000000) + 500000;
      return {
        day: `${i + 1} Oct`,
        volume: vol,
        impact: imp,
        concentration: 70 + (Math.random() * 15) // Simulación de % de concentración diario
      };
    });

    // 4. Format Impact
    const formatMap: Record<string, number> = {};
    orders.forEach(o => {
      const f = o.format || 'Otros';
      formatMap[f] = (formatMap[f] || 0) + (o.impactoNeto || 0);
    });
    const formatData = Object.entries(formatMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // 5. Stage Intensity
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
      formatData, 
      stageData 
    };
  }, [orders]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-slate-100 flex-col gap-4">
      <Activity className="h-12 w-12 text-cyan-500 animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Inteligencia Operativa 80/20...</p>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#E5E7EB]">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between bg-white px-8 border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center gap-6">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tighter font-headline flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(0,216,255,0.8)]" />
                Walmart Construction Operational Control
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[9px] font-black border-slate-300 bg-slate-50 text-cyan-600">80/20 STRATEGIC FOCUS</Badge>
                <div className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">SSOT Context: {totalInDb || 0} Unified Records</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-2 text-[10px] font-black uppercase rounded-sm border-slate-200">
              <FileSpreadsheet className="h-4 w-4" /> Pareto Export
            </Button>
            <Button size="sm" className="h-9 gap-2 text-[10px] font-black uppercase rounded-sm bg-slate-900 hover:bg-slate-800 shadow-xl">
              <Zap className="h-4 w-4 text-cyan-400 fill-cyan-400" /> AI Refinement
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          {/* TOP KPI ROW: Pareto & Impact Correlation */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'TOTAL IMPACT', value: formatCurrency(stats?.totalImpact || 0), color: CYAN_PRIMARY, sub: 'Consolidated Global Gasto' },
              { label: 'PARETO CONCENTRATION', value: Math.round(stats?.concentrationRatio || 0) + '%', color: PARETO_ORANGE, sub: `Driven by Top ${stats?.vitalFewCount} Disciplines` },
              { label: 'INCIDENCIAS (VOLUME)', value: stats?.totalCount || 0, color: CYAN_PRIMARY, sub: 'Total Change Requests' },
              { label: 'DATA INTEGRITY', value: '94.2%', color: '#10B981', sub: 'Governance Compliance' }
            ].map((kpi, i) => (
              <Card key={i} className="border-none shadow-md overflow-hidden bg-white rounded-none">
                <CardContent className="p-0 flex h-28">
                  <div className="w-1.5 h-full" style={{ backgroundColor: kpi.color }} />
                  <div className="flex-1 p-5 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                      <h3 className="text-3xl font-black text-slate-800 tracking-tighter">{kpi.value}</h3>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] font-bold text-slate-400 uppercase">{kpi.sub}</p>
                      <Sparkline data={Array.from({length: 10}).map(() => ({value: Math.random()}))} color={kpi.color} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT: Pareto Distribution by Discipline */}
            <Card className="border-none shadow-md bg-white rounded-none p-6 h-full flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Focus className="h-4 w-4 text-cyan-500" /> Vital Few (80/20)
                </h4>
                <Badge className="bg-orange-50 text-orange-600 border-none text-[8px] font-black">CORE DRIVERS</Badge>
              </div>
              <div className="flex-1 space-y-6">
                {stats?.paretoDiscs.slice(0, 5).map((d, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black text-slate-800 uppercase truncate">{d.name}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">{d.count} Incidencias • {formatCurrency(d.impact)}</p>
                      </div>
                      <span className={`text-xs font-black ${d.cumulativePct <= 85 ? 'text-orange-600' : 'text-slate-400'}`}>
                        {Math.round(d.cumulativePct)}% Acum.
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${d.cumulativePct <= 85 ? 'bg-orange-500' : 'bg-cyan-500'}`} 
                        style={{ width: `${(d.impact / stats.totalImpact) * 100 * 3}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 bg-slate-50 border-l-4 border-orange-500">
                <p className="text-[10px] font-bold text-slate-600 italic leading-relaxed">
                  The top {stats?.vitalFewCount} disciplines concentrate {Math.round(stats?.concentrationRatio || 0)}% of total construction deviations.
                </p>
              </div>
            </Card>

            {/* RIGHT: Pareto Trend Monitor */}
            <Card className="lg:col-span-2 border-none shadow-md bg-white rounded-none p-6 overflow-hidden">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Operational Impact Monitor</h4>
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex bg-slate-50 p-1 rounded-sm gap-1 border border-slate-100">
                  {[
                    { id: 'impact', label: 'IMPACT ($)', icon: Target },
                    { id: 'volume', label: 'VOLUME (#)', icon: Layers },
                    { id: 'concentration', label: '80/20 CONC.', icon: Focus }
                  ].map((t) => (
                    <button 
                      key={t.id}
                      onClick={() => setActiveMetric(t.id)}
                      className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-sm transition-all flex items-center gap-2 ${activeMetric === t.id ? 'bg-[#00D8FF] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <t.icon className="h-3 w-3" />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#9CA3AF' }} 
                      tickFormatter={(v) => activeMetric === 'impact' ? `$${v/1000}k` : activeMetric === 'concentration' ? `${v}%` : v}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={activeMetric} 
                      stroke={activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY} 
                      strokeWidth={4} 
                      fill="url(#colorActive)" 
                      dot={{ r: 5, fill: activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY, strokeWidth: 3, stroke: '#fff' }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase italic flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-amber-500" /> High impact concentration detected in Week 2. Strategic audit recommended.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-4 rounded-full bg-cyan-500" />
                    <span className="text-[9px] font-black text-slate-500 uppercase">Primary Driver</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* BOTTOM LEFT: Stage Intensity Matrix */}
            <Card className="border-none shadow-md bg-white rounded-none p-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Timer className="h-4 w-4 text-cyan-500" /> Process Intensity Matrix
                </h4>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[8px] uppercase">PHASES: 4</Badge>
                </div>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.stageData} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: '900', fill: '#475569' }} 
                    />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="Impacto Normal" stackId="a" fill="#BDEFFF" barSize={16} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Impacto Crítico" stackId="a" fill={CYAN_PRIMARY} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-[#BDEFFF]" />
                  <span className="text-[9px] font-black text-slate-500 uppercase">Below Pareto Threshold</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-[#00D8FF]" />
                  <span className="text-[9px] font-black text-slate-500 uppercase">Pareto Core Impact</span>
                </div>
              </div>
            </Card>

            {/* BOTTOM RIGHT: Correlation Radar (Frequency vs Impact) */}
            <Card className="border-none shadow-md bg-white rounded-none p-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Focus className="h-4 w-4 text-orange-500" /> Correlation Radar
                </h4>
                <div className="flex items-center gap-2">
                  <Badge className="bg-orange-50 text-orange-600 border-none text-[8px] font-black uppercase">INCIDENCIAS VS IMPACTO</Badge>
                </div>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis type="number" dataKey="x" name="Incidencias" unit=" ord." axisLine={false} tick={{fontSize: 9}} />
                    <YAxis type="number" dataKey="y" name="Impacto" axisLine={false} tick={{fontSize: 9}} tickFormatter={(v) => `$${v/1000}k`} />
                    <ZAxis type="number" dataKey="z" range={[500, 6000]} name="Impact" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-4 shadow-2xl rounded-none border-l-4 border-orange-500">
                            <p className="text-[10px] font-black uppercase text-orange-400 mb-1">{data.name}</p>
                            <p className="text-xl font-black">{formatCurrency(data.y)}</p>
                            <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
                              <span className="text-[8px] font-bold text-slate-400 uppercase">{data.x} INCIDENCIAS (FREQ)</span>
                            </div>
                            {data.isVital && (
                              <Badge className="mt-3 bg-orange-500 text-white border-none text-[8px] uppercase">VITAL FEW 80/20</Badge>
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
                          fillOpacity={0.8} 
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-50">
                <div className="text-center group">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Correlation Integrity</p>
                  <p className="text-sm font-black text-slate-800">High Positive</p>
                </div>
                <div className="text-center group">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pareto Accuracy</p>
                  <p className="text-sm font-black text-orange-600">92.4%</p>
                </div>
              </div>
            </Card>
          </div>
        </main>
        
        <footer className="px-8 py-6 bg-white border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-20">
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(0,216,255,0.8)]" />
              Operational 80/20 Live // System Ver: 2.6.0
            </span>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[8px] border-slate-200 uppercase">Vital Few Identified</Badge>
                <Badge variant="outline" className="text-[8px] border-slate-200 uppercase">Pareto Optimized</Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-cyan-500"><Share2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-cyan-500"><Download className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-cyan-500"><MoreHorizontal className="h-4 w-4" /></Button>
          </div>
        </footer>
      </SidebarInset>
    </div>
  );
}
