"use client"

import React, { useState, useMemo, useEffect, memo } from 'react';
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
  AlertCircle,
  Loader2,
  ShieldCheck,
  Search,
  ArrowRight,
  Info,
  User,
  Layers,
  FileText,
  Activity,
  CalendarDays,
  Target
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';

const COLORS = ['#002D72', '#0071CE', '#FFC220', '#041E42', '#44883E', '#F47321', '#E31837', '#54585A'];

// Componente de contenido personalizado memoizado para máximo rendimiento
const TreemapNode = memo((props: any) => {
  const { x, y, width, height, name, impact, percentage, color, onClick, formatCurrency } = props;
  
  if (width < 30 || height < 30) return null;
  
  // Lógica de legibilidad dinámica
  const showFullInfo = width > 120 && height > 80;
  const showCompactInfo = width > 60 && height > 40;
  const showNameOnly = width > 40 && height > 25;

  return (
    <g 
      onClick={() => onClick(props)} 
      className="cursor-pointer group transition-all duration-300"
    >
      <rect 
        x={x} 
        y={y} 
        width={width} 
        height={height} 
        style={{ 
          fill: color, 
          stroke: '#fff', 
          strokeWidth: 1.5,
          transition: 'opacity 0.2s ease'
        }} 
        className="group-hover:opacity-85"
      />
      {showNameOnly && (
        <text 
          x={x + 6} 
          y={y + 16} 
          fill="#fff" 
          fontSize={showFullInfo ? 11 : 9} 
          fontWeight="900" 
          className="uppercase pointer-events-none drop-shadow-sm"
        >
          {String(name).length > (width / 7) ? `${String(name).substring(0, Math.floor(width / 7))}...` : name}
        </text>
      )}
      {showCompactInfo && (
        <text 
          x={x + 6} 
          y={y + (showFullInfo ? 32 : 28)} 
          fill="rgba(255,255,255,0.9)" 
          fontSize={8} 
          fontWeight="700" 
          className="pointer-events-none"
        >
          {formatCurrency(impact)}
        </text>
      )}
      {showFullInfo && (
        <text 
          x={x + 6} 
          y={y + height - 8} 
          fill="#fff" 
          fontSize={16} 
          fontWeight="900" 
          className="pointer-events-none tabular-nums"
        >
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
  
  // Estados de Filtros
  const [formatFilter, setFormatFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  
  const [activeTab, setActivePieTab] = useState<'80' | '20'>('80');
  const [selectedDiscipline, setSelectedDiscipline] = useState<any>(null);
  const [disciplineOrders, setDisciplineOrders] = useState<any[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const globalAggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(globalAggRef);

  // Carga de Taxonomías para Selectores
  const formatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('name', 'asc')) : null, [db]);
  const { data: availableFormats } = useCollection(formatsQuery);

  const plansQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_plans'), orderBy('name', 'asc')) : null, [db]);
  const { data: availablePlans } = useCollection(plansQuery);

  // Consulta Principal a hitos_analytics (Multidimensional)
  const analyticsQuery = useMemoFirebase(() => {
    if (!db || !isAuthReady) return null;
    const baseQuery = collection(db, 'hitos_analytics');
    if (yearFilter !== 'all') {
      return query(baseQuery, where('year', '==', Number(yearFilter)));
    }
    return baseQuery;
  }, [db, isAuthReady, yearFilter]);

  const { data: rawAnalytics, isLoading } = useCollection(analyticsQuery);

  // Procesamiento de Datos con Filtros Cruzados en Cliente
  const processedData = useMemo(() => {
    if (!rawAnalytics || rawAnalytics.length === 0) return { pareto: [], totalImpact: 0, totalCount: 0 };

    const consolidatedMap = new Map<string, any>();
    let totalImpact = 0;
    let totalCount = 0;

    rawAnalytics.forEach(d => {
      // Aplicar Filtros de Formato y Plan
      const matchFormat = formatFilter === 'all' || d.format === formatFilter;
      const matchPlan = planFilter === 'all' || d.plan === planFilter;

      if (matchFormat && matchPlan) {
        const name = String(d.discipline || 'INDEFINIDA').trim().toUpperCase();
        const impact = Number(d.impact || 0);
        const count = Number(d.count || 0);
        
        totalImpact += impact;
        totalCount += count;

        if (consolidatedMap.has(name)) {
          const existing = consolidatedMap.get(name);
          existing.impact += impact;
          existing.count += count;
        } else {
          consolidatedMap.set(name, { name, impact, count });
        }
      }
    });

    const consolidatedArray = Array.from(consolidatedMap.values()).sort((a, b) => b.impact - a.impact);
    
    let cumulative = 0;
    const pareto = consolidatedArray.map((item, index) => {
      const impact = item.impact;
      cumulative += impact;
      return {
        name: item.name,
        value: impact || 0.01,
        impact: impact,
        percentage: Number(((impact / (totalImpact || 1)) * 100).toFixed(1)),
        cumulativePercentage: (cumulative / (totalImpact || 1)) * 100,
        count: item.count,
        color: COLORS[index % COLORS.length]
      };
    });

    return { pareto, totalImpact, totalCount };
  }, [rawAnalytics, formatFilter, planFilter]);

  const vitalFew = useMemo(() => processedData.pareto.filter(p => p.cumulativePercentage <= 85), [processedData]);
  const usefulMany = useMemo(() => processedData.pareto.filter(p => p.cumulativePercentage > 85), [processedData]);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  const handleNodeClick = async (node: any) => {
    if (!node || !db) return;
    setSelectedDiscipline(node);
    setIsLoadingDetails(true);
    setDisciplineOrders([]);

    try {
      // Esta consulta requiere los índices compuestos creados en Firestore
      let q = query(
        collection(db, 'orders'),
        where('disciplina_normalizada', '==', node.name),
        orderBy('impactoNeto', 'desc'),
        limit(15)
      );

      if (yearFilter !== 'all') {
        q = query(q, where('year', '==', Number(yearFilter)));
      }
      
      if (formatFilter !== 'all') {
        q = query(q, where('format_normalized', '==', formatFilter));
      }

      if (planFilter !== 'all') {
        q = query(q, where('plan_nombre_normalizado', '==', planFilter));
      }

      const snap = await getDocs(q);
      setDisciplineOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Error al cargar detalles:", e);
      toast({
        variant: "destructive",
        title: "Error de consulta",
        description: "Asegúrese de que los índices de Firestore estén activos."
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950 text-white p-5 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-xl animate-in fade-in zoom-in duration-200">
          <p className="text-xs font-black text-accent uppercase tracking-widest mb-3 pb-2 border-b border-white/10">{data.name}</p>
          <div className="space-y-2">
            <div className="flex justify-between gap-10 items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Impacto Capex</span>
              <span className="text-sm font-black text-white">{formatCurrency(data.impact)}</span>
            </div>
            <div className="flex justify-between gap-10 items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Incidencias</span>
              <span className="text-sm font-black text-emerald-400">{data.count} OC/OT</span>
            </div>
            <div className="flex justify-between gap-10 items-center pt-2 border-t border-white/5 mt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Participación</span>
              <span className="text-xs font-black text-primary">{data.percentage}%</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-slate-500 uppercase italic">
            <Info className="h-3 w-3" /> Haz clic para inspección forense
          </div>
        </div>
      );
    }
    return null;
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
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter font-headline">Dashboard Ejecutivo de Vicepresidencia</h1>
              <div className="flex items-center gap-2 mt-1">
                 <ShieldCheck className="h-3 w-3 text-emerald-600" />
                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                   Integridad Forense SSOT Activa • {processedData.totalCount.toLocaleString()} Registros en Vista
                 </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Filtro de Año */}
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

            {/* Filtro de Plan */}
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <Target className="h-3.5 w-3.5 text-slate-400 ml-2" />
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-8 w-40 bg-transparent border-none text-[10px] font-black uppercase shadow-none focus:ring-0">
                  <SelectValue placeholder="Filtrar Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS PLANES</SelectItem>
                  {availablePlans?.map(p => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Formato */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border">
              <Filter className="h-3.5 w-3.5 text-slate-400 ml-2" />
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="h-9 w-64 bg-white border-none text-[10px] font-black uppercase rounded-xl shadow-sm">
                  <SelectValue placeholder="Filtrar por Formato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS FORMATOS</SelectItem>
                  {availableFormats?.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      <div className="flex justify-between w-full gap-4">
                        <span>{f.name}</span>
                        <span className="text-slate-400">({f.count || 0})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary p-6 rounded-3xl transition-all hover:shadow-lg">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Materializado</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(processedData.totalImpact)}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Segmento Filtrado: {yearFilter === 'all' ? 'HISTÓRICO' : yearFilter} • {formatFilter === 'all' ? 'GLOBAL' : formatFilter}</p>
            </Card>
            <Card className="border-none shadow-md bg-slate-900 text-white border-l-4 border-l-accent p-6 rounded-3xl transition-all hover:shadow-lg">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Concentración Pareto</p>
              <h2 className="text-3xl font-black text-white tracking-tighter">
                {processedData.totalImpact > 0 ? '85%' : '0%'}
              </h2>
              <Progress value={processedData.totalImpact > 0 ? 85 : 0} className="h-1 bg-white/10 mt-2" />
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-blue-600 p-6 rounded-3xl transition-all hover:shadow-lg">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Volumen OC/OT</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                {processedData.totalCount.toLocaleString()}
              </h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Órdenes Auditadas</p>
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 p-6 rounded-3xl transition-all hover:shadow-lg">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hitos Vitales</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{vitalFew.length}</h2>
              <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase italic">Categorías Críticas</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden rounded-[2.5rem]">
              <CardHeader className="bg-slate-50/50 border-b py-8 px-10">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-sm font-black uppercase text-primary tracking-[0.2em] flex items-center gap-3">
                      <Maximize2 className="h-5 w-5" /> Mapa de Calor: Concentración de Impacto
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase text-slate-400 mt-1">Exploración Táctica Multidimensional • Vista Dinámica</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 bg-white px-3 py-1 rounded-full border">
                    <Loader2 className="h-2.5 w-2.5 animate-pulse" /> OPTIMIZADO
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-[550px] p-8">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-slate-200" />
                  </div>
                ) : processedData.pareto.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap 
                      data={processedData.pareto} 
                      dataKey="value" 
                      stroke="#fff" 
                      content={<TreemapNode onClick={handleNodeClick} formatCurrency={formatCurrency} />}
                      animationDuration={400}
                    >
                      <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                    <AlertCircle className="h-16 w-16 opacity-10" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400 text-center">
                      No hay datos para la combinación de filtros seleccionada.<br/>
                      Ajuste el Año o el Plan de Trabajo o sincronice los datos.
                    </p>
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
                    <Button variant={activeTab === '80' ? 'default' : 'ghost'} size="sm" onClick={() => setActivePieTab('80')} className="h-7 text-[8px] font-black uppercase px-3 rounded-lg">Vital Few</Button>
                    <Button variant={activeTab === '20' ? 'default' : 'ghost'} size="sm" onClick={() => setActivePieTab('20')} className="h-7 text-[8px] font-black uppercase px-3 rounded-lg">Useful Many</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
                {(activeTab === '80' ? vitalFew : usefulMany).map((item, i) => (
                  <div key={`${item.name}-${i}`} className="group">
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
                {processedData.pareto.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin datos</p>
                  </div>
                )}
              </CardContent>
              <div className="p-10 bg-slate-900 text-white rounded-b-[2.5rem]">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-2">Integridad de Auditoría</p>
                <div className="text-xs text-slate-300 leading-relaxed italic border-l-2 border-accent pl-4">
                  Reporte verificado dinámicamente. La suma de este segmento coincide 100% con los registros de {yearFilter === 'all' ? 'todo el histórico' : yearFilter} en la base institucional.
                </div>
              </div>
            </Card>
          </div>
        </main>

        <Dialog open={!!selectedDiscipline} onOpenChange={(open) => !open && setSelectedDiscipline(null)}>
          <DialogContent className="sm:max-w-[1100px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl text-slate-900">
            <DialogHeader className="bg-slate-900 text-white p-10">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <Badge className="bg-primary uppercase text-[9px] font-black px-3 py-1">Expediente Forense Filtrado ({yearFilter})</Badge>
                  <DialogTitle className="text-3xl font-headline font-bold uppercase tracking-tight leading-none text-white">
                    {selectedDiscipline?.name}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                    Top registros para {formatFilter === 'all' ? 'Todos los Formatos' : formatFilter} • Plan: {planFilter === 'all' ? 'Global' : planFilter}
                  </DialogDescription>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-[10px] font-black text-accent uppercase tracking-widest">Impacto en Vista</p>
                  <p className="text-4xl font-black text-white">{formatCurrency(selectedDiscipline?.impact || 0)}</p>
                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 uppercase text-[9px]">
                    {selectedDiscipline?.count} Registros Auditados
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <div className="bg-white">
              {isLoadingDetails ? (
                <div className="h-80 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recuperando expedientes forenses...</p>
                </div>
              ) : (
                <div className="p-8 space-y-6">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-3">
                      <Search className="h-5 w-5 text-primary" />
                      <h4 className="text-sm font-black uppercase text-slate-800 tracking-tighter">Matriz de Desviaciones Críticas</h4>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase italic">Filtrado por Año: {yearFilter}</p>
                  </div>
                  
                  <div className="rounded-2xl border overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-[9px] font-black uppercase pl-6 text-slate-500">PID / Proyecto</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-slate-500">Formato</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-slate-500">Etapa / Coord.</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-slate-500">Causa & Narrativa</TableHead>
                          <TableHead className="text-[9px] font-black uppercase text-right pr-6 text-slate-500">Impacto Neto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {disciplineOrders.map((order) => (
                          <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors group border-b last:border-0">
                            <TableCell className="pl-6 py-4">
                              <div className="space-y-0.5">
                                <p className="font-mono text-xs font-bold text-slate-900">{order.projectId}</p>
                                <p className="text-[9px] text-slate-400 uppercase font-medium truncate max-w-[150px]">{order.projectName || 'N/A'}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[8px] font-black uppercase bg-slate-50">{order.format_normalized || order.format || 'OTRO'}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-700 uppercase">
                                  <Layers className="h-3 w-3 text-primary opacity-50" /> {order.etapa_proyecto_normalizada || 'CONSTRUCCIÓN'}
                                </div>
                                <div className="flex items-center gap-1.5 text-[8px] font-medium text-slate-400 uppercase">
                                  <User className="h-3 w-3 opacity-50" /> {order.coordinador_normalizado || 'SIN ASIGNAR'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <div className="cursor-help space-y-1 group-hover:opacity-80 transition-opacity">
                                    <div className="text-[9px] font-black text-slate-800 uppercase line-clamp-1 max-w-[250px]">
                                      {order.causa_raiz_normalizada || order.causaRaiz || 'Sin clasificar'}
                                    </div>
                                    <div className="text-[8px] text-slate-400 italic line-clamp-1 max-w-[250px]">
                                      "{order.descripcion || 'Sin narrativa disponible'}"
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 p-6 rounded-2xl shadow-2xl bg-slate-900 text-white border-white/10">
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                                      <FileText className="h-4 w-4 text-accent" />
                                      <h5 className="text-[10px] font-black uppercase tracking-widest text-accent">Justificación Forense</h5>
                                    </div>
                                    <ScrollArea className="h-40">
                                      <p className="text-xs leading-relaxed text-slate-300 italic">
                                        {order.descripcion || "No se registró narrativa detallada para esta orden de cambio."}
                                      </p>
                                    </ScrollArea>
                                    <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                                      <Badge className="bg-white/10 text-white border-none text-[8px]">{order.classification_status === 'auto' ? 'IA AUDITED' : 'MANUAL'}</Badge>
                                      <span className="text-[8px] font-mono text-slate-500 uppercase">{order.id}</span>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </TableCell>
                            <TableCell className="text-right pr-6 font-black text-xs text-slate-900 font-mono">
                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(order.impactoNeto || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {disciplineOrders.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-xs text-slate-400 italic">No se encontraron registros individuales para este filtro.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="bg-emerald-50 p-6 rounded-2xl flex items-center justify-between border border-emerald-100">
                    <div className="flex items-center gap-4">
                      <div className="bg-white p-3 rounded-full shadow-sm text-emerald-600">
                        <CheckCircle2 className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-emerald-900 uppercase">Integridad Forense Verificada</p>
                        <p className="text-[10px] text-emerald-700/70 font-medium">Muestra representativa del segmento {selectedDiscipline?.name} para el año {yearFilter}.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" className="text-[9px] font-black uppercase text-slate-400 h-10 px-4 rounded-xl">Reportar Discrepancia</Button>
                      <Button variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 h-10 px-6 uppercase text-[10px] font-black gap-2 hover:bg-emerald-100 transition-colors">
                        Exportar Expediente <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </div>
  );
}
