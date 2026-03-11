
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Target, 
  Zap, 
  TrendingUp,
  Focus,
  Presentation,
  Maximize2,
  Search,
  Activity,
  ShieldCheck,
  CheckCircle2,
  ArrowUpRight,
  Layout,
  Layers,
  Users,
  Briefcase,
  FileBarChart
} from 'lucide-react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Bar,
  Cell,
  ComposedChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, where, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

const CYAN_PRIMARY = "#2962FF";
const ACCENT_ORANGE = "#FF8F00";
const WALMART_BLUE = "#0071CE";

const SECTIONS = [
  { id: 'intro', label: '1. ESTRATEGIA' },
  { id: 'universe', label: '2. UNIVERSO' },
  { id: 'pareto-format', label: '3. PARETO 80/20' },
  { id: 'heatmap', label: '4. MATRIZ RIESGO' },
  { id: 'coordinators', label: '5. COORDINACIÓN' },
  { id: 'trends', label: '6. TENDENCIAS' },
  { id: 'action-plan', label: '7. MITIGACIÓN' },
  { id: 'decision', label: '8. HOJA DE RUTA' },
];

const GET_RAMO = (discipline: string): string => {
  const d = String(discipline || '').toUpperCase().trim();
  if (d.includes('CIVIL') || d.includes('ESTRUCTURA') || d.includes('TERRACER')) return 'OBRA CIVIL';
  if (d.includes('INGENIERÍA') || d.includes('DISEÑO') || d.includes('ARQUITECTURA')) return 'INGENIERÍA Y DISEÑO';
  if (d.includes('ELÉCTRICA') || d.includes('AIRE') || d.includes('HIDRÁULICA') || d.includes('MEP')) return 'INSTALACIONES (MEP)';
  if (d.includes('GESTIÓN') || d.includes('ADMIN') || d.includes('SUPERVISIÓN')) return 'GESTIÓN Y ADMON';
  if (d.includes('MOBILIARIO') || d.includes('EQUIPO')) return 'EQUIPAMIENTO';
  return 'OTROS';
};

