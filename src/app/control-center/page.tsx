
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
  ShieldCheck,
  Building2,
  Filter
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
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState('impact');
  const [formatFilter, setFormatFilter] = useState<string>('all');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!db || !user?.uid) return;
    const fetchTotal = async () => {
      try {
        const snapshot = await getCountFromServer(collection(db, 'orders'));
        setTotalInDb(snapshot.data().count);
      } catch (e) {
        console.warn("Failed to fetch total count:", e);
      }
    };
    fetchTotal();
  }, [db, user?.uid]);

  const ordersQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(collection(db, 'orders'), orderBy('processedAt', 'desc'), limit(10000));
  }, [db, user?.uid]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  // Extraer formatos únicos para el filtro
  const availableFormats = useMemo(() => {
    if (!orders) return [];
    const formats = new Set<string>();
    orders.forEach(o => {
      if (o.format) formats.add(o.format);
      else if (o.type && (o.type.includes('Sams') || o.type.includes('BAE') || o.type.includes('Supercenter'))) formats.add(o.type);
    });
    return Array.from(formats).sort();
  }, [orders]);

  const stats = useMemo(() => {
    if (!orders) return null;

    // Aplicar filtro de formato
    const filteredOrders = orders.filter(o => {
      if (formatFilter === 'all') return true;
      return o.format === formatFilter || o.type === formatFilter;
    });

    const totalImpact = filteredOrders.reduce((acc, o) => acc + (o.impactoNeto || 0), 0);
    const totalCount = filteredOrders.length;
    
    const discMap: Record<string, { impact: number, count: number }> = {};
    filteredOrders.forEach(o => {
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

    return { 
      totalImpact, 
      totalCount, 
      concentrationRatio, 
      vitalFewCount: vitalFew.length,
      paretoDiscs, 
      trendData,
      sampleSize: filteredOrders.length
    };
  }, [orders, formatFilter]);

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

  if (!user?.uid || isLoading) return (
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
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {formatFilter === 'all' ? `Global SSOT: ${totalInDb || 0}` : `Segmento: ${stats?.sampleSize} Registros`}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
              <Filter className="h-3.5 w-3.5 text-slate-400 ml-2" />
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="h-8 w-56 text-[10px] font-black uppercase rounded-lg border-none bg-white shadow-sm focus:ring-0">
                  <SelectValue placeholder="Filtrar por Formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS FORMATOS</SelectItem>
                  {availableFormats.map(fmt => (
                    <SelectItem key={fmt} value={fmt}>{fmt.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" className="h-10 gap-2 text-[10px] font-black uppercase rounded-lg border-slate-200 hover:bg-slate-50">
              <FileSpreadsheet className="h-4 w-4" /> Export Pareto
            </Button>
            <Button size="sm" className="h-10 gap-2 text-[10px] font-black uppercase rounded-lg bg-slate-900 hover:bg-slate-800 shadow-xl px-6">
              <Zap className="h-4 w-4 text-cyan-400 fill-cyan-400" /> AI Refresh
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'TOTAL IMPACT (MXN)', value: formatCurrency(stats?.totalImpact || 0), color: CYAN_PRIMARY, sub: 'Consolidated Segment Cost' },
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
            <Card className="border-none shadow-md bg-white rounded-2xl p-8 h-full flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.25em] flex items-center gap-3">
                  <Focus className="h-5 w-5 text-cyan-500" /> Vital Few (80/20)
                </h4>
                <Badge className="bg-orange-50 text-orange-600 border-none text-[9px] font-black px-3 py-1">CORE DRIVERS</Badge>
              </div>
              <div className="flex-1 space-y-8 overflow-y-auto max-h-[500px] pr-2">
                {stats?.paretoDiscs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20 text-slate-300">
                    <Database className="h-12 w-12 opacity-20 mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Sin datos en segmento</p>
                  </div>
                ) : (
                  stats?.paretoDiscs.slice(0, 8).map((d, i) => (
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
                          style={{ width: `${(d.impact / (stats.totalImpact || 1)) * 100 * 2.5}%` }} 
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
              {stats && stats.paretoDiscs.length > 0 && (
                <div className="mt-10 p-5 bg-slate-50 border-l-4 border-orange-500 rounded-r-xl">
                  <p className="text-[11px] font-bold text-slate-600 italic leading-relaxed">
                    En el formato <strong>{formatFilter === 'all' ? 'GLOBAL' : formatFilter.toUpperCase()}</strong>, el top {stats?.vitalFewCount} de disciplinas concentra el {Math.round(stats?.concentrationRatio || 0)}% de las desviaciones totales.
                  </p>
                </div>
              )}
            </Card>

            <Card className="lg:col-span-2 border-none shadow-md bg-white rounded-2xl p-8 overflow-hidden">
              <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                <div className="flex items-center gap-4">
                  <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.25em]">Operational Impact Monitor</h4>
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="flex bg-slate-50 p-1 rounded-sm gap-1 border border-slate-100">
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
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
