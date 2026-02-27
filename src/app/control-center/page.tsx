
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Target, 
  Zap, 
  Database,
  Layers,
  Focus,
  Filter,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  SearchCode,
  AlertTriangle,
  HardHat,
  FileWarning
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from '@/components/ui/progress';

const CYAN_PRIMARY = "#00D8FF";
const PARETO_ORANGE = "#FF8F00";
const ROSE_AUDIT = "#E11D48";

type SpotlightType = 'omissions' | 'scope' | 'compliance' | 'prototype' | 'site_findings';

const SPOTLIGHT_CONFIG = {
  omissions: { label: 'ERRORES / OMISIONES', keywords: ['omisión', 'omision', 'error', 'catalogo'], icon: FileWarning },
  scope: { label: 'ALTA DE ALCANCE', keywords: ['alcance', 'adicional', 'extra', 'scope'], icon: SearchCode },
  compliance: { label: 'CUMPLIMIENTO & AUTORIDAD', keywords: ['cumplimiento', 'autoridad', 'legal', 'permiso'], icon: ShieldAlert },
  prototype: { label: 'ACTUALIZACIÓN PROTOTIPO', keywords: ['prototipo', 'actualización', 'version', 'estandar'], icon: HardHat },
  site_findings: { label: 'IMPREVISTOS EN SITIO', keywords: ['sitio', 'subsuelo', 'roca', 'freático', 'hallazgo'], icon: AlertTriangle }
};

// Función de normalización institucional de formatos - ELIMINADO 'OTROS'
const normalizeFormatName = (name: any) => {
  if (!name) return 'FORMATO NO ESPECIFICADO';
  const n = String(name).trim().toUpperCase();
  
  if (n.includes('MI BODEGA') || n === 'MBA') return 'MI BODEGA AURRERA';
  if (n.includes('EXPRESS') && (n.includes('BODEGA') || n.includes('BA'))) return 'BODEGA AURRERA EXPRESS';
  if (n === 'BODEGA AURRERA' || n === 'BAE' || n === 'BODEGA' || n === 'AURRERA' || n === 'BA') return 'BODEGA AURRERA';
  if (n.includes('SAMS') || n.includes("SAM'S")) return "SAM'S CLUB";
  if (n.includes('SUPERCENTER') || n.includes('WALMART SC') || n === 'SC' || n === 'WS') return 'WALMART SUPERCENTER';
  if (n.includes('EXPRESS') || n.includes('SUPERAMA')) return 'WALMART EXPRESS';
  if (n.includes('WALMART')) return 'WALMART SUPERCENTER';
  
  return n;
};

