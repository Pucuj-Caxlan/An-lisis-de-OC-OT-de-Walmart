
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  CheckCircle2, 
  Focus,
  PieChart as PieIcon,
  Maximize2,
  Filter,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  Tooltip,
  Treemap
} from 'recharts';
import { useFirestore, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from '@/components/ui/scroll-area';

const COLORS = ['#002D72', '#0071CE', '#FFC220', '#041E42', '#44883E', '#F47321', '#E31837', '#54585A'];

export default function VpDashboard() {
  const db = useFirestore();
  const { isAuthReady } = useUser();
  const [mounted, setMounted] = useState(false);
  const [formatFilter, setFormatFilter] = useState('all');
  const [activeTab, setActivePieTab] = useState<'80' | '20'>('80');

  useEffect(() => { setMounted(true); }, []);

  // 1. Cargar Taxonomía de Formatos
  const formatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('name', 'asc')) : null, [db]);
  const { data: availableFormats } = useCollection(formatsQuery);

  // 2. Cargar Datos Materializados (Agregados)
  // Si es 'all', cargamos de taxonomy_disciplines (global)
  // Si es un formato, cargamos de la subcolección materializada
  const analyticsPath = formatFilter === 'all' 
    ? 'taxonomy_disciplines' 
    : `aggregates/format_analytics/formats/${formatFilter}/disciplines_stats`;

  const analyticsQuery = useMemoFirebase(() => {
    if (!db || !isAuthReady) return null;
    return query(collection(db, analyticsPath), orderBy('impact', 'desc'));
  }, [db, isAuthReady, analyticsPath, formatFilter]);

  const { data: analyticsData, isLoading } = useCollection(analyticsQuery);

  const processedData = useMemo(() => {
    if (!analyticsData || analyticsData.length === 0) return { pareto: [], totalImpact: 0, totalCount: 0 };

    const totalImpact = analyticsData.reduce((acc, curr) => acc + (curr.impact || 0), 0);
    const totalCount = analyticsData.reduce((acc, curr) => acc + (curr.count || 0), 0);
    
    let cumulative = 0;
    const pareto = analyticsData.map((d, index) => {
      const impact = Number(d.impact || 0);
      cumulative += impact;
      return {
        id: d.id,
        name: d.name || d.id,
        value: impact || 0.01,
        impact: impact,
        percentage: Number(((impact / (totalImpact || 1)) * 100).toFixed(1)),
        cumulativePercentage: (cumulative / (totalImpact || 1)) * 100,
        count: d.count || 0,
        color: COLORS[index % COLORS.length]
      };
    });

    return { pareto, totalImpact, totalCount };
  }, [analyticsData]);

  const vitalFew = useMemo(() => processedData.pareto.filter(p => p.cumulativePercentage <= 85), [processedData]);
  const usefulMany = useMemo(() => processedData.pareto.filter(p => p.cumulativePercentage > 85), [processedData]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  const CustomizedContent = (props: any) => {
    const { x, y, width, height, name, impact, percentage, color } = props;
    if (width < 40 || height < 40) return null;
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} style={{ fill: color, stroke: '#fff', strokeWidth: 2 }} />
        {width > 60 && height > 40 && (
          <>
            <text x={x + 8} y={y + 18} fill="#fff" fontSize={10} fontWeight="900" className="uppercase">{String(name).substring(0, 15)}</text>
            <text x={x + 8} y={y + 32} fill="rgba(255,255,255,0.8)" fontSize={8} fontWeight="bold">{formatCurrency(impact)}</text>
            <text x={x + 8} y={y + height - 10} fill="#fff" fontSize={14} fontWeight="900">{percentage}%</text>
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
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter font-headline">Dashboard Ejecutivo de Vicepresidencia</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Análisis Forense de Desviaciones • Vistas Materializadas</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border">
              <Filter className="h-3.5 w-3.5 text-slate-400 ml-2" />
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="h-9 w-72 bg-white border-none text-[10px] font-black uppercase rounded-xl shadow-sm">
                  <SelectValue placeholder="Filtrar por Formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS FORMATOS (GLOBAL)</SelectItem>
                  {availableFormats?.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name} ({f.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="h-9 bg-emerald-50 text-emerald-700 border-emerald-100 gap-2 px-4 uppercase font-black text-[9px] rounded-xl shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" /> REGISTROS AUDITADOS: {processedData.totalCount.toLocaleString()}
            </Badge>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Materializado</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(processedData.totalImpact)}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Segun Filtro: {formatFilter.toUpperCase()}</p>
            </Card>
            <Card className="border-none shadow-md bg-slate-900 text-white border-l-4 border-l-accent p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Concentración Pocos Críticos</p>
              <h2 className="text-3xl font-black text-white tracking-tighter">85%</h2>
              <Progress value={85} className="h-1 bg-white/10 mt-2" />
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-blue-600 p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Muestra Auditada</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{processedData.totalCount.toLocaleString()}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Total Segmento</p>
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hitos Vitales</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{vitalFew.length}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Drivers del 85%</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden rounded-[2.5rem]">
              <CardHeader className="bg-slate-50/50 border-b py-8 px-10">
                <CardTitle className="text-sm font-black uppercase text-primary tracking-[0.2em] flex items-center gap-3">
                  <Maximize2 className="h-5 w-5" /> Mapa de Calor: Concentración de Impacto
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Desglose por Formato Auditado</CardDescription>
              </CardHeader>
              <CardContent className="h-[550px] p-8">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-slate-200" /></div>
                ) : processedData.pareto.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap data={processedData.pareto} dataKey="value" stroke="#fff" content={<CustomizedContent />}>
                      <Tooltip 
                        contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: '#0F172A', color: '#fff', padding: '15px' }}
                        formatter={(val: number) => [formatCurrency(val), 'Impacto Económico']}
                      />
                    </Treemap>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                    <AlertCircle className="h-16 w-16 opacity-10" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sin datos sincronizados para este formato. Ejecute el Backfill.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-white rounded-[2.5rem] flex flex-col">
              <CardHeader className="py-8 px-10 border-b bg-slate-50/30">
                <div className="flex items-center justify-between mb-4">
                  <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-widest flex items-center gap-3">
                    <PieIcon className="h-5 w-5 text-accent" /> Análisis 80/20
                  </CardTitle>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border">
                    <Button variant={activeTab === '80' ? 'default' : 'ghost'} size="sm" onClick={() => setActivePieTab('80')} className="h-7 text-[8px] font-black uppercase px-3 rounded-lg">Pocos Críticos</Button>
                    <Button variant={activeTab === '20' ? 'default' : 'ghost'} size="sm" onClick={() => setActivePieTab('20')} className="h-7 text-[8px] font-black uppercase px-3 rounded-lg">Muchos Útiles</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                {(activeTab === '80' ? vitalFew : usefulMany).map((item, i) => (
                  <div key={item.id} className="group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-3">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${activeTab === '80' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-none">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.count} Órdenes</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black text-slate-900">{formatCurrency(item.impact)}</p>
                        <p className="text-[8px] font-bold text-emerald-600 uppercase">{item.percentage}% participación</p>
                      </div>
                    </div>
                    <div className="relative h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                      <div className={`h-full ${activeTab === '80' ? 'bg-primary' : 'bg-slate-300'}`} style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
              <div className="p-10 bg-slate-900 text-white rounded-b-[2.5rem]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-2">Diagnóstico de Segmento</p>
                <div className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-accent pl-4">
                  El análisis materializado para <span className="text-white font-bold">{formatFilter === 'all' ? 'Global' : formatFilter}</span> confirma que {vitalFew.length} categorías concentran el 85% del impacto.
                </div>
              </div>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
