
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
  Layers
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
  ZAxis
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const CYAN_PRIMARY = "#00D8FF";
const CYAN_SECONDARY = "#70EFFF";
const NEUTRAL_GREY = "#F3F4F6";

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
  const [activeMetric, setActiveMetric] = useState('volume');

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
    const avgTicket = orders.length > 0 ? totalImpact / orders.length : 0;
    
    // Efficiency Calculation: Days between request and processing
    const processTimes = orders.map(o => {
      const start = new Date(o.fechaSolicitud || o.processedAt).getTime();
      const end = new Date(o.processedAt).getTime();
      return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    });
    const avgLeadTime = processTimes.reduce((a, b) => a + b, 0) / (processTimes.length || 1);

    // Compliance: Weights based on signatures and completeness
    const complianceWeights = orders.map(o => {
      let score = 0;
      if (o.isSigned) score += 6;
      if (o.semanticAnalysis) score += 2;
      if (o.envelopeId) score += 2;
      return score;
    });
    const avgCompliance = complianceWeights.reduce((a, b) => a + b, 0) / (complianceWeights.length || 1);
    
    const trendData = Array.from({ length: 20 }).map((_, i) => ({
      day: `${i + 1} oct.`,
      volume: Math.floor(Math.random() * 15) + 5,
      impact: Math.floor(Math.random() * 1000000) + 200000,
      velocity: Math.floor(Math.random() * 40) + 10,
      compliance: Math.floor(Math.random() * 3) + 7
    }));

    const formatMap: Record<string, number> = {};
    orders.forEach(o => {
      const f = o.format || 'Otros';
      formatMap[f] = (formatMap[f] || 0) + 1;
    });
    const formatData = Object.entries(formatMap).map(([name, value]) => ({ name, value }));

    const stages = ['Diseño', 'Construcción', 'Equipamiento', 'Cierre'];
    const stageData = stages.map(s => ({
      name: s,
      'Normal': Math.floor(Math.random() * 20),
      'Urgente': Math.floor(Math.random() * 15),
      'Crítico': Math.floor(Math.random() * 10),
      'Sin Firma': Math.floor(Math.random() * 5),
    }));

    const disciplineMap: Record<string, { impact: number, count: number }> = {};
    orders.forEach(o => {
      const d = o.disciplina_normalizada || 'Otros';
      if (!disciplineMap[d]) disciplineMap[d] = { impact: 0, count: 0 };
      disciplineMap[d].impact += (o.impactoNeto || 0);
      disciplineMap[d].count += 1;
    });
    const bubbleData = Object.entries(disciplineMap).map(([name, s]) => ({
      name,
      x: s.count, // Frecuencia
      y: Math.random() * 100, // Riesgo aleatorio para distribución
      z: s.impact / 50000, // Tamaño por impacto
      impact: s.impact
    })).slice(0, 12);

    return { totalImpact, avgTicket, avgLeadTime, avgCompliance, trendData, formatData, stageData, bubbleData };
  }, [orders]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-slate-100 flex-col gap-4">
      <Activity className="h-12 w-12 text-cyan-500 animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Centro de Control...</p>
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
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Walmart Construction Operational Control
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[9px] font-black border-slate-300 bg-slate-50">SITUATION ROOM LIVE</Badge>
                <div className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Universo: {totalInDb || 0} Registros Auditados</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-2 text-[10px] font-black uppercase rounded-sm border-slate-200">
              <FileSpreadsheet className="h-4 w-4" /> Export Report
            </Button>
            <Button size="sm" className="h-9 gap-2 text-[10px] font-black uppercase rounded-sm bg-slate-900 hover:bg-slate-800 shadow-xl">
              <Zap className="h-4 w-4 text-cyan-400 fill-cyan-400" /> Real-Time Sync
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          {/* TOP KPI ROW: Operational Efficiency Focus */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'N° OF ORDERS', value: orders?.length || 0, color: CYAN_PRIMARY, sub: 'Total Volume Loaded' },
              { label: 'AVG IMPACT (MXN)', value: formatCurrency(stats?.avgTicket || 0), color: CYAN_PRIMARY, sub: 'Per Deviation Request' },
              { label: 'PROCESS TIME', value: Math.round(stats?.avgLeadTime || 0) + ' DAYS', color: CYAN_PRIMARY, sub: 'Solicitation to Approval' },
              { label: 'COMPLIANCE HEALTH', value: (stats?.avgCompliance || 0).toFixed(1) + '/10', color: '#FFB800', sub: 'Governance Integrity' }
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
            {/* LEFT: Store Format Impact Distribution */}
            <Card className="border-none shadow-md bg-white rounded-none p-6 h-full flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-cyan-500" /> By Store Format
                </h4>
                <Badge className="bg-cyan-50 text-cyan-600 border-none text-[8px] font-black">7 REGIONS</Badge>
              </div>
              <div className="flex-1 relative min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.formatData}
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={8}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {stats?.formatData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? CYAN_PRIMARY : '#BDEFFF'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <p className="text-3xl font-black text-slate-800">58%</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Supercenter<br/>Dominance</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-50">
                {stats?.formatData.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: i === 0 ? CYAN_PRIMARY : '#BDEFFF' }} />
                      <span className="text-[9px] font-black text-slate-500 uppercase truncate">{f.name}</span>
                    </div>
                    <span className="text-xs font-black text-slate-800 pl-4">{f.value} orders</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* RIGHT: Operational Trend Analysis */}
            <Card className="lg:col-span-2 border-none shadow-md bg-white rounded-none p-6 overflow-hidden">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Operational Trend Monitor</h4>
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex bg-slate-50 p-1 rounded-sm gap-1 border border-slate-100">
                  {[
                    { id: 'volume', label: 'VOLUME', icon: Layers },
                    { id: 'impact', label: 'IMPACT', icon: Target },
                    { id: 'velocity', label: 'VELOCITY', icon: Timer },
                    { id: 'compliance', label: 'HEALTH', icon: ShieldCheck }
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
                        <stop offset="5%" stopColor={CYAN_PRIMARY} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={CYAN_PRIMARY} stopOpacity={0}/>
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
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={activeMetric} 
                      stroke={CYAN_PRIMARY} 
                      strokeWidth={4} 
                      fill="url(#colorActive)" 
                      dot={{ r: 5, fill: CYAN_PRIMARY, strokeWidth: 3, stroke: '#fff' }}
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex justify-between items-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase italic flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-amber-500" /> Current trend suggests a 12% increase in process velocity over the last 7 days.
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-4 rounded-full bg-cyan-500" />
                    <span className="text-[9px] font-black text-slate-500 uppercase">Primary Metric</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* BOTTOM LEFT: Intensity by Stage & Deviation Severity */}
            <Card className="border-none shadow-md bg-white rounded-none p-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Clock className="h-4 w-4 text-cyan-500" /> Process Intensity Matrix
                </h4>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-[8px] uppercase">STAGES: 4</Badge>
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
                    <Bar dataKey="Normal" stackId="a" fill="#BDEFFF" barSize={16} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Urgente" stackId="a" fill="#70EFFF" />
                    <Bar dataKey="Crítico" stackId="a" fill="#00D8FF" />
                    <Bar dataKey="Sin Firma" stackId="a" fill="#00B8D4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-6 pt-4 border-t border-slate-50">
                {['Normal', 'Urgente', 'Crítico', 'Sin Firma'].map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: [ '#BDEFFF', '#70EFFF', '#00D8FF', '#00B8D4' ][i] }} />
                    <span className="text-[9px] font-black text-slate-500 uppercase">{label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* BOTTOM RIGHT: Discipline Risk Benchmarking (Bubble Chart) */}
            <Card className="border-none shadow-md bg-white rounded-none p-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-500" /> Discipline Risk Radar
                </h4>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-50 text-emerald-600 border-none text-[8px] font-black uppercase">Low Volatility</Badge>
                </div>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis type="number" dataKey="x" name="Frequency" unit=" orders" hide />
                    <YAxis type="number" dataKey="y" name="Risk level" hide />
                    <ZAxis type="number" dataKey="z" range={[500, 6000]} name="Impact" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-4 shadow-2xl rounded-none border-l-4 border-cyan-400">
                            <p className="text-[10px] font-black uppercase text-cyan-400 mb-1">{data.name}</p>
                            <p className="text-xl font-black">{formatCurrency(data.impact)}</p>
                            <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
                              <span className="text-[8px] font-bold text-slate-400 uppercase">{data.x} REQUESTS TOTAL</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Scatter name="Disciplines" data={stats?.bubbleData} fill={CYAN_PRIMARY}>
                      {stats?.bubbleData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? CYAN_PRIMARY : CYAN_SECONDARY} fillOpacity={0.8} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-50">
                {stats?.bubbleData.slice(0, 4).map((d, i) => (
                  <div key={i} className="text-center group cursor-help">
                    <p className="text-[9px] font-black text-slate-400 uppercase truncate mb-1">{d.name}</p>
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="h-1 w-1 rounded-full bg-cyan-500" />
                      <p className="text-xs font-black text-slate-800">{Math.round(d.z / 100)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </main>
        
        <footer className="px-8 py-6 bg-white border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-20">
          <div className="flex items-center gap-6">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(0,216,255,0.8)]" />
              Operational Control Live Feed // System Ver: 2.5.4
            </span>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[8px] border-slate-200">DB: FIREBASE CLOUD</Badge>
                <Badge variant="outline" className="text-[8px] border-slate-200">AI: GEMINI FLASH</Badge>
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