export default function ControlCenterPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState('impact');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [activeSpotlight, setActiveSpotlight] = useState<SpotlightType>('omissions');

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

  const availableFormats = useMemo(() => {
    if (!orders) return [];
    const formats = new Set<string>();
    orders.forEach(o => {
      const raw = o.format || o.type || 'FORMATO NO ESPECIFICADO';
      formats.add(normalizeFormatName(raw));
    });
    return Array.from(formats).sort();
  }, [orders]);

  const stats = useMemo(() => {
    if (!orders) return null;

    const filteredOrders = orders.filter(o => {
      if (formatFilter === 'all') return true;
      const normalizedRowFormat = normalizeFormatName(o.format || o.type);
      return normalizedRowFormat === formatFilter;
    });

    const totalImpact = filteredOrders.reduce((acc, o) => acc + (o.impactoNeto || 0), 0);
    const totalCount = filteredOrders.length;
    
    // 1. Análisis Pareto por Disciplina y Sub-disciplina
    const discMap: Record<string, { impact: number, count: number, subs: Record<string, number> }> = {};
    filteredOrders.forEach(o => {
      const d = o.disciplina_normalizada || 'Indefinida';
      const s = o.subcausa_normalizada || 'Sin sub-disciplina';
      if (!discMap[d]) discMap[d] = { impact: 0, count: 0, subs: {} };
      discMap[d].impact += (o.impactoNeto || 0);
      discMap[d].count += 1;
      discMap[d].subs[s] = (discMap[d].subs[s] || 0) + (o.impactoNeto || 0);
    });

    const sortedDiscs = Object.entries(discMap)
      .map(([name, s]) => {
        const topSub = Object.entries(s.subs).sort((a, b) => b[1] - a[1])[0];
        return { 
          name, 
          impact: s.impact, 
          count: s.count, 
          topSubName: topSub?.[0], 
          topSubImpact: topSub?.[1] 
        };
      })
      .sort((a, b) => b.impact - a.impact);

    let cumulative = 0;
    const paretoDiscs = sortedDiscs.map(d => {
      cumulative += d.impact;
      return {
        ...d,
        cumulativePct: totalImpact > 0 ? (cumulative / totalImpact) * 100 : 0
      };
    });

    // 2. Inteligencia Dinámica de Spotlight por Formato (Unificado)
    const spotlightMap: Record<string, number> = {};
    const currentSpotlightConfig = SPOTLIGHT_CONFIG[activeSpotlight];
    
    filteredOrders.forEach(o => {
      const cause = (o.causa_raiz_normalizada || "").toLowerCase();
      const desc = (o.descripcion || "").toLowerCase();
      
      const isMatch = currentSpotlightConfig.keywords.some(k => cause.includes(k) || desc.includes(k));
      
      if (isMatch) {
        const formatKey = normalizeFormatName(o.format || o.type);
        spotlightMap[formatKey] = (spotlightMap[formatKey] || 0) + (o.impactoNeto || 0);
      }
    });

    const spotlightByFormat = Object.entries(spotlightMap)
      .map(([name, impact]) => ({ name, impact }))
      .sort((a, b) => b.impact - a.impact);

    const vitalFew = paretoDiscs.filter(d => d.cumulativePct <= 85);
    const concentrationRatio = totalImpact > 0 ? (vitalFew.reduce((a, b) => a + b.impact, 0) / totalImpact) * 100 : 0;

    const trendData = Array.from({ length: 15 }).map((_, i) => ({
      day: `${i + 1} Oct`,
      volume: Math.floor(Math.random() * 20) + 10,
      impact: Math.floor(Math.random() * 2000000) + 500000,
      concentration: 70 + (Math.random() * 15)
    }));

    return { 
      totalImpact, 
      totalCount, 
      concentrationRatio, 
      vitalFewCount: vitalFew.length,
      paretoDiscs, 
      spotlightByFormat,
      trendData,
      sampleSize: filteredOrders.length
    };
  }, [orders, formatFilter, activeSpotlight]);

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
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Analizando Pareto 80/20 por Formato...</p>
    </div>
  );

  const CurrentSpotlightIcon = SPOTLIGHT_CONFIG[activeSpotlight].icon;

  return (
    <div className="flex min-h-screen w-full bg-[#F8FAFC]">
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
                <Badge className="bg-cyan-50 text-cyan-700 border-cyan-100 text-[9px] font-black px-2 py-0">GOVERNANCE ENGINE 2.5</Badge>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {formatFilter === 'all' ? `Universo Total: ${totalInDb || 0}` : `Segmento ${formatFilter}: ${stats?.sampleSize} Reg.`}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
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
            <Button size="sm" className="h-10 gap-2 text-[10px] font-black uppercase rounded-lg bg-slate-900 hover:bg-slate-800 shadow-xl px-6">
              <Zap className="h-4 w-4 text-cyan-400 fill-cyan-400" /> IA Deep Scan
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl transition-all hover:shadow-lg">
              <CardContent className="p-0 flex h-32">
                <div className="w-2 h-full bg-[#00D8FF]" />
                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TOTAL SEGMENT IMPACT</p>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter font-headline">{formatCurrency(stats?.totalImpact || 0)}</h3>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Impacto Neto Acumulado</p>
                </div>
              </CardContent>
            </Card>

            <Card 
              onClick={() => router.push('/analysis')}
              className="border-none shadow-md overflow-hidden bg-white rounded-2xl transition-all hover:shadow-lg cursor-pointer group"
            >
              <CardContent className="p-0 flex h-32">
                <div className="w-2 h-full bg-[#FF8F00]" />
                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">PARETO CONCENTRATION</p>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tighter font-headline">{(stats?.concentrationRatio || 0).toFixed(1)}%</h3>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-[9px] font-bold text-orange-600 uppercase tracking-tight flex items-center gap-1">
                    Click para ver detalles <Target className="h-2.5 w-2.5" />
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl transition-all hover:shadow-lg">
              <CardContent className="p-0 flex h-32">
                <div className="w-2 h-full bg-[#E11D48]" />
                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">RECURRENT FAILURES</p>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter font-headline">{stats?.totalCount || 0}</h3>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Órdenes de Cambio</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl transition-all hover:shadow-lg">
              <CardContent className="p-0 flex h-32">
                <div className="w-2 h-full bg-[#E11D48]" />
                <div className="flex-1 p-6 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SPOTLIGHT IMPACT</p>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter font-headline">{formatCurrency(stats?.spotlightByFormat.reduce((a,b) => a + b.impact, 0) || 0)}</h3>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Análisis: {SPOTLIGHT_CONFIG[activeSpotlight].label}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="border-none shadow-md bg-white rounded-3xl p-8 h-full flex flex-col">
              <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.25em] flex items-center gap-3">
                  <Focus className="h-5 w-5 text-cyan-500" /> Vital Few & Sub-Drivers
                </h4>
                <Badge className="bg-orange-50 text-orange-600 border-none text-[9px] font-black px-3 py-1 uppercase">80/20 Traceability</Badge>
              </div>
              <div className="flex-1 space-y-8 overflow-y-auto max-h-[600px] pr-2 scrollbar-hide">
                {stats?.paretoDiscs.map((d, i) => (
                  <div key={i} className="group cursor-default">
                    <div className="flex justify-between items-start mb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{d.name}</p>
                          {d.cumulativePct <= 85 && <TrendingDown className="h-3 w-3 text-orange-500" />}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-2.5 w-2.5 text-slate-300" />
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Falla Crítica: <span className="text-slate-600 italic">{d.topSubName}</span></p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[11px] font-black ${d.cumulativePct <= 85 ? 'text-orange-600' : 'text-slate-400'}`}>
                          {formatCompactCurrency(d.impact)}
                        </span>
                        <p className="text-[8px] font-bold text-slate-300 uppercase">{Math.round(d.cumulativePct)}% Acum.</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${d.cumulativePct <= 85 ? 'bg-orange-500 shadow-[0_0_8px_rgba(255,143,0,0.3)]' : 'bg-cyan-500'}`} 
                        style={{ width: `${(d.impact / (stats.totalImpact || 1)) * 100 * 2}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="lg:col-span-2 space-y-8">
              <Card className="border-none shadow-md bg-slate-900 rounded-3xl p-8 overflow-hidden text-white">
                <div className="flex justify-between items-center mb-8">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CurrentSpotlightIcon className="h-5 w-5 text-rose-500" />
                      <h4 className="text-[12px] font-black uppercase tracking-[0.25em]">Audit Spotlight: Hallazgos Recurrentes</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={activeSpotlight} onValueChange={(v) => setActiveSpotlight(v as SpotlightType)}>
                        <SelectTrigger className="h-9 w-72 text-[10px] font-black uppercase rounded-lg border-white/10 bg-white/5 shadow-sm text-white focus:ring-accent">
                          <SelectValue placeholder="Seleccionar Tipo de Auditoría" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white">
                          {Object.entries(SPOTLIGHT_CONFIG).map(([key, config]) => (
                            <SelectItem key={key} value={key} className="text-[10px] font-black uppercase hover:bg-white/10 focus:bg-white/10">
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[9px] text-slate-400 font-bold uppercase ml-4">Impacto por Formato (MXN)</p>
                    </div>
                  </div>
                  <Badge className="bg-rose-500 text-white border-none text-[10px] font-black px-4 py-1 animate-pulse uppercase">Critical Audit</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats?.spotlightByFormat}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="impact"
                        >
                          {stats?.spotlightByFormat.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={[CYAN_PRIMARY, PARETO_ORANGE, '#10B981', '#6366F1', '#A855F7'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0F172A', border: 'none', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '10px', fontWeight: '900', color: '#fff' }}
                          formatter={(v: number) => formatCurrency(v)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-4">
                    {stats?.spotlightByFormat.length === 0 ? (
                      <div className="text-center py-10 opacity-30">
                        <p className="text-[10px] font-black uppercase">Sin registros en este spotlight</p>
                      </div>
                    ) : stats?.spotlightByFormat.slice(0, 5).map((b, i) => (
                      <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">{b.name}</span>
                          <span className="text-[11px] font-black">{formatCurrency(b.impact)}</span>
                        </div>
                        <Progress value={(b.impact / (stats.totalImpact || 1)) * 100 * 5} className="h-1 bg-white/5" />
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="border-none shadow-md bg-white rounded-3xl p-8 overflow-hidden">
                <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                  <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.25em]">Operational Impact Monitor</h4>
                  <div className="flex bg-slate-50 p-1 rounded-sm gap-1">
                    {['volume', 'impact', 'concentration'].map((t) => (
                      <button 
                        key={t}
                        onClick={() => setActiveMetric(t)}
                        className={`px-5 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${activeMetric === t ? 'bg-[#00D8FF] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {t === 'concentration' ? '80/20 CONC.' : t.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY} stopOpacity={0.2}/>
                          <stop offset="95%" stopColor={activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} />
                      <YAxis 
                        axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} 
                        tickFormatter={(v) => activeMetric === 'impact' ? formatCompactCurrency(v) : activeMetric === 'concentration' ? `${v}%` : v}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#0F172A', color: '#fff', padding: '16px' }}
                        itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: '#00D8FF' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey={activeMetric} 
                        stroke={activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY} 
                        strokeWidth={4} 
                        fill="url(#colorMetric)" 
                        dot={{ r: 4, fill: '#fff', strokeWidth: 2, stroke: activeMetric === 'concentration' ? PARETO_ORANGE : CYAN_PRIMARY }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
