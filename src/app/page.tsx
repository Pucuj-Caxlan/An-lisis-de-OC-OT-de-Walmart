"use client"

import React, { useState, useMemo, useEffect, memo } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Focus,
  PieChart as PieIcon,
  Maximize2,
  Filter,
  Loader2,
  ShieldCheck,
  Search,
  CalendarDays,
  Target,
  ChevronRight,
  Layers,
  Info,
  TrendingUp
} from 'lucide-react';
import {
  ResponsiveContainer,
  Tooltip,
  Treemap
} from 'recharts';
import { useFirestore, useMemoFirebase, useUser, useCollection, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, where, limit, getDocs } from 'firebase/firestore';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from '@/hooks/use-toast';

const COLORS = ['#002D72', '#0071CE', '#FFC220', '#041E42', '#44883E', '#F47321', '#E31837', '#54585A'];

const GET_RAMO = (discipline: string): string => {
  const d = String(discipline || '').toUpperCase().trim();
  
  if (d.includes('CIVIL') || d.includes('ARQUITECTÓNICA') || d.includes('TERRACERÍAS') || d.includes('EDIFICACIÓN') || d.includes('OBRA GRIS')) 
    return 'OBRA CIVIL';
  
  if (d.includes('INGENIERÍA') || d.includes('DISEÑO') || d.includes('ARQUITECTURA')) 
    return 'INGENIERÍA Y DISEÑO';
  
  if (d.includes('ELÉCTRICA') || d.includes('HIDRÁULICA') || d.includes('AIRE') || d.includes('REFRIGERACIÓN') || d.includes('SANITARIA') || d.includes('PCI') || d.includes('VOZ') || d.includes('ESPECIALES')) 
    return 'INSTALACIONES (MEP)';
  
  if (d.includes('GESTIÓN') || d.includes('ADMINISTRACIÓN') || d.includes('SUPERVISIÓN') || d.includes('GERENCIA') || d.includes('TRÁMITES') || d.includes('LICENCIAS')) 
    return 'GESTIÓN Y ADMON';
  
  if (d.includes('MOBILIARIO') || d.includes('EQUIPO') || d.includes('COCINA') || d.includes('RACKS') || d.includes('SEÑALIZACIÓN')) 
    return 'EQUIPAMIENTO';

  return 'OTROS';
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl text-white z-50">
        <p className="text-[10px] font-black uppercase text-yellow-500 mb-1 tracking-widest">{data.name}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Impacto:</span>
            <span className="text-xs font-black">
              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(data.impact || data.value || 0)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Participación:</span>
            <span className="text-xs font-black">{data.percentage || 0}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const TreemapNode = memo((props: any) => {
  const { x, y, width, height, name, impact, value, percentage, color, onClick, formatCurrency } = props;
  if (width < 30 || height < 30) return null;
  const realImpact = impact || value;
  const showFullInfo = width > 120 && height > 80;
  const showCompactInfo = width > 60 && height > 40;
  const showNameOnly = width > 40 && height > 25;

  return (
    <g onClick={() => onClick(props)} className="cursor-pointer group transition-all duration-300">
      <rect x={x} y={y} width={width} height={height} style={{ fill: color, stroke: '#fff', strokeWidth: 1.5 }} className="group-hover:opacity-85" />
      {showNameOnly && (
        <text x={x + 6} y={y + 16} fill="#fff" fontSize={showFullInfo ? 11 : 9} fontWeight="900" className="uppercase pointer-events-none drop-shadow-sm">
          {String(name).length > (width / 7) ? `${String(name).substring(0, Math.floor(width / 7))}...` : name}
        </text>
      )}
      {showCompactInfo && (
        <text x={x + 6} y={y + (showFullInfo ? 32 : 28)} fill="rgba(255,255,255,0.9)" fontSize={8} fontWeight="700" className="pointer-events-none">
          {formatCurrency(realImpact)}
        </text>
      )}
      {showFullInfo && (
        <text x={x + 6} y={y + height - 10} fill="#fff" fontSize={16} fontWeight="900" className="pointer-events-none tabular-nums">
          {percentage}%
        </text>
      )}
    </g>
  );
});

TreemapNode.displayName = 'TreemapNode';

export default function VpDashboard() {
  const db = useFirestore();
  const { isAuthReady } = useUser();
  const [mounted, setMounted] = useState(false);
  
  const [formatFilter, setFormatFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  
  const [activePieTab, setActivePieTab] = useState<'80' | '20'>('80');
  const [selectedRamo, setSelectedRamo] = useState<any>(null);
  const [ramoDetails, setRamoDetails] = useState<{subDisciplines: any[], orders: any[]}>({ subDisciplines: [], orders: [] });
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const globalAggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(globalAggRef);

  const formatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('name', 'asc')) : null, [db]);
  const { data: availableFormats } = useCollection(formatsQuery);

  const plansQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_plans'), orderBy('name', 'asc')) : null, [db]);
  const { data: availablePlans } = useCollection(plansQuery);

  const analyticsQuery = useMemoFirebase(() => {
    if (!db || !isAuthReady) return null;
    const baseQuery = collection(db, 'hitos_analytics');
    if (yearFilter !== 'all') {
      return query(baseQuery, where('year', '==', Number(yearFilter)));
    }
    return baseQuery;
  }, [db, isAuthReady, yearFilter]);

  const { data: rawAnalytics, isLoading } = useCollection(analyticsQuery);

  const processedData = useMemo(() => {
    if (!rawAnalytics || rawAnalytics.length === 0) return { ramos: [], totalImpact: 0, totalCount: 0 };

    const ramoMap = new Map<string, any>();
    let totalImpact = 0;
    let totalCount = 0;

    rawAnalytics.forEach(d => {
      const matchFormat = formatFilter === 'all' || d.format === formatFilter;
      const matchPlan = planFilter === 'all' || d.plan === planFilter;

      if (matchFormat && matchPlan) {
        const ramoName = GET_RAMO(d.discipline || 'OTROS');
        const impact = Number(d.impact || 0);
        const count = Number(d.count || 0);
        
        totalImpact += impact;
        totalCount += count;

        if (ramoMap.has(ramoName)) {
          const existing = ramoMap.get(ramoName);
          existing.impact += impact;
          existing.count += count;
          const discName = String(d.discipline).trim().toUpperCase();
          if (!existing.subs[discName]) existing.subs[discName] = { impact: 0, count: 0 };
          existing.subs[discName].impact += impact;
          existing.subs[discName].count += count;
        } else {
          const discName = String(d.discipline).trim().toUpperCase();
          ramoMap.set(ramoName, { 
            name: ramoName, 
            impact, 
            count, 
            subs: { [discName]: { impact, count } } 
          });
        }
      }
    });

    const ramosArray = Array.from(ramoMap.values()).sort((a, b) => b.impact - a.impact);
    
    let cumulative = 0;
    const ramos = ramosArray.map((item, index) => {
      cumulative += item.impact;
      return {
        ...item,
        value: item.impact || 0.01,
        percentage: Number(((item.impact / (totalImpact || 1)) * 100).toFixed(1)),
        cumulativePercentage: (cumulative / (totalImpact || 1)) * 100,
        color: COLORS[index % COLORS.length]
      };
    });

    return { ramos, totalImpact, totalCount };
  }, [rawAnalytics, formatFilter, planFilter]);

  const vitalFew = useMemo(() => processedData.ramos.filter(p => p.cumulativePercentage <= 85 || processedData.ramos.indexOf(p) === 0), [processedData]);
  const usefulMany = useMemo(() => processedData.ramos.filter(p => !vitalFew.includes(p)), [processedData]);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  const handleRamoClick = async (ramo: any) => {
    if (!ramo || !db) return;
    
    // El objeto ramo puede venir directamente o envuelto por Recharts
    const targetData = ramo.payload || ramo;
    const targetSubs = targetData.subs;
    
    if (!targetSubs) {
      console.warn("No se encontraron sub-disciplinas para:", targetData.name);
      return;
    }

    setSelectedRamo(targetData);
    setIsLoadingDetails(true);
    
    try {
      const subs = Object.entries(targetSubs).map(([name, data]: any) => ({
        name,
        ...data,
        percentage: targetData.impact > 0 ? ((data.impact / targetData.impact) * 100).toFixed(1) : "0"
      })).sort((a, b) => b.impact - a.impact);
      
      const subNames = subs.slice(0, 10).map(s => s.name); 
      
      let q = query(
        collection(db, 'orders'),
        where('disciplina_normalizada', 'in', subNames),
        orderBy('impactoNeto', 'desc'),
        limit(20)
      );

      if (yearFilter !== 'all') q = query(q, where('year', '==', Number(yearFilter)));
      if (formatFilter !== 'all') q = query(q, where('format_normalized', '==', formatFilter));
      if (planFilter !== 'all') q = query(q, where('plan_nombre_normalizado', '==', planFilter));

      const snap = await getDocs(q);
      setRamoDetails({
        subDisciplines: subs,
        orders: snap.docs.map(d => ({ id: d.id, ...d.data() }))
      });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los detalles." });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between border-b bg-white px-8 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-6">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter font-headline">Dashboard Ejecutivo</h1>
              <div className="flex items-center gap-2 mt-1">
                 <ShieldCheck className="h-3 w-3 text-emerald-600" />
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                   Análisis por Ramos Técnicos • {processedData.totalCount.toLocaleString()} Registros
                 </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400 ml-2" />
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="h-8 w-32 bg-transparent border-none text-[10px] font-black uppercase shadow-none focus:ring-0">
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
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-8 w-40 bg-transparent border-none text-[10px] font-black uppercase shadow-none focus:ring-0">
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

            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border">
              <Filter className="h-3.5 w-3.5 text-slate-400 ml-2" />
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="h-9 w-64 bg-white border-none text-[10px] font-black uppercase rounded-xl shadow-sm">
                  <SelectValue placeholder="Formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS FORMATOS</SelectItem>
                  {availableFormats?.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name} ({f.count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto por Ramo</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(processedData.totalImpact)}</h2>
            </Card>
            <Card className="border-none shadow-md bg-slate-900 text-white border-l-4 border-l-accent p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Concentración</p>
              <h2 className="text-3xl font-black text-white tracking-tighter">80 / 20 Rule</h2>
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-blue-600 p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Órdenes Totales</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{processedData.totalCount.toLocaleString()}</h2>
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 p-6 rounded-3xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ramos Críticos</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{vitalFew.length}</h2>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden rounded-[2.5rem]">
              <CardHeader className="bg-slate-50/50 border-b py-8 px-10">
                <CardTitle className="text-sm font-black uppercase text-primary tracking-[0.2em] flex items-center gap-3">
                  <Maximize2 className="h-5 w-5" /> Mapa de Calor por Ramos
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[550px] p-8">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-slate-200" /></div>
                ) : processedData.ramos.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <p className="text-sm font-bold uppercase text-center">Sin datos para los filtros seleccionados.<br/>Realiza una sincronización en "Análisis Detallado" si es necesario.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap 
                      data={processedData.ramos} 
                      dataKey="value" 
                      content={<TreemapNode onClick={handleRamoClick} formatCurrency={formatCurrency} />}
                    >
                      <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                  </ResponsiveContainer>
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
                    <Button variant={activePieTab === '80' ? 'default' : 'ghost'} size="sm" onClick={() => setActivePieTab('80')} className="h-7 text-[8px] font-black uppercase px-3 rounded-lg">Mayor</Button>
                    <Button variant={activePieTab === '20' ? 'default' : 'ghost'} size="sm" onClick={() => setActivePieTab('20')} className="h-7 text-[8px] font-black uppercase px-3 rounded-lg">Menor</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-8 space-y-6 overflow-y-auto">
                {(activePieTab === '80' ? vitalFew : usefulMany).map((item, i) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] font-black text-slate-800 uppercase">{item.name}</span>
                      <span className="text-[11px] font-black text-slate-900">{formatCurrency(item.impact)}</span>
                    </div>
                    <Progress value={item.percentage} className="h-1.5" />
                    <p className="text-[9px] text-slate-400 font-bold uppercase">{item.percentage}% del total • {item.count} registros</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </main>

        <Dialog open={!!selectedRamo} onOpenChange={(open) => !open && setSelectedRamo(null)}>
          <DialogContent className="sm:max-w-[1000px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="bg-slate-900 text-white p-10">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Badge className="bg-primary uppercase text-[9px] font-black px-3 py-1">Desglose de Ramo</Badge>
                  <DialogTitle className="text-3xl font-headline font-bold uppercase text-white">{selectedRamo?.name}</DialogTitle>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-accent uppercase tracking-widest">Impacto del Grupo</p>
                  <p className="text-4xl font-black text-white">{formatCurrency(selectedRamo?.impact || 0)}</p>
                </div>
              </div>
            </DialogHeader>

            <div className="p-8 space-y-8 bg-white max-h-[70vh] overflow-y-auto">
              <section>
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" /> Composición del Grupo (Sub-disciplinas)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ramoDetails.subDisciplines.map((sub, i) => (
                    <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-slate-800 uppercase">{sub.name}</span>
                        <span className="text-[10px] font-black text-primary">{formatCurrency(sub.impact)}</span>
                      </div>
                      <Progress value={parseFloat(sub.percentage)} className="h-1" />
                      <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{sub.percentage}% de este ramo • {sub.count} registros</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" /> Muestra de Órdenes Críticas
                </h4>
                <div className="border rounded-2xl overflow-hidden text-slate-900 border-slate-100 shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[9px] font-black uppercase h-10">PID</TableHead>
                        <TableHead className="text-[9px] font-black uppercase h-10">Sub-Disciplina</TableHead>
                        <TableHead className="text-[9px] font-black uppercase h-10">Descripción</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-right h-10">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingDetails ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-200" /></TableCell>
                        </TableRow>
                      ) : ramoDetails.orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-32 text-center text-[10px] font-bold uppercase text-slate-400">Sin órdenes detalladas para este ramo en los filtros actuales.</TableCell>
                        </TableRow>
                      ) : ramoDetails.orders.map((o) => (
                        <TableRow key={o.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-[10px] font-black text-slate-900">{o.projectId}</TableCell>
                          <TableCell className="text-[9px] font-bold uppercase text-slate-500">{o.disciplina_normalizada}</TableCell>
                          <TableCell className="text-[10px] text-slate-600 italic max-w-[300px] truncate">"{o.descripcion}"</TableCell>
                          <TableCell className="text-right text-[10px] font-black text-slate-900">{formatCurrency(o.impactoNeto)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </div>
  );
}
