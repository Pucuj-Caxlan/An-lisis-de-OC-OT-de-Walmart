
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Target, 
  Zap, 
  TrendingUp,
  Focus,
  Filter,
  X,
  CalendarDays,
  User,
  Layout,
  Loader2,
  Package,
  Layers,
  BarChart3,
  ChevronRight,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Presentation,
  Maximize2,
  Users,
  Search,
  History,
  FileText
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
  ComposedChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';

const CYAN_PRIMARY = "#2962FF";
const ACCENT_ORANGE = "#FF8F00";
const WALMART_BLUE = "#0071CE";

const SECTIONS = [
  { id: 'intro', label: '1. INTRODUCCIÓN' },
  { id: 'universe', label: '2. UNIVERSO' },
  { id: 'pareto-format', label: '3. PARETO FORMATOS' },
  { id: 'heatmap', label: '4. HEATMAP' },
  { id: 'root-cause', label: '5. CAUSA RAÍZ' },
  { id: 'coordinators', label: '6. COORDINADORES' },
  { id: 'trends', label: '7. TENDENCIA' },
  { id: 'core', label: '8. NÚCLEO CRÍTICO' },
  { id: 'action-plan', label: '9. PLAN DE ACCIÓN' },
  { id: 'impact', label: '10. IMPACTO ESPERADO' },
  { id: 'decision', label: '11. DECISION DASHBOARD' },
];

const MONTHS = [
  { id: 1, name: 'Enero' }, { id: 2, name: 'Febrero' }, { id: 3, name: 'Marzo' },
  { id: 4, name: 'Abril' }, { id: 5, name: 'Mayo' }, { id: 6, name: 'Junio' },
  { id: 7, name: 'Julio' }, { id: 8, name: 'Agosto' }, { id: 9, name: 'Septiembre' },
  { id: 10, name: 'Octubre' }, { id: 11, name: 'Noviembre' }, { id: 12, name: 'Diciembre' }
];