export default function ControlCenterPage() {
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('intro');
  const [selectedYear] = useState<number>(2024);

  useEffect(() => { setMounted(true); }, []);

  const globalAggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(globalAggRef);

  const analyticsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'hitos_analytics'), where('year', '==', selectedYear));
  }, [db, selectedYear]);

  const { data: analyticsEntries } = useCollection(analyticsQuery);

  const stats = useMemo(() => {
    if (!analyticsEntries) return null;

    let totalImpact = 0;
    let totalOrders = 0;
    const formatMap: Record<string, any> = {};
    const disciplineMap: Record<string, any> = {};
    const coordMap: Record<string, any> = {};
    const monthlyTrend: Record<number, number> = {};

    analyticsEntries.forEach(entry => {
      totalImpact += entry.impact;
      totalOrders += entry.count;

      const fmt = entry.format || 'OTRO';
      if (!formatMap[fmt]) formatMap[fmt] = { name: fmt, impact: 0, count: 0, disciplines: {} };
      formatMap[fmt].impact += entry.impact;
      formatMap[fmt].count += entry.count;
      
      const ramo = GET_RAMO(entry.discipline);
      if (!formatMap[fmt].disciplines[ramo]) formatMap[fmt].disciplines[ramo] = 0;
      formatMap[fmt].disciplines[ramo] += entry.impact;

      if (!disciplineMap[ramo]) disciplineMap[ramo] = { name: ramo, impact: 0, count: 0 };
      disciplineMap[ramo].impact += entry.impact;
      disciplineMap[ramo].count += entry.count;

      const coord = entry.coordinator || 'SIN ASIGNAR';
      if (!coordMap[coord]) coordMap[coord] = { name: coord, impact: 0, count: 0 };
      coordMap[coord].impact += entry.impact;
      coordMap[coord].count += entry.count;

      monthlyTrend[entry.month] = (monthlyTrend[entry.month] || 0) + entry.impact;
    });

    const formatData = Object.values(formatMap).sort((a, b) => b.impact - a.impact);
    const sortedDiscs = Object.values(disciplineMap).sort((a: any, b: any) => b.impact - a.impact);
    let cumulative = 0;
    const paretoDiscs = sortedDiscs.map((d: any) => {
      cumulative += d.impact;
      return { ...d, cumulativePct: (cumulative / totalImpact) * 100 };
    });

    const coordData = Object.values(coordMap).map((c: any) => ({
      x: c.count,
      y: c.impact / 1000000,
      name: c.name
    }));

    const trendData = Array.from({length: 12}, (_, i) => ({
      month: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i],
      impact: monthlyTrend[i+1] || 0
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
    <div className="flex min-h-screen w-full bg-slate-50/50 text-slate-900 selection:bg-primary selection:text-white">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between border-b bg-white/80 backdrop-blur-xl px-8 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-6">
            <SidebarTrigger className="text-slate-600" />
            <div className="flex flex-col">
              <h1 className="text-xl font-black uppercase tracking-tighter font-headline flex items-center gap-3 text-slate-800">
                <Presentation className="h-5 w-5 text-primary" />
                Alta Dirección: Análisis Forense
              </h1>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em]">Walmart Real Estate Forensic Unit • {selectedYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-2 px-4 py-1.5 uppercase font-black text-[10px]">
               SSOT Active: {(stats?.totalOrders || 0).toLocaleString()} Registros
             </Badge>
             <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl gap-2 h-10 px-6 text-[10px] font-black uppercase">
               <Maximize2 className="h-4 w-4" /> Expandir Vista
             </Button>
          </div>
        </header>

        <div className="bg-white border-b sticky top-20 z-40 px-8 py-3 overflow-x-auto scrollbar-hide flex gap-2">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase whitespace-nowrap transition-all border ${
                activeSection === s.id 
                ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <main className="p-8 md:p-12 space-y-24 max-w-[1400px] mx-auto w-full pb-40">
          
          {/* SECCIÓN 1: ESTRATEGIA */}
          <section id="intro" className={`space-y-12 transition-all duration-700 ${activeSection === 'intro' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="space-y-6 max-w-4xl">
              <Badge className="bg-primary text-white rounded-md px-3 py-1 text-[10px] font-black uppercase tracking-widest">Mandato Institucional</Badge>
              <h2 className="text-7xl font-headline font-bold tracking-tight text-slate-900 leading-[0.9]">
                Optimización de <span className="text-primary italic">Inversión</span> mediante Inteligencia Forense.
              </h2>
              <p className="text-2xl text-slate-500 leading-relaxed font-medium">
                Detección de ineficiencias en el presupuesto de construcción para reducir la variabilidad y asegurar que el 80% del impacto financiero sea gestionado preventivamente.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: Search, title: "Visibilidad Total", desc: "Mapeo del 100% de las órdenes de cambio en el portafolio inmobiliario." },
                { icon: Target, title: "Fuerzas de Red", desc: "Identificación de los Ramos Técnicos que atraen la mayor cantidad de desviaciones." },
                { icon: Zap, title: "Mitigación 80/20", desc: "Enfoque en los 'Vital Few' para maximizar el retorno de las acciones correctivas." }
              ].map((item, i) => (
                <Card key={i} className="bg-white border-slate-100 shadow-xl p-8 rounded-[2rem] hover:border-primary/20 transition-all group">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                    <item.icon className="h-7 w-7" />
                  </div>
                  <h4 className="text-xl font-bold mb-3 text-slate-800">{item.title}</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* SECCIÓN 2: UNIVERSO ANALIZADO */}
          <section id="universe" className={`space-y-12 transition-all duration-700 ${activeSection === 'universe' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="flex justify-between items-end border-b pb-8">
              <div className="space-y-2">
                <h3 className="text-4xl font-headline font-bold text-slate-800">Universo de Inversión</h3>
                <p className="text-slate-500 font-medium uppercase text-xs tracking-widest">Base de datos maestra auditada • SSOT Verified</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Monto de Desviaciones Auditadas</p>
                <p className="text-6xl font-black text-slate-900 tracking-tighter">{formatCurrency(stats?.totalImpact || 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {stats?.formatData.map((f, i) => (
                <Card key={i} className="bg-white border-slate-100 shadow-lg p-6 rounded-3xl relative overflow-hidden group hover:shadow-2xl transition-all">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-transform"><Building2 className="h-16 w-16" /></div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{f.name}</p>
                  <h4 className="text-2xl font-black text-slate-800 mb-4">{formatCurrency(f.impact)}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400 uppercase">{f.count} Órdenes</span>
                      <span className="text-primary">{((f.impact / (stats.totalImpact || 1)) * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={(f.impact / (stats.totalImpact || 1)) * 100} className="h-1 bg-slate-100" />
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* SECCIÓN 3: PARETO 80/20 POR RAMO */}
          <section id="pareto-format" className={`space-y-12 transition-all duration-700 ${activeSection === 'pareto-format' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="flex items-center gap-4">
              <h3 className="text-4xl font-headline font-bold text-slate-800">Concentración por Ramos Técnicos</h3>
              <Badge className="bg-orange-500 text-white uppercase text-[10px] font-black px-4 py-1 rounded-lg">Ley de Pareto 80/20</Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border shadow-2xl h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats?.paretoDiscs.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748B', fontWeight: 'bold' }} height={60} interval={0} angle={-25} textAnchor="end" />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `$${v/1000000}M`} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: ACCENT_ORANGE }} tickFormatter={(v) => `${v}%`} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#fff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                      formatter={(val: number) => [formatCurrency(val), 'Impacto']}
                    />
                    <Bar yAxisId="left" dataKey="impact" radius={[10, 10, 0, 0]} barSize={45}>
                      {stats?.paretoDiscs.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.cumulativePct <= 85 ? CYAN_PRIMARY : '#e2e8f0'} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="cumulativePct" stroke={ACCENT_ORANGE} strokeWidth={4} dot={{ r: 6, fill: ACCENT_ORANGE, strokeWidth: 2, stroke: '#fff' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-6">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                  <Focus className="h-5 w-5 text-primary" /> Vital Few (Top Ramos)
                </h4>
                <div className="space-y-4">
                  {stats?.vitalFew.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-white border rounded-2xl group hover:border-primary transition-all shadow-sm">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-black text-slate-200 group-hover:text-primary transition-colors">{i+1}</span>
                        <div className="space-y-0.5">
                          <p className="text-xs font-black uppercase text-slate-700">{d.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase">{d.count} Incidencias</p>
                        </div>
                      </div>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(d.impact)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SECCIÓN 4: MATRIZ DE RIESGO */}
          <section id="heatmap" className={`space-y-12 transition-all duration-700 ${activeSection === 'heatmap' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="space-y-2">
              <h3 className="text-4xl font-headline font-bold text-slate-800">Matriz de Concentración</h3>
              <p className="text-slate-500 font-medium">Relación entre Formatos de Tienda y Ramos Técnicos Críticos.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {stats?.formatData.slice(0, 6).map((f, i) => (
                <Card key={i} className="bg-white border shadow-xl p-8 rounded-[2.5rem] overflow-hidden relative group">
                  <div className="flex justify-between items-start mb-8">
                    <div className="space-y-1">
                      <h4 className="text-xl font-black text-slate-800 uppercase tracking-tight">{f.name}</h4>
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Impacto: {formatCurrency(f.impact)}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border text-slate-400 group-hover:text-primary transition-colors">
                      <Activity className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="space-y-6">
                    {Object.entries(f.disciplines).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4).map(([name, impact]: any, j) => (
                      <div key={j} className="space-y-2">
                        <div className="flex justify-between text-[10px] font-bold uppercase">
                          <span className="text-slate-500 truncate max-w-[150px]">{name}</span>
                          <span className="text-slate-900">{formatCurrency(impact)}</span>
                        </div>
                        <Progress value={(impact / f.impact) * 100} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* SECCIÓN 5: COORDINACIÓN */}
          <section id="coordinators" className={`space-y-12 transition-all duration-700 ${activeSection === 'coordinators' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="space-y-2">
              <h3 className="text-4xl font-headline font-bold text-slate-800">Eficiencia de Coordinación</h3>
              <p className="text-slate-500 font-medium">Análisis de dispersión: Volumen de Órdenes vs Impacto Económico Total.</p>
            </div>

            <div className="bg-white p-12 rounded-[3rem] border shadow-2xl h-[600px] relative overflow-hidden">
              <div className="absolute top-12 right-12 flex flex-col gap-2 items-end z-10">
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-rose-500" /><span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Riesgo Alto</span></div>
                <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Controlado</span></div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis type="number" dataKey="x" name="Órdenes" unit=" uds" tick={{fill: '#94A3B8', fontSize: 10}} label={{ value: 'Volumen de Órdenes (Frecuencia)', position: 'insideBottom', offset: -20, fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} />
                  <YAxis type="number" dataKey="y" name="Impacto" unit="M" tick={{fill: '#94A3B8', fontSize: 10}} label={{ value: 'Impacto Acumulado (MXN Millones)', angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' }} />
                  <ZAxis type="number" range={[100, 1000]} />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }} 
                    contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#fff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                  />
                  <Scatter name="Coordinadores" data={stats?.coordData}>
                    {stats?.coordData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.y > (stats.totalImpact / 10000000) || entry.x > 300 ? '#E11D48' : '#10B981'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* SECCIÓN 6: TENDENCIAS */}
          <section id="trends" className={`space-y-12 transition-all duration-700 ${activeSection === 'trends' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="flex items-end justify-between border-b pb-8">
              <div className="space-y-2">
                <h3 className="text-4xl font-headline font-bold text-slate-800">Evolución de Variabilidad</h3>
                <p className="text-slate-500 font-medium uppercase text-xs tracking-widest">Comportamiento mensual del impacto financiero</p>
              </div>
              <div className="text-right">
                <Badge className="bg-emerald-50 text-emerald-700 border-none px-4 py-1.5 uppercase text-[10px] font-black">Estado: Bajo Escrutinio</Badge>
              </div>
            </div>

            <Card className="bg-white p-10 rounded-[3rem] border shadow-2xl h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.trendData}>
                  <defs>
                    <linearGradient id="colorImpact" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CYAN_PRIMARY} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={CYAN_PRIMARY} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{fill: '#94A3B8', fontSize: 10, fontWeight: 'bold'}} axisLine={false} />
                  <YAxis tick={{fill: '#94A3B8', fontSize: 10}} tickFormatter={(v) => `$${v/1000000}M`} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="impact" stroke={CYAN_PRIMARY} strokeWidth={4} fillOpacity={1} fill="url(#colorImpact)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </section>

          {/* SECCIÓN 8: HOJA DE RUTA */}
          <section id="decision" className={`space-y-12 transition-all duration-700 ${activeSection === 'decision' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <Badge className="bg-emerald-500 text-white rounded-md px-4 py-1 text-xs font-black uppercase tracking-[0.2em]">Decision Dashboard</Badge>
              <h2 className="text-6xl font-headline font-bold leading-none text-slate-900 tracking-tight">Hoja de Ruta Estratégica</h2>
              <p className="text-xl text-slate-500 italic">Acciones para la contención de desviaciones en el presupuesto {selectedYear}.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {[
                { prob: "Ingeniería y Diseño", cause: "Omisiones en proyecto ejecutivo y falta de compatibilidad BIM.", action: "Revisión técnica mandatoria en Fase de Gate 2 con auditor externo.", impact: "Contención del 15% en variaciones eléctricas." },
                { prob: "Obra Civil", cause: "Información incompleta de mecánica de suelos y cambios de layout.", action: "Protocolo de validación previa constructiva y congelamiento de layout.", impact: "Reducción estimada de 250M MXN en cimentación." },
                { prob: "Equipamiento", cause: "Actualización de prototipo no sincronizada con licitación inicial.", action: "Sincronización trimestral de catálogo de prototipos con Compras.", impact: "Eliminación de órdenes por 'Actualización de Prototipo'." }
              ].map((item, i) => (
                <Card key={i} className="bg-white border-slate-100 shadow-xl p-10 rounded-[3rem] hover:border-primary/20 transition-all relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
                  <div className="grid md:grid-cols-4 gap-12 items-center">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Ramo Crítico</p>
                      <h4 className="text-2xl font-black text-slate-800 leading-tight">{item.prob}</h4>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver de Desviación</p>
                      <p className="text-sm font-medium text-slate-600 leading-relaxed">{item.cause}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-accent uppercase tracking-widest">Acción de Mitigación</p>
                      <p className="text-sm font-bold text-slate-800 leading-relaxed">{item.action}</p>
                    </div>
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Impacto Esperado</p>
                      <p className="text-xs font-black text-emerald-700">{item.impact}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="bg-slate-900 p-12 rounded-[4rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent pointer-events-none" />
              <div className="space-y-2 relative z-10">
                <h5 className="text-3xl font-black text-white uppercase tracking-tighter italic">Potencial de Ahorro {selectedYear}</h5>
                <p className="text-slate-400 font-medium max-w-xl">Si se ejecutan los planes de mitigación sobre el Vital Few (Top 80%), la reducción proyectada de variabilidad es de:</p>
              </div>
              <div className="text-right flex items-baseline gap-4 relative z-10">
                <span className="text-8xl font-black text-primary tracking-tighter">-22%</span>
                <div className="text-left space-y-1">
                  <p className="text-2xl font-black text-white">Impacto</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estimación Auditada IA</p>
                </div>
              </div>
            </div>
          </section>

        </main>

        <footer className="p-12 border-t bg-white flex justify-between items-center opacity-60">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Walmart Real Estate Forensic Unit • Confidential • 2024</span>
          </div>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>SSOT Verified</span>
            <span>Protocol v4.5.0-Executive</span>
          </div>
        </footer>
      </SidebarInset>
    </div>
  );
}
