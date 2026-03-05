
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
  Settings2,
  Palette,
  TrendingUp,
  Info,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  Tooltip,
  Treemap
} from 'recharts';
import { useFirestore, useMemoFirebase, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, orderBy, query, where, limit, getDocs, documentId } from 'firebase/firestore';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';

const THEMES = {
  corporate: ['#002D72', '#0071CE', '#FFC220', '#041E42', '#44883E', '#F47321', '#E31837', '#000000', '#54585A', '#74767B'],
  vibrant: ['#2563EB', '#D97706', '#059669', '#7C3AED', '#DB2777', '#DC2626', '#4B5563', '#0891B2', '#4F46E5', '#9333EA'],
  ocean: ['#0C4A6E', '#075985', '#0369A1', '#0284C7', '#0EA5E9', '#38BDF8', '#7DD3FC', '#BAE6FD', '#E0F2FE', '#F0F9FF'],
  safety: ['#1E3A8A', '#111827', '#B91C1C', '#92400E', '#065F46', '#3730A3', '#831843', '#450A0A', '#1E40AF', '#14532D']
};

export default function VpDashboard() {
  const db = useFirestore();
  const { isAuthReady } = useUser();
  const [mounted, setMounted] = useState(false);
  const [formatFilter, setFormatFilter] = useState('all');
  const [availableFormats, setAvailableFormats] = useState<string[]>([]);
  const [formatMap, setFormatMap] = useState<Record<string, string>>({});
  const [activeTab, setActivePieTab] = useState<'80' | '20'>('80');
  const [selectedDiscipline, setSelectedDiscipline] = useState<any | null>(null);
  
  const [colorTheme, setColorTheme] = useState<keyof typeof THEMES>('corporate');
  const [textSize, setTextSize] = useState<'sm' | 'md' | 'lg'>('md');

  useEffect(() => { setMounted(true); }, []);

  // Taxonomía oficial de formatos (SSOT)
  const taxonomyFormatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('name', 'asc')) : null, [db]);
  const { data: taxonomyFormats } = useCollection(taxonomyFormatsQuery);

  useEffect(() => {
    if (taxonomyFormats && taxonomyFormats.length > 0) {
      const fMap: Record<string, string> = {};
      const fList: string[] = [];
      taxonomyFormats.forEach(f => {
        const name = f.name || f.id;
        fMap[name] = name;
        fList.push(name);
      });
      setFormatMap(fMap);
      setAvailableFormats(fList);
      console.log("[Dashboard Debug] Formatos cargados desde taxonomía:", fList);
    } else if (db && isAuthReady) {
      // Fallback: Descubrimiento dinámico si la taxonomía está vacía
      const fetchFormatsFallback = async () => {
        try {
          const q = query(collection(db, 'orders'), limit(3000));
          const snap = await getDocs(q);
          const fMap: Record<string, string> = {};
          const formatsSet = new Set<string>();
          snap.forEach(doc => {
            const raw = doc.data().format;
            if (raw) {
              const normalized = String(raw).trim().toUpperCase();
              fMap[normalized] = String(raw);
              formatsSet.add(normalized);
            }
          });
          setFormatMap(fMap);
          setAvailableFormats(Array.from(formatsSet).sort());
        } catch (e) { console.error("Fallback discovery failed:", e); }
      };
      fetchFormatsFallback();
    }
  }, [taxonomyFormats, db, isAuthReady]);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  const taxonomyQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_disciplines'), orderBy('impact', 'desc')) : null, [db]);
  const { data: globalTaxonomyDocs, isLoading: isTaxLoading } = useCollection(taxonomyQuery);

  const formatOrdersQuery = useMemoFirebase(() => {
    if (!db || formatFilter === 'all') return null;
    const rawValueToQuery = formatMap[formatFilter] || formatFilter;
    return query(
      collection(db, 'orders'), 
      where('format', '==', rawValueToQuery),
      orderBy('impactoNeto', 'desc'),
      orderBy(documentId(), 'desc'),
      limit(3000)
    );
  }, [db, formatFilter, formatMap]);

  const { data: formatOrders, isLoading: isOrdersLoading } = useCollection(formatOrdersQuery);

  const processedData = useMemo(() => {
    const colors = THEMES[colorTheme];
    
    if (formatFilter === 'all') {
      if (!globalTaxonomyDocs || globalTaxonomyDocs.length === 0) {
        return { pareto: [], totalImpact: globalAgg?.totalImpact || 0, totalCount: globalAgg?.totalOrders || 0 };
      }
      const totalImpact = globalAgg?.totalImpact || 1;
      let cumulative = 0;
      const pareto = globalTaxonomyDocs.map((d, index) => {
        const impact = Number(d.impact || 0);
        cumulative += impact;
        return {
          id: d.id || `${d.name}-${index}`,
          name: d.name || d.id || 'SIN CLASIFICAR',
          value: impact > 0 ? impact : 0.01,
          impact: impact,
          percentage: Number(((impact / totalImpact) * 100).toFixed(1)),
          cumulativePercentage: (cumulative / totalImpact) * 100,
          count: d.count || 0,
          color: colors[index % colors.length],
          subs: d.subs || {}
        };
      });
      return { pareto, totalImpact, totalCount: globalAgg?.totalOrders || 0 };
    }

    if (!formatOrders || formatOrders.length === 0) {
      return { pareto: [], totalImpact: 0, totalCount: 0 };
    }

    const discMap: Record<string, any> = {};
    let totalFormatImpact = 0;
    formatOrders.forEach(order => {
      const disc = String(order.disciplina_normalizada || 'PENDIENTE DE CLASIFICACIÓN').trim().toUpperCase();
      const sub = String(order.subcausa_normalizada || 'SIN SUB-DISCIPLINA').trim().toUpperCase();
      const impact = Number(order.impactoNeto || 0);
      totalFormatImpact += impact;
      if (!discMap[disc]) discMap[disc] = { name: disc, impact: 0, count: 0, subs: {} };
      discMap[disc].impact += impact;
      discMap[disc].count += 1;
      if (!discMap[disc].subs[sub]) discMap[disc].subs[sub] = { impact: 0, count: 0 };
      discMap[disc].subs[sub].impact += impact;
      discMap[disc].subs[sub].count += 1;
    });

    const sortedDiscs = Object.values(discMap).sort((a: any, b: any) => b.impact - a.impact);
    let cumulativeFormat = 0;
    const finalTotalImpact = totalFormatImpact || 1;
    const pareto = sortedDiscs.map((d: any, index) => {
      cumulativeFormat += d.impact;
      return {
        ...d,
        id: `${d.name}-${index}`,
        value: d.impact > 0 ? d.impact : 0.01,
        impact: d.impact,
        percentage: Number(((d.impact / finalTotalImpact) * 100).toFixed(1)),
        cumulativePercentage: (cumulativeFormat / finalTotalImpact) * 100,
        color: colors[index % colors.length]
      };
    });
    return { pareto, totalImpact: totalFormatImpact, totalCount: formatOrders.length };
  }, [formatFilter, globalTaxonomyDocs, globalAgg, formatOrders, colorTheme]);

  const vitalFew = useMemo(() => processedData.pareto.filter(p => p.cumulativePercentage <= 85), [processedData]);
  const usefulMany = useMemo(() => processedData.pareto.filter(p => p.cumulativePercentage > 85), [processedData]);

  const formatCurrency = (val: number) => {
    if (!mounted || isNaN(val)) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  const CustomizedContent = (props: any) => {
    const { x, y, width, height, name, impact, percentage, color } = props;
    if (width < 40 || height < 40) return null;
    const sizes = { sm: { title: 8, meta: 7, pct: 10 }, md: { title: 10, meta: 8, pct: 14 }, lg: { title: 12, meta: 9, pct: 18 } };
    const currentSize = sizes[textSize];
    return (
      <g className="cursor-pointer hover:opacity-90 transition-all" onClick={() => setSelectedDiscipline(props)}>
        <rect x={x} y={y} width={width} height={height} style={{ fill: color, stroke: '#fff', strokeWidth: 1.5 }} />
        {width > 50 && height > 40 && (
          <>
            <text x={x + 8} y={y + 18} fill="#fff" fontSize={currentSize.title} fontWeight="900" className="uppercase tracking-tighter drop-shadow-md">
              {String(name).length > 15 ? String(name).substring(0, 13) + '..' : name}
            </text>
            <text x={x + 8} y={y + 32} fill="rgba(255,255,255,0.95)" fontSize={currentSize.meta} fontWeight="bold" className="drop-shadow-sm">
              {formatCurrency(Number(impact))}
            </text>
            <text x={x + 8} y={y + height - 8} fill="rgba(255,255,255,0.8)" fontSize={currentSize.pct} fontWeight="900" className="drop-shadow-lg">
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
                <SelectTrigger className="h-9 w-64 bg-white border-none text-[10px] font-black uppercase rounded-xl shadow-sm focus:ring-0">
                  <SelectValue placeholder="Filtrar por Formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS FORMATOS</SelectItem>
                  {availableFormats.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="h-9 bg-emerald-50 text-emerald-700 border-emerald-100 gap-2 px-4 uppercase font-black text-[9px] rounded-xl shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" /> Registros Auditados: {processedData.totalCount.toLocaleString()}
            </Badge>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Materializado</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(processedData.totalImpact)}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">{formatFilter === 'all' ? 'Walmart Global' : formatFilter}</p>
            </Card>
            <Card className="border-none shadow-md bg-slate-900 text-white border-l-4 border-l-accent p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Concentración Pocos Críticos</p>
              <h2 className="text-3xl font-black text-white tracking-tighter">85%</h2>
              <Progress value={85} className="h-1 bg-white/10 mt-2" />
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-blue-600 p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Muestra de Análisis</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{processedData.totalCount.toLocaleString()}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Registros Normalizados</p>
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hitos Vitales</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{vitalFew.length}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Generan el 85% del impacto</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden rounded-[2.5rem]">
              <CardHeader className="bg-slate-50/50 border-b py-8 px-10">
                <CardTitle className="text-sm font-black uppercase text-primary tracking-[0.2em] flex items-center gap-3">
                  <Maximize2 className="h-5 w-5" /> Mapa de Calor: Concentración de Impacto
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Desglose técnico para {formatFilter === 'all' ? 'Walmart International' : formatFilter}</CardDescription>
              </CardHeader>
              <CardContent className="h-[550px] p-8">
                {processedData.pareto.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap data={processedData.pareto.slice(0, 40)} dataKey="value" stroke="#fff" content={<CustomizedContent />}>
                      <Tooltip 
                        contentStyle={{ borderRadius: '20px', border: 'none', backgroundColor: '#0F172A', color: '#fff', padding: '15px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
                        formatter={(val: number) => [formatCurrency(val), 'Impacto Económico']}
                      />
                    </Treemap>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                    <AlertCircle className="h-16 w-16 opacity-10" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sin datos detectados para este segmento</p>
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
                  <div key={item.id} className="group cursor-pointer" onClick={() => setSelectedDiscipline(item)}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex gap-3">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${activeTab === '80' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight group-hover:text-primary transition-colors leading-none">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.count} Órdenes Detectadas</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black text-slate-900">{formatCurrency(item.impact)}</p>
                        <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">{item.percentage}% participación</p>
                      </div>
                    </div>
                    <div className="relative h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${activeTab === '80' ? 'bg-primary' : 'bg-slate-300'}`} style={{ width: `${Math.min(100, item.percentage * 4)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
              <div className="p-10 bg-slate-900 text-white rounded-b-[2.5rem]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-2">Diagnóstico de Segmento</p>
                <div className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-accent pl-4">
                  En <span className="text-white font-bold">{formatFilter === 'all' ? 'Walmart Global' : formatFilter}</span>, el análisis identifica que {vitalFew.length} categorías concentran el 85% de las desviaciones.
                </div>
              </div>
            </Card>
          </div>
        </main>

        <Dialog open={!!selectedDiscipline} onOpenChange={(open) => !open && setSelectedDiscipline(null)}>
          <DialogContent className="max-w-3xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white">
            <div className="bg-slate-900 p-10 text-white">
              <div className="flex justify-between items-start mb-6">
                <Badge className="bg-accent text-white border-none px-4 py-1 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-accent/20">Detalle de Disciplina</Badge>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Impacto ({formatFilter})</p>
                  <h3 className="text-4xl font-black text-white tracking-tighter">{formatCurrency(selectedDiscipline?.impact || 0)}</h3>
                </div>
              </div>
              <DialogTitle className="text-3xl font-black uppercase tracking-tighter">{selectedDiscipline?.name}</DialogTitle>
            </div>
            <ScrollArea className="max-h-[60vh] p-10">
              <div className="grid grid-cols-1 gap-4">
                {selectedDiscipline?.subs && Object.entries(selectedDiscipline.subs).map(([name, data]: any, i) => (
                  <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-black text-slate-800 uppercase">{name}</p>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{formatCurrency(data.impact)}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{data.count} Órdenes</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </div>
  );
}
