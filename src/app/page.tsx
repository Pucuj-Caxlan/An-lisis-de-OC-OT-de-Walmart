
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  BrainCircuit, 
  Database, 
  RefreshCcw, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Users,
  Target,
  ListOrdered,
  Layers,
  Search,
  X,
  ArrowRight
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ScrollArea } from '@/components/ui/scroll-area';

const YEARS = [2022, 2023, 2024, 2025, 2026];
const COLORS = ['#2962FF', '#FF8F00', '#00C853', '#D50000', '#6200EA', '#00B8D4', '#FFD600', '#AA00FF', '#37474F', '#9E9E9E'];

export default function VpDashboard() {
  const db = useFirestore();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear);
  const [comparisonYear, setComparisonYear] = useState<number>(2024);
  const [mounted, setMounted] = useState(false);
  const [drilldownConcept, setDrilldownConcept] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    type: 'all',
    format: 'all',
    planType: 'all',
    coordinator: 'all',
    projectName: ''
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'));
  }, [db]);

  const { data: rawOrders, isLoading } = useCollection(ordersQuery);

  const getOrderYear = (o: any): number | null => {
    const dateStr = o.fechaSolicitud || o.requestDate || o.header?.requestDate || o.projectInfo?.requestDate || o.processedAt;
    if (!dateStr) return null;
    try {
      let cleanedDateStr = String(dateStr).toLowerCase();
      const monthsEs: Record<string, string> = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
        'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
      };
      Object.entries(monthsEs).forEach(([name, num]) => {
        cleanedDateStr = cleanedDateStr.replace(name, num);
      });
      cleanedDateStr = cleanedDateStr.replace(/\s/g, '');

      const date = new Date(cleanedDateStr);
      if (!isNaN(date.getFullYear())) return date.getFullYear();
      
      const yearMatch = String(dateStr).match(/\b(202[2-6])\b/);
      if (yearMatch) return parseInt(yearMatch[1]);
      return null;
    } catch { return null; }
  };

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN', 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(val);
  };

  const filterOptions = useMemo(() => {
    if (!rawOrders) return { coordinators: [], formats: [], plans: [] };
    
    const coordinators = new Set<string>();
    const formats = new Set<string>();
    const plans = new Set<string>();
    
    rawOrders.forEach(o => {
      if (o.coordinador) coordinators.add(o.coordinador);
      const fmt = o.format || o.projectInfo?.format;
      if (fmt) formats.add(fmt);
      if (o.plan) plans.add(o.plan);
    });
    
    return {
      coordinators: Array.from(coordinators).sort(),
      formats: Array.from(formats).sort(),
      plans: Array.from(plans).sort()
    };
  }, [rawOrders]);

  const filteredData = useMemo(() => {
    if (!rawOrders) return [];
    return rawOrders.filter(o => {
      const orderYear = getOrderYear(o);
      const yearMatch = selectedYear === 'all' || orderYear === selectedYear;
      
      const oType = String(o.type || o.header?.type || "").toLowerCase();
      let typeMatch = filters.type === 'all';
      if (!typeMatch) {
        if (filters.type === 'OT') typeMatch = oType.includes('ot') || oType.includes('trabajo');
        if (filters.type === 'OCR') typeMatch = oType.includes('ocr') || oType.includes('cambio');
        if (filters.type === 'OCI') typeMatch = oType.includes('oci') || oType.includes('informativa');
      }
      
      const oFormat = String(o.format || o.projectInfo?.format || "").toLowerCase();
      const formatMatch = filters.format === 'all' || oFormat.includes(filters.format.toLowerCase());
      
      const oPlan = String(o.plan || "").toLowerCase();
      const planMatch = filters.planType === 'all' || oPlan.includes(filters.planType.toLowerCase());
      
      const oCoordinator = String(o.coordinador || "").toLowerCase();
      const coordinatorMatch = filters.coordinator === 'all' || oCoordinator.includes(filters.coordinator.toLowerCase());
      
      const searchStr = filters.projectName.toLowerCase();
      const oPid = String(o.projectId || o.projectInfo?.projectId || "").toLowerCase();
      const oPName = String(o.projectName || o.projectInfo?.projectName || "").toLowerCase();
      const searchMatch = !searchStr || oPid.includes(searchStr) || oPName.includes(searchStr);
      
      return yearMatch && typeMatch && formatMatch && planMatch && coordinatorMatch && searchMatch;
    });
  }, [rawOrders, selectedYear, filters]);

  const drilldownOrders = useMemo(() => {
    if (!drilldownConcept) return [];
    return filteredData.filter(o => {
      const concept = o.semanticAnalysis?.conceptoNormalizado || o.descripcion?.split('/')[0] || 'Otros';
      return concept === drilldownConcept;
    });
  }, [filteredData, drilldownConcept]);

  const comparisonData = useMemo(() => {
    if (!rawOrders || selectedYear === 'all') return null;
    return rawOrders.filter(o => getOrderYear(o) === comparisonYear);
  }, [rawOrders, comparisonYear]);

  const metrics = useMemo(() => {
    const impactValues = filteredData.map(o => o.impactoNeto || o.financialImpact?.netImpact || 0);
    const totalImpact = impactValues.reduce((acc, curr) => acc + curr, 0);
    const count = filteredData.length;
    const projectIds = new Set(filteredData.map(o => o.projectId || o.projectInfo?.projectId).filter(id => !!id));
    const projectCount = projectIds.size;
    const ocPerProjectRatio = projectCount > 0 ? (count / projectCount).toFixed(2) : "0.00";

    const concepts = filteredData.reduce((acc: any, curr) => {
      const concept = curr.semanticAnalysis?.conceptoNormalizado || curr.descripcion?.split('/')[0] || 'Otros';
      const impact = curr.impactoNeto || curr.financialImpact?.netImpact || 0;
      if (!acc[concept]) acc[concept] = { name: concept, count: 0, impact: 0 };
      acc[concept].count += 1;
      acc[concept].impact += impact;
      return acc;
    }, {});
    const topConcepts = Object.values(concepts).sort((a: any, b: any) => b.count - a.count).slice(0, 10);

    const causes = filteredData.reduce((acc: any, curr) => {
      const cause = curr.semanticAnalysis?.causaRaizReal || curr.causaRaiz || 'No definida';
      const impact = curr.impactoNeto || curr.financialImpact?.netImpact || 0;
      if (!acc[cause]) acc[cause] = { name: cause, count: 0, impact: 0 };
      acc[cause].count += 1;
      acc[cause].impact += impact;
      return acc;
    }, {});
    const topCauses = Object.values(causes).sort((a: any, b: any) => b.impact - a.impact).slice(0, 10);

    const plans = filteredData.reduce((acc: any, curr) => {
      const plan = curr.plan || 'Otros';
      acc[plan] = (acc[plan] || 0) + (curr.impactoNeto || curr.financialImpact?.netImpact || 0);
      return acc;
    }, {});
    const planChartData = Object.entries(plans).map(([name, value]) => ({ name, value: value as number }));

    return { 
      totalImpact, 
      count, 
      projectCount, 
      ocPerProjectRatio, 
      topConcepts, 
      topCauses,
      planChartData
    };
  }, [filteredData]);

  const comparatives = useMemo(() => {
    if (!comparisonData || selectedYear === 'all') return null;
    const compTotal = comparisonData.reduce((acc, curr) => acc + (curr.impactoNeto || curr.financialImpact?.netImpact || 0), 0);
    const delta = metrics.totalImpact - compTotal;
    const pct = compTotal > 0 ? ((metrics.totalImpact - compTotal) / compTotal) * 100 : 0;
    return { compTotal, delta, pct };
  }, [metrics.totalImpact, comparisonData, selectedYear]);

  const clearFilters = () => {
    setFilters({
      type: 'all',
      format: 'all',
      planType: 'all',
      coordinator: 'all',
      projectName: ''
    });
  };

  const hasActiveFilters = filters.type !== 'all' || filters.format !== 'all' || filters.planType !== 'all' || filters.coordinator !== 'all' || filters.projectName !== '';

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full bg-slate-50/50">
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-full w-full items-center justify-center">
            <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
          </div>
        </SidebarInset>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">VP Construction Analytics</h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="flex bg-slate-100 p-1 rounded-xl border gap-1">
              <button
                onClick={() => setSelectedYear('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedYear === 'all' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}
              >
                TODO
              </button>
              {YEARS.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${selectedYear === y ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary overflow-hidden">
              <CardContent className="pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Neto {selectedYear === 'all' ? 'Total' : selectedYear}</p>
                <h2 className="text-2xl font-headline font-bold text-slate-800">{formatCurrency(metrics.totalImpact)}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20">{metrics.count} Órdenes</Badge>
                  {comparatives && selectedYear !== 'all' && (
                    <span className={`text-[10px] font-bold flex items-center ${comparatives.pct > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {comparatives.pct > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(comparatives.pct).toFixed(1)}% vs {comparisonYear}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500">
              <CardContent className="pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ratio OC / Proyecto</p>
                <h2 className="text-2xl font-headline font-bold text-slate-800">{metrics.ocPerProjectRatio}</h2>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">Eficiencia en {metrics.projectCount} proyectos activos</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-slate-800 text-white md:col-span-2">
              <CardContent className="pt-6 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Comparativa Interanual</p>
                  <div className="flex items-center gap-4">
                    <Select value={String(comparisonYear)} onValueChange={(v) => setComparisonYear(Number(v))}>
                      <SelectTrigger className="w-[120px] h-9 bg-slate-700 border-none text-white font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 font-bold uppercase">Variación Nominal</span>
                      <span className={`text-lg font-bold ${comparatives && comparatives.delta > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {comparatives ? formatCurrency(Math.abs(comparatives.delta)) : '--'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right bg-white/10 p-4 rounded-2xl">
                   <p className="text-[10px] font-black text-slate-400 uppercase">Crecimiento (%)</p>
                   <p className={`text-2xl font-headline font-bold ${comparatives && comparatives.pct > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                     {comparatives ? `${comparatives.pct > 0 ? '+' : ''}${comparatives.pct.toFixed(1)}%` : '--'}
                   </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filtros Ejecutivos
              </h3>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-[10px] uppercase font-bold text-rose-500 gap-1 hover:bg-rose-50">
                  <X className="h-3 w-3" /> Limpiar Filtros
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Layers className="h-3 w-3" /> Tipo Plan</label>
                <Select value={filters.planType} onValueChange={(v) => setFilters(f => ({...f, planType: v}))}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-xs font-medium"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Planes</SelectItem>
                    {filterOptions.plans.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Users className="h-3 w-3" /> Coordinador</label>
                <Select value={filters.coordinator} onValueChange={(v) => setFilters(f => ({...f, coordinator: v}))}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-xs font-medium"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Coordinadores</SelectItem>
                    {filterOptions.coordinators.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Target className="h-3 w-3" /> Formato</label>
                <Select value={filters.format} onValueChange={(v) => setFilters(f => ({...f, format: v}))}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-xs font-medium"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Formatos</SelectItem>
                    {filterOptions.formats.map(fmt => (
                      <SelectItem key={fmt} value={fmt}>{fmt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Search className="h-3 w-3" /> Buscar Proyecto / PID</label>
                <div className="relative">
                  <Input 
                    placeholder="Ej. Hacienda de Torreón o 126393..." 
                    className="h-9 bg-slate-50 border-none text-xs font-medium pl-8"
                    value={filters.projectName}
                    onChange={(e) => setFilters(f => ({...f, projectName: e.target.value}))}
                  />
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>
            </div>
          </Card>

          <Tabs defaultValue="recurrence" className="w-full">
            <TabsList className="bg-slate-100 p-1 mb-6 rounded-xl border">
              <TabsTrigger value="recurrence" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ListOrdered className="h-4 w-4" /> Recurrencia por Concepto
              </TabsTrigger>
              <TabsTrigger value="rootcause" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <BrainCircuit className="h-4 w-4" /> Causas Raíz Reales
              </TabsTrigger>
              <TabsTrigger value="distribution" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Layers className="h-4 w-4" /> Distribución Plan
              </TabsTrigger>
            </TabsList>

            <TabsContent value="recurrence">
              <Card className="border-none shadow-md overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/50 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Top 10 Recurrencia de Conceptos (Filtro Semántico)</CardTitle>
                      <CardDescription>Identificación de desviaciones repetitivas. Haz clic en una fila para ver el detalle de los registros.</CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-white">{filteredData.length} Órdenes mostradas</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                        <tr>
                          <th className="p-4 text-left">CONCEPTO NORMALIZADO (IA)</th>
                          <th className="p-4 text-center">FRECUENCIA (Nº)</th>
                          <th className="p-4 text-right">IMPORTE TOTAL</th>
                          <th className="p-4 text-center">PESO FINANCIERO</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {metrics.topConcepts.length === 0 ? (
                          <tr><td colSpan={4} className="p-10 text-center text-slate-400">Sin datos para este periodo o filtros seleccionados.</td></tr>
                        ) : metrics.topConcepts.map((row: any, i) => (
                          <tr 
                            key={i} 
                            className="hover:bg-primary/5 transition-colors group cursor-pointer"
                            onClick={() => setDrilldownConcept(row.name)}
                          >
                            <td className="p-4 font-bold text-slate-700 group-hover:text-primary transition-colors flex items-center justify-between">
                              {row.name}
                              <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                            </td>
                            <td className="p-4 text-center">
                              <Badge className="bg-slate-100 text-slate-600 font-bold border-none">{row.count}</Badge>
                            </td>
                            <td className="p-4 text-right font-black text-slate-900">{formatCurrency(row.impact)}</td>
                            <td className="p-4 w-48">
                              <div className="flex items-center gap-3">
                                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary" 
                                    style={{ width: `${metrics.totalImpact > 0 ? (row.impact / metrics.totalImpact) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-slate-400">
                                  {metrics.totalImpact > 0 ? ((row.impact / metrics.totalImpact) * 100).toFixed(1) : 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rootcause">
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Top 10 Causa Raíz por Impacto</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px] pt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.topCauses} layout="vertical" margin={{ left: 20, right: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} />
                        <Tooltip cursor={{fill: 'rgba(41, 98, 255, 0.05)'}} formatter={(v) => formatCurrency(v as number)} />
                        <Bar dataKey="impact" fill="#2962FF" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-md bg-white">
                  <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Inferencia de Causa Raíz vs Frecuencia</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[400px] pt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={metrics.topCauses}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(v) => `$${v/1000}k`} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#64748b' }} />
                        <Tooltip />
                        <Bar yAxisId="left" dataKey="impact" fill="#2962FF" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="count" stroke="#FF8F00" strokeWidth={3} dot={{ fill: '#FF8F00', r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="distribution">
              <Card className="border-none shadow-md bg-white">
                <CardHeader className="border-b bg-slate-50/50">
                  <CardTitle className="text-sm font-black uppercase text-primary tracking-widest">Distribución por Tipo de Plan</CardTitle>
                </CardHeader>
                <CardContent className="h-[450px] p-6">
                  <div className="grid md:grid-cols-3 h-full">
                    <div className="md:col-span-1 flex flex-col justify-center gap-4">
                      {metrics.planChartData.map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-xs font-bold text-slate-600">{item.name}</span>
                          </div>
                          <span className="text-xs font-black text-slate-800">{formatCurrency(item.value)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="md:col-span-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={metrics.planChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={140}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {metrics.planChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => formatCurrency(v as number)} />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        <Dialog open={!!drilldownConcept} onOpenChange={(open) => !open && setDrilldownConcept(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white shadow-2xl border-none">
            <DialogHeader className="p-6 bg-slate-50 border-b shrink-0">
              <div className="flex items-center gap-4 mb-1">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  <BrainCircuit className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-headline font-bold text-slate-800 tracking-tight">
                    Detalle de Recurrencia: {drilldownConcept}
                  </DialogTitle>
                  <DialogDescription className="text-sm text-slate-500 font-medium">
                    Auditoría de las {drilldownOrders.length} frecuencias detectadas para este concepto.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="flex-1 min-h-0 relative">
              <ScrollArea className="h-full w-full">
                <div className="p-6">
                  <Table>
                    <TableHeader className="bg-slate-50/50 sticky top-0 z-20">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[180px] font-black uppercase text-[10px] tracking-widest">PID / Proyecto</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest">Coordinador</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest">Causa Raíz Real</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest">Descripción / Riesgo</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Impacto Neto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drilldownOrders.map((order) => (
                        <TableRow key={order.id} className="hover:bg-primary/5 transition-colors group">
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="text-primary font-bold">{order.projectId || "S/P"}</span>
                              <span className="text-[10px] text-muted-foreground uppercase truncate max-w-[150px]">
                                {order.projectName || "Sin Nombre"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-slate-600">
                            {order.coordinador || "No asignado"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] uppercase font-bold">
                              {order.semanticAnalysis?.causaRaizReal || order.causaRaiz || "N/D"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[250px] space-y-1">
                              <p className="text-[11px] leading-relaxed text-slate-600 line-clamp-3 italic">
                                {order.standardizedDescription || order.descripcion}
                              </p>
                              {order.semanticAnalysis?.especialidadImpactada && (
                                <Badge variant="outline" className="text-[8px] h-4 py-0 uppercase border-slate-200">
                                  {order.semanticAnalysis.especialidadImpactada}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-black text-slate-900 tabular-nums">
                            {formatCurrency(order.impactoNeto || order.financialImpact?.netImpact || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </div>

            <div className="p-6 bg-slate-50 border-t shrink-0 flex items-center justify-between shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auditoría Semántica Consolidada VP</p>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Impacto Total Concepto</p>
                  <p className="text-xl font-black text-primary tabular-nums">
                    {formatCurrency(drilldownOrders.reduce((acc, curr) => acc + (curr.impactoNeto || curr.financialImpact?.netImpact || 0), 0))}
                  </p>
                </div>
                <Button size="lg" className="h-11 px-8 shadow-md" onClick={() => setDrilldownConcept(null)}>Cerrar Detalle</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </div>
  );
}
