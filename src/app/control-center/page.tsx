
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Target, 
  Zap, 
  TrendingDown,
  Focus,
  Filter,
  X,
  CalendarDays,
  User,
  Layout,
  Loader2,
  Package,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
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

const CYAN_PRIMARY = "#00D8FF";

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
  
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedCoordinators, setSelectedCoordinators] = useState<string[]>([]);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all');

  useEffect(() => { setMounted(true); }, []);

  const formatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('name')) : null, [db]);
  const coordsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_coordinators'), orderBy('name')) : null, [db]);
  const stagesQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_stages'), orderBy('name')) : null, [db]);
  const plansQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_plans'), orderBy('name')) : null, [db]);
  
  const { data: formatsDocs } = useCollection(formatsQuery);
  const { data: coordsDocs } = useCollection(coordsQuery);
  const { data: stagesDocs } = useCollection(stagesQuery);
  const { data: plansDocs } = useCollection(plansQuery);

  const analyticsQuery = useMemoFirebase(() => {
    if (!db) return null;
    let q = query(collection(db, 'hitos_analytics'), where('year', '==', selectedYear));
    if (selectedMonth !== 'all') q = query(q, where('month', '==', selectedMonth));
    return q;
  }, [db, selectedYear, selectedMonth]);

  const { data: analyticsEntries, isLoading } = useCollection(analyticsQuery);

  const filteredStats = useMemo(() => {
    if (!analyticsEntries) return null;

    let totalImpact = 0;
    let totalOrders = 0;
    const disciplineMap: Record<string, { impact: number, count: number, name: string }> = {};

    analyticsEntries.forEach(entry => {
      const matchFormat = selectedFormats.length === 0 || selectedFormats.includes(entry.format);
      const matchCoord = selectedCoordinators.length === 0 || selectedCoordinators.includes(entry.coordinator);
      const matchStage = selectedStages.length === 0 || selectedStages.includes(entry.stage);
      const matchPlan = selectedPlans.length === 0 || selectedPlans.includes(entry.plan);

      if (matchFormat && matchCoord && matchStage && matchPlan) {
        totalImpact += entry.impact;
        totalOrders += entry.count;

        const disc = entry.discipline || 'OTRO';
        if (!disciplineMap[disc]) disciplineMap[disc] = { impact: 0, count: 0, name: disc };
        disciplineMap[disc].impact += entry.impact;
        disciplineMap[disc].count += entry.count;
      }
    });

    const paretoDiscs = Object.values(disciplineMap)
      .sort((a, b) => b.impact - a.impact)
      .map((d, i, arr) => {
        const cumulative = arr.slice(0, i + 1).reduce((sum, item) => sum + item.impact, 0);
        return {
          ...d,
          participationPct: totalImpact > 0 ? (d.impact / totalImpact) * 100 : 0,
          cumulativePct: totalImpact > 0 ? (cumulative / totalImpact) * 100 : 0
        };
      });

    const vitalFew = paretoDiscs.filter(d => d.cumulativePct <= 85);
    const concentrationRatio = totalImpact > 0 ? (vitalFew.reduce((a, b) => a + b.impact, 0) / totalImpact) * 100 : 0;

    const trendData = MONTHS.map(m => {
      const monthImpact = analyticsEntries
        .filter(e => e.month === m.id)
        .filter(e => selectedFormats.length === 0 || selectedFormats.includes(e.format))
        .filter(e => selectedCoordinators.length === 0 || selectedCoordinators.includes(e.coordinator))
        .filter(e => selectedStages.length === 0 || selectedStages.includes(e.stage))
        .filter(e => selectedPlans.length === 0 || selectedPlans.includes(e.plan))
        .reduce((sum, e) => sum + e.impact, 0);
      
      return { month: m.name.substring(0, 3), impact: monthImpact };
    });

    return {
      totalImpact,
      totalOrders,
      concentrationRatio,
      paretoDiscs,
      trendData
    };
  }, [analyticsEntries, selectedFormats, selectedCoordinators, selectedStages, selectedPlans]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  const resetFilters = () => {
    setSelectedFormats([]);
    setSelectedCoordinators([]);
    setSelectedStages([]);
    setSelectedPlans([]);
    setSelectedMonth('all');
    setSelectedYear(2024);
  };

  if (!user?.uid || !mounted) return (
    <div className="flex h-screen items-center justify-center bg-slate-100 flex-col gap-4">
      <Activity className="h-12 w-12 text-cyan-500 animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Cargando Centro de Control...</p>
    </div>
  );

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
            </div>
          </div>
          <div className="flex items-center gap-4">
             <Button onClick={resetFilters} variant="ghost" className="text-[10px] font-black uppercase text-slate-400 hover:text-rose-500">
               <X className="h-3 w-3 mr-1" /> Reset
             </Button>
             <Button onClick={() => router.push('/trends')} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 px-6 gap-2 text-[10px] font-black uppercase tracking-widest">
               <Zap className="h-4 w-4 text-accent" /> IA Action Plan
             </Button>
          </div>
        </header>

        <div className="bg-white border-b border-slate-100 p-4 sticky top-20 z-10 flex flex-wrap items-center gap-3 px-8">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl border-slate-200 gap-2 text-[10px] font-bold uppercase tracking-tight">
                <Layout className="h-3 w-3 text-primary" /> Formatos {selectedFormats.length > 0 && `(${selectedFormats.length})`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-xl">
              <DropdownMenuLabel className="text-[10px] uppercase">Seleccionar Formatos</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {formatsDocs?.map(f => (
                <DropdownMenuCheckboxItem 
                  key={f.id} 
                  checked={selectedFormats.includes(f.id)}
                  onCheckedChange={() => setSelectedFormats(prev => prev.includes(f.id) ? prev.filter(i => i !== f.id) : [...prev, f.id])}
                >
                  {f.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl border-slate-200 gap-2 text-[10px] font-bold uppercase tracking-tight">
                <User className="h-3 w-3 text-accent" /> Coordinador {selectedCoordinators.length > 0 && `(${selectedCoordinators.length})`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 rounded-xl max-h-80 overflow-y-auto">
              <DropdownMenuLabel className="text-[10px] uppercase">Responsable de Obra</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {coordsDocs?.map(c => (
                <DropdownMenuCheckboxItem 
                  key={c.id} 
                  checked={selectedCoordinators.includes(c.name)}
                  onCheckedChange={() => setSelectedCoordinators(prev => prev.includes(c.name) ? prev.filter(i => i !== c.name) : [...prev, c.name])}
                >
                  {c.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl border-slate-200 gap-2 text-[10px] font-bold uppercase tracking-tight">
                <Focus className="h-3 w-3 text-emerald-500" /> Etapa {selectedStages.length > 0 && `(${selectedStages.length})`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-xl">
              <DropdownMenuLabel className="text-[10px] uppercase">Etapa del Proyecto</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {stagesDocs?.map(s => (
                <DropdownMenuCheckboxItem 
                  key={s.id} 
                  checked={selectedStages.includes(s.name)}
                  onCheckedChange={() => setSelectedStages(prev => prev.includes(s.name) ? prev.filter(i => i !== s.name) : [...prev, s.name])}
                >
                  {s.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl border-slate-200 gap-2 text-[10px] font-bold uppercase tracking-tight">
                <Package className="h-3 w-3 text-orange-500" /> Plan {selectedPlans.length > 0 && `(${selectedPlans.length})`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 rounded-xl max-h-80 overflow-y-auto">
              <DropdownMenuLabel className="text-[10px] uppercase">Planes de Trabajo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {plansDocs?.map(p => (
                <DropdownMenuCheckboxItem 
                  key={p.id} 
                  checked={selectedPlans.includes(p.name)}
                  onCheckedChange={() => setSelectedPlans(prev => prev.includes(p.name) ? prev.filter(i => i !== p.name) : [...prev, p.name])}
                >
                  {p.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-8 w-px bg-slate-100 mx-2" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl border-slate-200 gap-2 text-[10px] font-bold uppercase tracking-tight">
                <CalendarDays className="h-3 w-3 text-slate-400" /> {selectedMonth === 'all' ? 'Todos los Meses' : MONTHS.find(m => m.id === selectedMonth)?.name}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 rounded-xl">
              <DropdownMenuItem onClick={() => setSelectedMonth('all')}>Todos los Meses</DropdownMenuItem>
              {MONTHS.map(m => (
                <DropdownMenuItem key={m.id} onClick={() => setSelectedMonth(m.id)}>{m.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-xl border-slate-200 gap-2 text-[10px] font-bold uppercase tracking-tight">
                Año: {selectedYear}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-32 rounded-xl">
              {[2023, 2024, 2025].map(y => (
                <DropdownMenuItem key={y} onClick={() => setSelectedYear(y)}>{y}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary ml-auto" />}
          
          {!isLoading && (
            <div className="ml-auto flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Universo Filtrado</p>
                  <p className="text-xs font-black text-primary">{(filteredStats?.totalOrders || 0).toLocaleString()} Registros</p>
               </div>
            </div>
          )}
        </div>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          {filteredStats?.totalOrders === 0 ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-slate-300 border-2 border-dashed rounded-[40px] space-y-4 bg-white/50">
               <Filter className="h-16 w-16 opacity-10" />
               <div className="text-center">
                 <p className="text-sm font-black uppercase text-slate-400">No hay registros para esta combinación de filtros</p>
                 <p className="text-[10px] text-slate-400 mt-1">Ajuste los criterios en la cinta superior (revisa el Año, Plan y Mes).</p>
               </div>
               <Button variant="outline" onClick={resetFilters} className="rounded-xl uppercase text-[10px] font-black">Limpiar Filtros</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-6 border-none shadow-md bg-white rounded-3xl">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impacto Filtrado</p>
                    <div className="p-2 bg-primary/5 rounded-lg"><Activity className="h-4 w-4 text-primary" /></div>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 font-headline">{formatCurrency(filteredStats?.totalImpact || 0)}</h3>
                </Card>

                <Card className="p-6 border-none shadow-md bg-slate-900 text-white rounded-3xl border-l-4 border-l-orange-500 relative overflow-hidden">
                  <div className="absolute -right-4 -bottom-4 opacity-10"><Target className="h-24 w-24" /></div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Concentración Pareto</p>
                    <Badge className="bg-orange-500 text-white text-[8px] font-black">VITAL FEW</Badge>
                  </div>
                  <h3 className="text-4xl font-black text-white font-headline">{(filteredStats?.concentrationRatio || 0).toFixed(1)}%</h3>
                  <div className="w-full bg-white/10 h-1.5 rounded-full mt-4 overflow-hidden">
                    <div className="bg-orange-500 h-full" style={{ width: `${filteredStats?.concentrationRatio || 0}%` }} />
                  </div>
                </Card>

                <Card className="p-6 border-none shadow-md bg-white rounded-3xl border-l-4 border-l-rose-500">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Registros Segmentados</p>
                  <h3 className="text-3xl font-black text-slate-900 font-headline">{(filteredStats?.totalOrders || 0).toLocaleString()}</h3>
                </Card>

                <Card className="p-6 border-none shadow-md bg-white rounded-3xl">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodo de Auditoría</p>
                    <div className="p-2 bg-emerald-50 rounded-lg"><CalendarDays className="h-4 w-4 text-emerald-500" /></div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-black text-slate-900 font-headline">{selectedYear}</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedMonth === 'all' ? 'Anual' : MONTHS.find(m => m.id === selectedMonth)?.name}</span>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="border-none shadow-xl bg-white rounded-3xl p-8 flex flex-col min-h-[650px]">
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 mb-8">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                        <Focus className="h-5 w-5 text-cyan-500" /> 
                        Hitos Principales (Filtrados)
                      </h4>
                      <Badge variant="outline" className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Ranking Pareto</Badge>
                    </div>
                  </div>

                  <div className="flex-1 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
                    {filteredStats?.paretoDiscs.map((d, i) => (
                      <div key={`${d.name}-${i}`} className="group cursor-pointer space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="text-xs font-black text-slate-800 uppercase group-hover:text-primary transition-colors flex items-center gap-2">
                              {d.name}
                              {d.cumulativePct <= 85 && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{d.count} Órdenes detectadas</p>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-black text-slate-900">{formatCurrency(d.impact)}</span>
                            <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">{d.participationPct.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div className="relative">
                          <Progress value={d.participationPct * 4} className="h-1 bg-slate-50" />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="lg:col-span-2 space-y-8">
                  <Card className="border-none shadow-xl bg-white rounded-3xl p-8 h-fit">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-8">
                      <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                        <TrendingDown className="h-5 w-5 text-rose-500" /> 
                        Impacto Mensual ({selectedYear})
                      </h4>
                    </div>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={filteredStats?.trendData}>
                          <defs>
                            <linearGradient id="colorImpact" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={CYAN_PRIMARY} stopOpacity={0.2}/>
                              <stop offset="95%" stopColor={CYAN_PRIMARY} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                          <XAxis dataKey="month" axisLine={false} tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} />
                          <YAxis axisLine={false} tick={{ fontSize: 10, fill: '#94A3B8', fontWeight: 'bold' }} tickFormatter={(v) => `$${v/1000000}M`} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#0F172A', color: '#fff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}
                            itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                            formatter={(val: number) => [formatCurrency(val), 'Impacto']}
                          />
                          <Area type="monotone" dataKey="impact" stroke={CYAN_PRIMARY} strokeWidth={4} fill="url(#colorImpact)" animationDuration={1000} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="p-6 border-none shadow-md bg-white rounded-3xl border-t-4 border-t-cyan-500">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Estatus del Filtro</h5>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-600">Contexto Analítico</span>
                          <span className="font-black text-emerald-600">Vinculado</span>
                        </div>
                        <Progress value={100} className="h-1 bg-slate-50" />
                        <div className="text-[9px] text-slate-400 leading-relaxed italic">Filtros vinculados a la colección multidimensional 'hitos_analytics'.</div>
                      </div>
                    </Card>
                    <Card className="p-6 border-none shadow-md bg-white rounded-3xl border-t-4 border-t-accent">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Drill-Down Predictivo</h5>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-600">Integridad de Índices</span>
                          <span className="font-black text-accent">Activo</span>
                        </div>
                        <Progress value={85} className="h-1 bg-slate-50" />
                        <div className="text-[9px] text-slate-400 leading-relaxed italic">Los índices compuestos soportan la visualización rápida de este segmento.</div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </SidebarInset>
    </div>
  );
}
