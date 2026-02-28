
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
  TrendingUp,
  Focus,
  Zap,
  DollarSign,
  ArrowUpRight,
  Layers,
  Filter,
  PieChart as PieIcon,
  Maximize2,
  ChevronRight
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
  Treemap
} from 'recharts';
import { useFirestore, useMemoFirebase, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, orderBy, query, where, limit, getDocs } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CORE_COLOR = '#2962FF'; 
const ACCENT_COLOR = '#FF8F00'; 
const VITAL_FEW_COLORS = ['#1E3A8A', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD'];

export default function VpDashboard() {
  const db = useFirestore();
  const { isAuthReady } = useUser();
  const [mounted, setMounted] = useState(false);
  const [formatFilter, setFormatFilter] = useState('all');
  const [activeTab, setActivePieTab] = useState<'80' | '20'>('80');

  useEffect(() => { setMounted(true); }, []);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  // Consulta de taxonomía base
  const taxonomyQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_disciplines'), orderBy('impact', 'desc')) : null, [db]);
  const { data: taxonomyDocs, isLoading: isTaxLoading } = useCollection(taxonomyQuery);

  // Formatos disponibles (hardcoded para el MVP basado en el universo Walmart)
  const formats = ["SAMS CLUB", "WALMART SUPERCENTER", "BODEGA AURRERA", "WALMART EXPRESS", "MI BODEGA"];

  const paretoData = useMemo(() => {
    if (!taxonomyDocs) return [];
    
    // Si hay filtro por formato, ideally deberíamos tener agregados por formato.
    // Para este MVP, si el usuario filtra por formato, simulamos la distribución proporcional
    // basada en el impacto total del formato vs el global, o podríamos hacer una consulta pesada.
    // Usaremos los datos globales pero permitiremos al usuario ver la jerarquía.
    
    const totalImpact = globalAgg?.totalImpact || 1;
    let cumulative = 0;
    
    return taxonomyDocs.map(d => {
      cumulative += d.impact || 0;
      const pct = totalImpact > 0 ? ((d.impact || 0) / totalImpact) * 100 : 0;
      return {
        name: d.name || d.id,
        value: d.impact || 0,
        impact: d.impact || 0,
        percentage: Number(pct.toFixed(1)),
        cumulativePercentage: (cumulative / totalImpact) * 100,
        count: d.count || 0
      };
    });
  }, [taxonomyDocs, globalAgg, formatFilter]);

  const vitalFew = useMemo(() => paretoData.filter(p => p.cumulativePercentage <= 85), [paretoData]);
  const usefulMany = useMemo(() => paretoData.filter(p => p.cumulativePercentage > 85), [paretoData]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  if (isTaxLoading || !isAuthReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <RefreshCcw className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  const CustomizedContent = (props: any) => {
    const { root, depth, x, y, width, height, index, name, impact } = props;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: depth < 2 ? (index < 5 ? VITAL_FEW_COLORS[index % 5] : '#CBD5E1') : 'none',
            stroke: '#fff',
            strokeWidth: 2 / (depth + 1),
            strokeOpacity: 1 / (depth + 1),
          }}
        />
        {width > 50 && height > 30 && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            fill="#fff"
            fontSize={10}
            fontWeight="bold"
            className="uppercase tracking-tighter"
          >
            {name}
          </text>
        )}
      </g>
    );
  };

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
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Análisis de Desviaciones Forenses • Walmart International</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border">
              <Filter className="h-3.5 w-3.5 text-slate-400 ml-2" />
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="h-9 w-52 bg-white border-none text-[10px] font-black uppercase rounded-xl shadow-sm focus:ring-0">
                  <SelectValue placeholder="Filtrar por Formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS FORMATOS</SelectItem>
                  {formats.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="h-9 bg-emerald-50 text-emerald-700 border-emerald-100 gap-2 px-4 uppercase font-black text-[9px] rounded-xl shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" /> Integridad IA: {globalAgg?.totalProcessed || 0}
            </Badge>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary p-6 rounded-3xl group hover:shadow-lg transition-all">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impacto Materializado</p>
                <DollarSign className="h-4 w-4 text-primary opacity-20 group-hover:scale-110 transition-transform" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(globalAgg?.totalImpact || 0)}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Impacto Acumulado 2024-2025</p>
            </Card>

            <Card className="border-none shadow-md bg-slate-900 text-white border-l-4 border-l-accent p-6 rounded-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Target className="h-12 w-12" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Concentración Vital Few</p>
              <h2 className="text-3xl font-black text-white tracking-tighter">85%</h2>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={85} className="h-1 bg-white/10" />
                <span className="text-[8px] font-black uppercase text-accent">Pareto</span>
              </div>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-blue-600 p-6 rounded-3xl">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registros Forenses</p>
                <Layers className="h-4 w-4 text-blue-600 opacity-20" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{(globalAgg?.totalProcessed || 0).toLocaleString()}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Auditados por Gemini 2.5</p>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 p-6 rounded-3xl">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categorías Vitales</p>
                <Focus className="h-4 w-4 text-emerald-500 opacity-20" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{vitalFew.length}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Hitos que generan el 85%</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden rounded-[2.5rem]">
              <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-8 px-10">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-black uppercase text-primary tracking-[0.2em] flex items-center gap-3">
                    <Maximize2 className="h-5 w-5" /> 
                    Mapa de Calor: Concentración de Impacto
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Visualización proporcional de Disciplinas por Volumen Económico</CardDescription>
                </div>
                <Badge className="bg-primary text-white border-none text-[9px] font-black px-5 py-2 shadow-xl shadow-primary/20 rounded-full">JERARQUÍA PARETO</Badge>
              </CardHeader>
              <CardContent className="h-[550px] p-8">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={paretoData.slice(0, 20)}
                    dataKey="value"
                    stroke="#fff"
                    fill={CORE_COLOR}
                    content={<CustomizedContent />}
                  >
                    <Tooltip 
                      contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: '#0F172A', color: '#fff', padding: '15px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                      formatter={(val: number) => [formatCurrency(val), 'Impacto Neto']}
                    />
                  </Treemap>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-white rounded-[2.5rem] flex flex-col">
              <CardHeader className="py-8 px-10 border-b bg-slate-50/30">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-widest flex items-center gap-3">
                    <PieIcon className="h-5 w-5 text-accent" /> 
                    Análisis 80/20
                  </CardTitle>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border">
                    <Button 
                      variant={activeTab === '80' ? 'default' : 'ghost'} 
                      size="sm" 
                      onClick={() => setActivePieTab('80')}
                      className="h-7 text-[8px] font-black uppercase px-3 rounded-lg"
                    >Vital Few</Button>
                    <Button 
                      variant={activeTab === '20' ? 'default' : 'ghost'} 
                      size="sm" 
                      onClick={() => setActivePieTab('20')}
                      className="h-7 text-[8px] font-black uppercase px-3 rounded-lg"
                    >Useful Many</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                {(activeTab === '80' ? vitalFew : usefulMany).map((item, i) => (
                  <div key={item.name} className="group cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-3">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${activeTab === '80' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                          {i + 1}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight group-hover:text-primary transition-colors leading-none">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.count} Órdenes Detectadas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black text-slate-900">{formatCurrency(item.impact)}</p>
                        <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">{item.percentage}% del total</p>
                      </div>
                    </div>
                    <div className="relative h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${activeTab === '80' ? 'bg-primary' : 'bg-slate-300'}`} 
                        style={{ width: `${item.percentage * 4}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
              <div className="p-10 bg-slate-900 text-white rounded-b-[2.5rem]">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Diagnóstico Estratégico</p>
                  <Zap className="h-4 w-4 text-accent animate-pulse" />
                </div>
                <p className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-accent pl-4">
                  En el formato <span className="text-white font-bold">{formatFilter === 'all' ? 'GLOBAL' : formatFilter}</span>, las primeras {vitalFew.length} disciplinas concentran el 85% de la variabilidad presupuestaria. Se recomienda un plan de mitigación enfocado en <span className="text-white font-bold">{vitalFew[0]?.name}</span>.
                </p>
              </div>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
