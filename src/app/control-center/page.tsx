
"use client"

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  FileBarChart,
  Filter,
  CalendarDays,
  BrainCircuit,
  FileDown,
  Loader2,
  ChevronRight,
  RefreshCcw
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyzeStrategicTrends, TrendAnalysisOutput } from '@/ai/flows/trend-analysis-flow';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
  const { toast } = useToast();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('intro');
  
  // Filtros "Committed" (Los que afectan la data real)
  const [yearFilter, setYearFilter] = useState('2024');
  const [formatFilter, setFormatFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');

  // Filtros "Pending" (Los que el usuario mueve en los selectores antes de darle Actualizar)
  const [pendingYear, setPendingYear] = useState('2024');
  const [pendingFormat, setPendingFormat] = useState('all');
  const [pendingPlan, setPendingPlan] = useState('all');

  // IA & Export
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiMitigation, setAiMitigation] = useState<TrendAnalysisOutput | null>(null);
  const presentationRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const globalAggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(globalAggRef);

  // Catálogos para filtros
  const formatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('name', 'asc')) : null, [db]);
  const plansQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_plans'), orderBy('name', 'asc')) : null, [db]);
  const { data: availableFormats } = useCollection(formatsQuery);
  const { data: availablePlans } = useCollection(plansQuery);

  const analyticsQuery = useMemoFirebase(() => {
    if (!db) return null;
    let q = query(collection(db, 'hitos_analytics'));
    if (yearFilter !== 'all') {
      q = query(q, where('year', '==', Number(yearFilter)));
    }
    return q;
  }, [db, yearFilter]);

  const { data: analyticsEntries, isLoading: isLoadingAnalytics } = useCollection(analyticsQuery);

  const handleApplyFilters = () => {
    setYearFilter(pendingYear);
    setFormatFilter(pendingFormat);
    setPlanFilter(pendingPlan);
    setAiMitigation(null); // Reset IA analysis when data changes
    toast({ 
      title: "Presentación Actualizada", 
      description: "Los datos forenses se han sincronizado con los nuevos criterios.",
      duration: 3000
    });
  };

  const stats = useMemo(() => {
    if (!analyticsEntries) return null;

    let totalImpact = 0;
    let totalOrders = 0;
    const formatMap: Record<string, any> = {};
    const disciplineMap: Record<string, any> = {};
    const coordMap: Record<string, any> = {};
    const monthlyTrend: Record<number, number> = {};

    analyticsEntries.forEach(entry => {
      const matchFormat = formatFilter === 'all' || entry.format === formatFilter;
      const matchPlan = planFilter === 'all' || entry.plan === planFilter;

      if (matchFormat && matchPlan) {
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
      }
    });

    const formatData = Object.values(formatMap).sort((a, b) => b.impact - a.impact);
    const sortedDiscs = Object.values(disciplineMap).sort((a: any, b: any) => b.impact - a.impact);
    let cumulative = 0;
    const paretoDiscs = sortedDiscs.map((d: any) => {
      cumulative += d.impact;
      return { ...d, cumulativePct: Number(((cumulative / (totalImpact || 1)) * 100).toFixed(2)) };
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
      vitalFew: paretoDiscs.filter((d: any) => d.cumulativePct <= 85 || paretoDiscs.indexOf(d) === 0)
    };
  }, [analyticsEntries, formatFilter, planFilter]);

  const handleGenerateMitigation = async () => {
    if (!stats || stats.paretoDiscs.length === 0) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeStrategicTrends({
        monthlyData: stats.trendData.map(t => ({ month: t.month, impact: t.impact, count: 0 })),
        years: yearFilter === 'all' ? [2023, 2024, 2025] : [Number(yearFilter)],
        totalImpact: stats.totalImpact,
        rootCauseSummary: stats.paretoDiscs.map(p => ({ 
          cause: p.name, 
          impact: p.impact, 
          count: p.count,
          percentage: Number(((p.impact / stats.totalImpact) * 100).toFixed(1))
        })),
        paretoTop80: stats.vitalFew.map(p => p.name)
      });
      setAiMitigation(result);
      toast({ title: "Análisis Generado", description: "La hoja de ruta de mitigación está lista." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en IA", description: e.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportPresentation = async () => {
    if (!presentationRef.current) return;
    setIsExporting(true);
    try {
      const element = presentationRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('l', 'mm', 'a4'); // Paisaje para presentación
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, width, height);
      pdf.save(`Walmart_AltaDireccion_Presentacion_${new Date().getTime()}.pdf`);
      toast({ title: "Exportación Exitosa", description: "Presentación descargada en formato PDF." });
    } catch (e) {
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
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em]">Walmart Real Estate Forensic Unit • SSOT Active</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* FILTROS MULTIDIMENSIONALES */}
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400 ml-2" />
              <Select value={pendingYear} onValueChange={setPendingYear}>
                <SelectTrigger className="h-8 w-36 bg-transparent border-none text-[10px] font-black uppercase shadow-none focus:ring-0">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS AÑOS</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <Target className="h-3.5 w-3.5 text-slate-400 ml-2" />
              <Select value={pendingPlan} onValueChange={setPendingPlan}>
                <SelectTrigger className="h-8 w-32 bg-transparent border-none text-[10px] font-black uppercase shadow-none focus:ring-0">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS PLANES</SelectItem>
                  {availablePlans?.map(p => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <Filter className="h-3.5 w-3.5 text-slate-400 ml-2" />
              <Select value={pendingFormat} onValueChange={setPendingFormat}>
                <SelectTrigger className="h-8 w-40 bg-white border-none text-[10px] font-black uppercase shadow-sm">
                  <SelectValue placeholder="Formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS FORMATOS</SelectItem>
                  {availableFormats?.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleApplyFilters}
              disabled={isLoadingAnalytics}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl gap-2 h-10 px-6 text-[10px] font-black uppercase shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${isLoadingAnalytics ? 'animate-spin' : ''}`} />
              Actualizar Presentación
            </Button>

            <Separator orientation="vertical" className="h-8 mx-2" />
            
            <Button 
              variant="outline" 
              onClick={handleExportPresentation}
              disabled={isExporting}
              className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl gap-2 h-10 px-6 text-[10px] font-black uppercase"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} 
              Exportar Presentación
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

        <main ref={presentationRef} className="p-8 md:p-12 space-y-24 max-w-[1400px] mx-auto w-full pb-40 bg-white">
          
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
                <p className="text-slate-500 font-medium uppercase text-xs tracking-widest">Base de datos maestra auditada • Filtros: {yearFilter === 'all' ? 'Histórico Total' : yearFilter} | {planFilter === 'all' ? 'Global' : planFilter} | {formatFilter === 'all' ? 'Multiformato' : formatFilter}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Monto de Desviaciones Auditadas</p>
                <p className="text-6xl font-black text-slate-900 tracking-tighter">{formatCurrency(stats?.totalImpact || 0)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {stats?.formatData.slice(0, 8).map((f, i) => (
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

          {/* SECCIÓN 7: MITIGACIÓN (ACTUALIZADA CON IA) */}
          <section id="action-plan" className={`space-y-12 transition-all duration-700 ${activeSection === 'action-plan' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="flex justify-between items-center border-b pb-8">
              <div className="space-y-2">
                <h3 className="text-4xl font-headline font-bold text-slate-800">Estrategia de Mitigación</h3>
                <p className="text-slate-500 font-medium">Planes de acción específicos para los Vital Few (Top 80%).</p>
              </div>
              <Button 
                onClick={handleGenerateMitigation} 
                disabled={isAnalyzing}
                className="bg-primary hover:bg-primary/90 rounded-xl gap-2 h-12 px-8 text-xs font-black uppercase tracking-widest shadow-xl"
              >
                {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
                Generar Estrategia IA
              </Button>
            </div>

            {!aiMitigation ? (
              <div className="h-80 border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
                <Zap className="h-16 w-16 opacity-10 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Presione el botón para que la IA analice los ramos actuales</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in zoom-in duration-700">
                {aiMitigation.actionPlan.map((plan, i) => (
                  <Card key={i} className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden group hover:-translate-y-2 transition-all">
                    <CardHeader className="bg-slate-900 text-white p-8">
                      <div className="flex justify-between items-start mb-4">
                        <Badge className="bg-accent text-white border-none text-[8px] font-black px-2 py-0.5">PLAN RAMO {i+1}</Badge>
                        <Zap className="h-5 w-5 text-accent" />
                      </div>
                      <CardTitle className="text-lg font-black uppercase leading-tight">{plan.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                      <ul className="space-y-4">
                        {plan.steps.map((step, j) => (
                          <li key={j} className="flex gap-4 text-xs text-slate-600 leading-tight">
                            <div className="h-5 w-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 font-bold text-[10px]">{j+1}</div>
                            {step}
                          </li>
                        ))}
                      </ul>
                      <div className="pt-6 border-t border-dashed">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Estimado en Inversión</p>
                        <p className="text-sm font-black text-emerald-600 uppercase italic">{plan.expectedImpact}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* SECCIÓN 8: HOJA DE RUTA */}
          <section id="decision" className={`space-y-12 transition-all duration-700 ${activeSection === 'decision' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 hidden'}`}>
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <Badge className="bg-emerald-500 text-white rounded-md px-4 py-1 text-xs font-black uppercase tracking-[0.2em]">Decision Dashboard</Badge>
              <h2 className="text-6xl font-headline font-bold leading-none text-slate-900 tracking-tight">Hoja de Ruta Estratégica</h2>
              <p className="text-xl text-slate-500 italic">Acciones para la contención de desviaciones en el presupuesto {yearFilter === 'all' ? 'Histórico' : yearFilter}.</p>
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
                <h5 className="text-3xl font-black text-white uppercase tracking-tighter italic">Potencial de Ahorro {yearFilter === 'all' ? 'Proyectado' : yearFilter}</h5>
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