export default function ControlCenterPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('intro');
  
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2024);

  useEffect(() => { setMounted(true); }, []);

  const formatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('name')) : null, [db]);
  const { data: formatsDocs } = useCollection(formatsQuery);

  const analyticsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'hitos_analytics'), where('year', '==', selectedYear));
  }, [db, selectedYear]);

  const { data: analyticsEntries, isLoading } = useCollection(analyticsQuery);

  const stats = useMemo(() => {
    if (!analyticsEntries) return null;

    let totalImpact = 0;
    let totalOrders = 0;
    const formatMap: Record<string, any> = {};
    const disciplineMap: Record<string, any> = {};
    const causeMap: Record<string, any> = {};
    const coordMap: Record<string, any> = {};
    const monthlyTrend: Record<number, number> = {};

    analyticsEntries.forEach(entry => {
      totalImpact += entry.impact;
      totalOrders += entry.count;

      // Por Formato
      const fmt = entry.format || 'OTRO';
      if (!formatMap[fmt]) formatMap[fmt] = { name: fmt, impact: 0, count: 0, disciplines: {} };
      formatMap[fmt].impact += entry.impact;
      formatMap[fmt].count += entry.count;
      
      // Por Disciplina dentro de Formato
      const disc = entry.discipline || 'OTRO';
      if (!formatMap[fmt].disciplines[disc]) formatMap[fmt].disciplines[disc] = 0;
      formatMap[fmt].disciplines[disc] += entry.impact;

      // Global Disciplinas
      if (!disciplineMap[disc]) disciplineMap[disc] = { name: disc, impact: 0, count: 0 };
      disciplineMap[disc].impact += entry.impact;
      disciplineMap[disc].count += entry.count;

      // Por Causa Raíz (usando disciplina como proxy si no hay causa directa en este agregado)
      // Nota: En una versión futura hitos_analytics debería incluir causa_raiz
      const cause = entry.discipline; // Proxy
      if (!causeMap[cause]) causeMap[cause] = { name: cause, impact: 0 };
      causeMap[cause].impact += entry.impact;

      // Coordinadores
      const coord = entry.coordinator || 'SIN ASIGNAR';
      if (!coordMap[coord]) coordMap[coord] = { name: coord, impact: 0, count: 0 };
      coordMap[coord].impact += entry.impact;
      coordMap[coord].count += entry.count;

      // Tendencia
      const m = entry.month;
      monthlyTrend[m] = (monthlyTrend[m] || 0) + entry.impact;
    });

    const formatData = Object.values(formatMap).sort((a, b) => b.impact - a.impact);
    
    // Pareto Disciplinas
    const sortedDiscs = Object.values(disciplineMap).sort((a: any, b: any) => b.impact - a.impact);
    let cumulative = 0;
    const paretoDiscs = sortedDiscs.map((d: any) => {
      cumulative += d.impact;
      return { ...d, cumulativePct: (cumulative / totalImpact) * 100 };
    });

    // Coordinadores Matrix
    const coordData = Object.values(coordMap).map((c: any) => ({
      x: c.count,
      y: c.impact / 1000000, // En Millones
      name: c.name
    }));

    // Tendencia Chart
    const trendData = MONTHS.map(m => ({
      month: m.name.substring(0, 3),
      impact: monthlyTrend[m.id] || 0
    }));

    return {
      totalImpact,
      totalOrders,
      formatData,
      paretoDiscs,
      coordData,
      trendData,
      vitalFew: paretoDiscs.filter((d: any) => d.cumulativePct <= 85)
    };
  }, [analyticsEntries]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen w-full bg-slate-900 text-white selection:bg-primary selection:text-white">
      <AppSidebar />
      <SidebarInset className="bg-slate-900 border-none">
        <header className="flex h-20 shrink-0 items-center justify-between border-b border-white/5 bg-slate-900/80 backdrop-blur-xl px-8 sticky top-0 z-50">
          <div className="flex items-center gap-6">
            <SidebarTrigger className="text-white hover:bg-white/10" />
            <div className="flex flex-col">
              <h1 className="text-xl font-black uppercase tracking-tighter font-headline flex items-center gap-3">
                <Presentation className="h-5 w-5 text-primary" />
                Alta Dirección: Análisis Forense de Desviaciones
              </h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em]">Walmart Real Estate Forensic Unit • 2024</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-2 px-4 py-1.5 uppercase font-black text-[10px]">
               SSOT Active: {(stats?.totalOrders || 0).toLocaleString()} Records
             </Badge>
             <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 rounded-xl gap-2 h-10 px-6 text-[10px] font-black uppercase">
               <Maximize2 className="h-4 w-4" /> Pantalla Completa
             </Button>
          </div>
        </header>

        {/* NAVEGACIÓN DE CAPAS */}
        <div className="bg-slate-900/50 backdrop-blur-md border-b border-white/5 sticky top-20 z-40 px-8 py-3 overflow-x-auto scrollbar-hide flex gap-2">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-4 py-2 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all border ${
                activeSection === s.id 
                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <main className="p-8 md:p-12 space-y-20 max-w-[1400px] mx-auto w-full pb-40">
          
          {/* SECCIÓN 1: INTRODUCCIÓN */}
          <section id="intro" className={`space-y-12 transition-all duration-700 ${activeSection === 'intro' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="space-y-6 max-w-4xl">
              <Badge className="bg-primary text-white rounded-md px-3 py-1 text-[10px] font-black uppercase tracking-widest">Objetivo Estratégico</Badge>
              <h2 className="text-7xl font-headline font-bold tracking-tight text-white leading-[0.9]">
                Optimización de <span className="text-primary italic">Capex</span> mediante Análisis Forense.
              </h2>
              <p className="text-2xl text-slate-400 leading-relaxed font-medium">
                Identificación de causas raíz en desviaciones de construcción (OC/OT) para reducir el impacto económico y priorizar acciones estratégicas basadas en el principio de Pareto 80/20.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: Search, title: "Comprender Desviaciones", desc: "Mapeo completo del ciclo de vida de los cambios en proyectos." },
                { icon: Target, title: "Identificar Causas", desc: "Detección de drivers técnicos y administrativos de mayor costo." },
                { icon: Zap, title: "Priorizar Acciones", desc: "Enfoque quirúrgico en el 20% de las causas que generan el 80% del gasto." }
              ].map((item, i) => (
                <Card key={i} className="bg-white/5 border-white/10 p-8 rounded-[2rem] hover:bg-white/[0.07] transition-all">
                  <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                    <item.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h4 className="text-xl font-bold mb-3">{item.title}</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* SECCIÓN 2: UNIVERSO ANALIZADO */}
          <section id="universe" className={`space-y-12 transition-all duration-700 ${activeSection === 'universe' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="flex justify-between items-end">
              <div className="space-y-2">
                <h3 className="text-4xl font-headline font-bold">Universo de Auditoría</h3>
                <p className="text-slate-400 font-medium">Consolidado global de registros auditados por el motor de IA.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Impacto Acumulado</p>
                <p className="text-5xl font-black text-white">{formatCurrency(stats?.totalImpact || 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {stats?.formatData.map((f, i) => (
                <Card key={i} className="bg-white/5 border-white/10 p-6 rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Building2 className="h-16 w-16" /></div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{f.name}</p>
                  <h4 className="text-2xl font-black text-white mb-4">{formatCurrency(f.impact)}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400 uppercase">{f.count} Órdenes</span>
                      <span className="text-primary">{((f.impact / (stats.totalImpact || 1)) * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={(f.impact / stats.totalImpact) * 100} className="h-1 bg-white/5" />
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* SECCIÓN 3: PARETO 80/20 POR FORMATO */}
          <section id="pareto-format" className={`space-y-12 transition-all duration-700 ${activeSection === 'pareto-format' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="flex items-center gap-4">
              <h3 className="text-4xl font-headline font-bold">Análisis de Concentración (Pareto)</h3>
              <Badge className="bg-orange-500 text-white uppercase text-[10px] font-black px-4 py-1">Estrategia Vital Few</Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 bg-white/5 p-8 rounded-[3rem] border border-white/10 h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats?.paretoDiscs.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94A3B8', fontWeight: 'bold' }} height={60} interval={0} angle={-25} textAnchor="end" />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={(v) => `$${v/1000000}M`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: ACCENT_ORANGE }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#0F172A', color: '#fff' }}
                      formatter={(val: number) => [formatCurrency(val), 'Impacto']}
                    />
                    <Bar yAxisId="left" dataKey="impact" radius={[10, 10, 0, 0]} barSize={40}>
                      {stats?.paretoDiscs.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.cumulativePct <= 85 ? CYAN_PRIMARY : 'rgba(255,255,255,0.1)'} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="cumulativePct" stroke={ACCENT_ORANGE} strokeWidth={4} dot={{ r: 6, fill: ACCENT_ORANGE, strokeWidth: 2, stroke: '#0F172A' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-6">
                <h4 className="text-xl font-bold text-slate-300 uppercase tracking-widest flex items-center gap-3">
                  <Focus className="h-5 w-5 text-primary" /> Hitos Críticos (80%)
                </h4>
                <div className="space-y-4">
                  {stats?.vitalFew.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-white/5 border border-white/5 rounded-2xl group hover:border-primary/50 transition-all">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-black text-slate-700 group-hover:text-primary">0{i+1}</span>
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold uppercase tracking-tight">{d.name}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{d.count} Incidencias</p>
                        </div>
                      </div>
                      <p className="text-lg font-black">{formatCurrency(d.impact)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SECCIÓN 4: HEATMAP DE CONCENTRACIÓN */}
          <section id="heatmap" className={`space-y-12 transition-all duration-700 ${activeSection === 'heatmap' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="space-y-2">
              <h3 className="text-4xl font-headline font-bold">Matriz de Riesgo: Formato vs Disciplina</h3>
              <p className="text-slate-400">Identificación de concentraciones críticas por segmento operativo.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats?.formatData.slice(0, 6).map((f, i) => (
                <Card key={i} className="bg-white/5 border-white/10 p-8 rounded-[2.5rem] overflow-hidden relative group">
                  <div className="flex justify-between items-start mb-8">
                    <div className="space-y-1">
                      <h4 className="text-xl font-black text-white uppercase tracking-tight">{f.name}</h4>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Top Driver: {Object.keys(f.disciplines)[0]}</p>
                    </div>
                    <Badge className="bg-white/10 text-white border-none">{formatCurrency(f.impact)}</Badge>
                  </div>
                  <div className="space-y-6">
                    {Object.entries(f.disciplines).slice(0, 4).map(([name, impact]: any, j) => (
                      <div key={j} className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold uppercase">
                          <span className="text-slate-400 truncate max-w-[150px]">{name}</span>
                          <span className="text-white">{formatCurrency(impact)}</span>
                        </div>
                        <Progress value={(impact / f.impact) * 100} className="h-1.5 bg-white/5" />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* SECCIÓN 6: COORDINADORES (FRECUENCIA VS IMPACTO) */}
          <section id="coordinators" className={`space-y-12 transition-all duration-700 ${activeSection === 'coordinators' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="space-y-2">
              <h3 className="text-4xl font-headline font-bold">Performance de Coordinación</h3>
              <p className="text-slate-400">Análisis de eficiencia por responsable: Frecuencia de OC/OT vs Impacto Económico.</p>
            </div>

            <div className="bg-white/5 p-12 rounded-[3rem] border border-white/10 h-[600px] relative">
              <div className="absolute top-12 right-12 flex flex-col gap-2 items-end">
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-rose-500" /><span className="text-[10px] font-black uppercase text-slate-400">Riesgo Alto (Frecuencia + Costo)</span></div>
                <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-full bg-emerald-500" /><span className="text-[10px] font-black uppercase text-slate-400">Gestión Estable</span></div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis type="number" dataKey="x" name="Incidencias" unit=" uds" tick={{fill: '#94A3B8'}} label={{ value: 'Número de Órdenes (Frecuencia)', position: 'insideBottom', offset: -10, fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} />
                  <YAxis type="number" dataKey="y" name="Impacto" unit="M" tick={{fill: '#94A3B8'}} label={{ value: 'Impacto Económico (MXN Millones)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} />
                  <ZAxis type="number" range={[100, 1000]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#0F172A', color: '#fff' }}
                    formatter={(val: any, name: string) => [val, name]}
                  />
                  <Scatter name="Coordinadores" data={stats?.coordData} fill={CYAN_PRIMARY}>
                    {stats?.coordData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.y > 100 || entry.x > 500 ? '#E11D48' : '#10B981'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* SECCIÓN 11: DECISION DASHBOARD */}
          <section id="decision" className={`space-y-12 transition-all duration-700 ${activeSection === 'decision' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <Badge className="bg-emerald-500 text-white rounded-md px-4 py-1 text-xs font-black uppercase tracking-[0.2em]">Decision Dashboard</Badge>
              <h2 className="text-6xl font-headline font-bold leading-none">Hoja de Ruta Estratégica</h2>
              <p className="text-xl text-slate-400 italic">Acciones inmediatas para la contención del 80% de las desviaciones detectadas.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {[
                { prob: "Ingeniería Eléctrica / MEP", cause: "Omisiones en proyecto ejecutivo y falta de compatibilidad BIM.", action: "Revisión técnica mandatoria en Fase de Diseño (Gate 2) con auditor externo.", impact: "Reducción estimada del 15% en Capex eléctrico." },
                { prob: "Obra Civil / Estructura", cause: "Información incompleta de mecánica de suelos y cambios de layout tardíos.", action: "Protocolo de validación previa constructiva y congelamiento de layout en Gate 1.", impact: "Contención de 250M MXN en variaciones de cimentación." },
                { prob: "Equipamiento / HVAC", cause: "Actualización de prototipo no sincronizada con licitación inicial.", action: "Sincronización trimestral de catálogo de prototipos con área de Compras.", impact: "Eliminación de órdenes de cambio por 'Actualización de Prototipo'." }
              ].map((item, i) => (
                <Card key={i} className="bg-white/5 border-white/10 p-10 rounded-[3rem] hover:bg-white/[0.08] transition-all relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
                  <div className="grid md:grid-cols-4 gap-12 items-center">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Problema Crítico</p>
                      <h4 className="text-2xl font-black text-white leading-tight">{item.prob}</h4>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Causa Raíz Detectada</p>
                      <p className="text-sm font-medium text-slate-300 leading-relaxed">{item.cause}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-accent uppercase tracking-widest">Acción Propuesta</p>
                      <p className="text-sm font-bold text-white leading-relaxed">{item.action}</p>
                    </div>
                    <div className="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20 text-center">
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Impacto Esperado</p>
                      <p className="text-xs font-black text-emerald-400">{item.impact}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="bg-slate-800 p-12 rounded-[4rem] flex flex-col md:flex-row items-center justify-between gap-8 border border-white/5 shadow-2xl">
              <div className="space-y-2">
                <h5 className="text-3xl font-black text-white uppercase tracking-tighter italic">Proyección de Ahorro Capex 2025</h5>
                <p className="text-slate-400 font-medium max-w-xl">Si se ejecutan estos planes sobre el Vital Few (Top 80% del impacto), el potencial de reducción de variabilidad es de:</p>
              </div>
              <div className="text-right flex items-baseline gap-4">
                <span className="text-8xl font-black text-primary tracking-tighter">-22%</span>
                <div className="text-left space-y-1">
                  <p className="text-2xl font-black text-white">Impacto Total</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Estimación Auditada IA</p>
                </div>
              </div>
            </div>
          </section>

        </main>

        <footer className="p-12 border-t border-white/5 bg-slate-900 flex justify-between items-center opacity-50">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Walmart Real Estate Forensic Unit • Confidential • 2024</span>
          </div>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest">
            <span>SSOT Verified</span>
            <span>Build v4.5.0-Executive</span>
          </div>
        </footer>
      </SidebarInset>
    </div>
  );
}
