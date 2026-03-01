
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
  Focus,
  Zap,
  DollarSign,
  Layers,
  Filter,
  PieChart as PieIcon,
  Maximize2,
  Info,
  ChevronRight,
  TrendingUp,
  X
} from 'lucide-react';
import {
  ResponsiveContainer,
  Tooltip,
  Treemap
} from 'recharts';
import { useFirestore, useMemoFirebase, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, orderBy, query, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

const COLORS = [
  '#1E3A8A', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', 
  '#0F172A', '#334155', '#64748B', '#94A3B8', '#CBD5E1',
  '#7C2D12', '#9A3412', '#C2410C', '#EA580C', '#F97316'
];

export default function VpDashboard() {
  const db = useFirestore();
  const { isAuthReady } = useUser();
  const [mounted, setMounted] = useState(false);
  const [formatFilter, setFormatFilter] = useState('all');
  const [activeTab, setActivePieTab] = useState<'80' | '20'>('80');
  const [selectedDiscipline, setSelectedDiscipline] = useState<any | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  // Consultar taxonomía (Hitos principales)
  const taxonomyQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_disciplines'), orderBy('impact', 'desc')) : null, [db]);
  const { data: taxonomyDocs, isLoading: isTaxLoading } = useCollection(taxonomyQuery);

  const formats = ["SAMS CLUB", "WALMART SUPERCENTER", "BODEGA AURRERA", "WALMART EXPRESS", "MI BODEGA"];

  const paretoData = useMemo(() => {
    if (!taxonomyDocs) return [];
    
    const totalImpact = globalAgg?.totalImpact || 1;
    let cumulative = 0;
    
    return taxonomyDocs.map((d, index) => {
      cumulative += d.impact || 0;
      const pct = totalImpact > 0 ? ((d.impact || 0) / totalImpact) * 100 : 0;
      return {
        id: d.id,
        name: d.name || d.id || 'INDEFINIDA',
        value: d.impact || 0,
        impact: d.impact || 0,
        percentage: Number(pct.toFixed(1)),
        cumulativePercentage: (cumulative / totalImpact) * 100,
        count: d.count || 0,
        color: COLORS[index % COLORS.length],
        subs: d.subs || {}
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
    const { root, depth, x, y, width, height, index, name, impact, percentage, color } = props;
    if (width < 40 || height < 40) return null;

    const safeName = String(name || 'INDEFINIDA');

    return (
      <g 
        className="cursor-pointer hover:opacity-80 transition-opacity" 
        onClick={() => setSelectedDiscipline(props)}
      >
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: color || COLORS[index % COLORS.length],
            stroke: '#fff',
            strokeWidth: 2,
          }}
        />
        {width > 60 && height > 40 && (
          <>
            <text
              x={x + 10}
              y={y + 20}
              fill="#fff"
              fontSize={10}
              fontWeight="900"
              className="uppercase tracking-tighter"
            >
              {safeName.substring(0, 20)}
            </text>
            <text
              x={x + 10}
              y={y + 35}
              fill="rgba(255,255,255,0.8)"
              fontSize={9}
              fontWeight="bold"
            >
              {formatCurrency(impact)}
            </text>
            <text
              x={x + 10}
              y={y + height - 10}
              fill="rgba(255,255,255,0.6)"
              fontSize={14}
              fontWeight="900"
            >
              {percentage}%
            </text>
          </>
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
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter font-headline">Dashboard Ejecutivo de Vicepresidencia</h1>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Análisis Forense de Desviaciones • Walmart Internacional</p>
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
                <span className="text-[8px] font-black uppercase text-accent">Modelo Pareto</span>
              </div>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-blue-600 p-6 rounded-3xl">
              <div className="flex justify-between items-start mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registros Auditados</p>
                <Layers className="h-4 w-4 text-blue-600 opacity-20" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{(globalAgg?.totalProcessed || 0).toLocaleString()}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Normalizados por Gemini 2.5</p>
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
                  <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Visualización por Disciplina y Volumen Económico</CardDescription>
                </div>
                <Badge className="bg-primary text-white border-none text-[9px] font-black px-5 py-2 shadow-xl shadow-primary/20 rounded-full">JERARQUÍA PARETO</Badge>
              </CardHeader>
              <CardContent className="h-[550px] p-8">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={paretoData.slice(0, 20)}
                    dataKey="value"
                    stroke="#fff"
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
                  <div key={`${item.id}-${i}`} className="group cursor-pointer" onClick={() => setSelectedDiscipline(item)}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-3">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${activeTab === '80' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                          {i + 1}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight group-hover:text-primary transition-colors leading-none">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.count} Órdenes de Cambio</p>
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

        <Dialog open={!!selectedDiscipline} onOpenChange={(open) => !open && setSelectedDiscipline(null)}>
          <DialogContent className="max-w-3xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white">
            <div className="bg-slate-900 p-10 text-white relative">
              <div className="flex justify-between items-start mb-6">
                <Badge className="bg-accent text-white border-none px-4 py-1 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-accent/20">Análisis Forense</Badge>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Impacto Total de Disciplina</p>
                  <h3 className="text-4xl font-black text-white tracking-tighter">{formatCurrency(selectedDiscipline?.impact || 0)}</h3>
                </div>
              </div>
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter">{selectedDiscipline?.name}</DialogTitle>
              <p className="text-slate-400 text-sm mt-2 font-medium">Esta disciplina representa el <span className="text-accent font-bold">{selectedDiscipline?.percentage}%</span> de las desviaciones totales de Walmart.</p>
            </div>
            <ScrollArea className="max-h-[60vh] p-10">
              <div className="space-y-10">
                <section className="space-y-6">
                  <div className="flex items-center gap-3 border-b pb-4">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h4 className="text-xs font-black uppercase text-primary tracking-[0.2em]">Desglose de Sub-Drivers</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {Object.entries(selectedDiscipline?.subs || {}).sort((a: any, b: any) => b[1].impact - a[1].impact).map(([name, data]: any, i) => (
                      <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary transition-all">
                        <div className="space-y-1">
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{data.count} Órdenes Detectadas</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">{formatCurrency(data.impact)}</p>
                          <p className="text-[9px] font-bold text-primary uppercase">Participación Crítica</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-primary/5 p-8 rounded-3xl border border-primary/10">
                  <div className="flex items-center gap-3 mb-4">
                    <Zap className="h-5 w-5 text-primary" />
                    <h4 className="text-xs font-black uppercase text-primary tracking-[0.2em]">Recomendación de Mitigación</h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed italic">
                    Debido a que <span className="font-bold text-slate-800">{selectedDiscipline?.name}</span> es un componente del Vital Few, se recomienda realizar una auditoría de diseño inmediata en este rubro para reducir la variabilidad en al menos un <span className="text-primary font-bold">15% anual</span>.
                  </p>
                </section>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </div>
  );
}
