
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Download,
  BarChart3,
  Search,
  ArrowUpRight,
  TrendingUp,
  LayoutGrid,
  BrainCircuit,
  Database
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
  Legend
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

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const HISTORICAL_YEARS = [2022, 2023, 2024, 2025];
const COLORS = ['#2962FF', '#FF8F00', '#00C853', '#D50000', '#6200EA', '#00B8D4', '#FFD600', '#AA00FF', '#37474F', '#9E9E9E'];
const FORMATS = ['Bodega Aurrera', 'Walmart Supercenter', 'Sams Club', 'Bodega Aurrera Express'];

export default function VpDashboard() {
  const db = useFirestore();
  const [selectedYear, setSelectedYear] = useState(2024);
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all',
    format: 'all',
    country: 'all',
    cause: 'all',
    generator: 'all',
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

  // Helper para extraer fecha de cualquier fuente (Excel o PDF)
  const getOrderDate = (o: any) => {
    return o.fechaSolicitud || o.requestDate || o.header?.requestDate || o.projectInfo?.requestDate;
  };

  // Conteo de registros por año para el selector
  const countsByYear = useMemo(() => {
    const counts: Record<number, number> = {};
    YEARS.forEach(y => counts[y] = 0);
    if (!rawOrders) return counts;
    rawOrders.forEach(o => {
      const dateStr = getOrderDate(o);
      if (dateStr) {
        const year = new Date(dateStr).getFullYear();
        if (counts[year] !== undefined) {
          counts[year]++;
        }
      }
    });
    return counts;
  }, [rawOrders]);

  const statsProcesamiento = useMemo(() => {
    if (!rawOrders || rawOrders.length === 0) return { total: 0, procesados: 0, pct: 0 };
    const total = rawOrders.length;
    const procesados = rawOrders.filter(o => o.semanticAnalysis).length;
    return {
      total,
      procesados,
      pct: Math.round((procesados / total) * 100)
    };
  }, [rawOrders]);

  const filteredData = useMemo(() => {
    if (!rawOrders) return [];
    return rawOrders.filter(o => {
      const dateStr = getOrderDate(o);
      const orderYear = dateStr ? new Date(dateStr).getFullYear() : null;
      
      // Si no hay fecha, no se muestra en el filtrado por año
      const yearMatch = orderYear === selectedYear;
      
      const typeMatch = filters.type === 'all' || o.type === filters.type || (o.header?.type && o.header.type.includes(filters.type));
      const formatMatch = filters.format === 'all' || o.format === filters.format || o.projectInfo?.format === filters.format;
      const countryMatch = filters.country === 'all' || o.country === filters.country;
      const projectMatch = !filters.projectName || 
        o.projectName?.toLowerCase().includes(filters.projectName.toLowerCase()) ||
        o.projectId?.toLowerCase().includes(filters.projectName.toLowerCase()) ||
        o.projectInfo?.projectId?.toLowerCase().includes(filters.projectName.toLowerCase()) ||
        o.projectInfo?.projectName?.toLowerCase().includes(filters.projectName.toLowerCase());
      
      return yearMatch && typeMatch && formatMatch && countryMatch && projectMatch;
    });
  }, [rawOrders, selectedYear, filters]);

  const metrics = useMemo(() => {
    const totalImpact = filteredData.reduce((acc, curr) => acc + (curr.impactoNeto || curr.financialImpact?.netImpact || 0), 0);
    const count = filteredData.length;
    
    const byGenerator = filteredData.reduce((acc: any, curr) => {
      const gen = curr.generadorDesviacion || curr.projectInfo?.requestingArea || 'Sin asignar';
      acc[gen] = (acc[gen] || 0) + (curr.impactoNeto || curr.financialImpact?.netImpact || 0);
      return acc;
    }, {});
    const generatorData = Object.entries(byGenerator).map(([name, value]) => ({ name, value }));

    const byFormat = filteredData.reduce((acc: any, curr) => {
      const fmt = curr.format || curr.projectInfo?.format || 'Otros';
      acc[fmt] = (acc[fmt] || 0) + (curr.impactoNeto || curr.financialImpact?.netImpact || 0);
      return acc;
    }, {});
    const formatData = Object.entries(byFormat).map(([name, value]) => ({ name, value }));

    const byCause = filteredData.reduce((acc: any, curr) => {
      const cause = curr.semanticAnalysis?.causaRaizReal || curr.causaRaiz || curr.projectInfo?.rootCauseDeclared || 'No Identificada';
      if (!acc[cause]) acc[cause] = { name: cause, count: 0, impact: 0, processed: 0 };
      acc[cause].count += 1;
      acc[cause].impact += (curr.impactoNeto || curr.financialImpact?.netImpact || 0);
      if (curr.semanticAnalysis) acc[cause].processed += 1;
      return acc;
    }, {});
    const causeTable = Object.values(byCause).sort((a: any, b: any) => b.impact - a.impact);

    return { totalImpact, count, generatorData, formatData, causeTable };
  }, [filteredData]);

  const historicalMetrics = useMemo(() => {
    if (!rawOrders) return { rows: [], totals: [] };
    
    const stats: Record<string, Record<number, { projects: Set<string>, orders: number }>> = {};
    
    FORMATS.forEach(f => {
      stats[f] = {};
      HISTORICAL_YEARS.forEach(y => {
        stats[f][y] = { projects: new Set(), orders: 0 };
      });
    });

    rawOrders.forEach(o => {
      const dateStr = getOrderDate(o);
      const fmt = o.format || o.projectInfo?.format;
      if (!dateStr || !fmt) return;
      
      const year = new Date(dateStr).getFullYear();
      if (stats[fmt] && stats[fmt][year]) {
        stats[fmt][year].projects.add(o.projectId || o.projectInfo?.projectId);
        stats[fmt][year].orders += 1;
      }
    });

    const rows = FORMATS.map(f => ({
      format: f,
      yearStats: HISTORICAL_YEARS.map(y => ({
        yr: y,
        projectCount: stats[f][y].projects.size,
        orderCount: stats[f][y].orders,
        ratio: stats[f][y].projects.size > 0 
          ? (stats[f][y].orders / stats[f][y].projects.size).toFixed(1) 
          : '0.0'
      }))
    }));

    const totals = HISTORICAL_YEARS.map(y => {
      let totalProjectsInYear = new Set();
      let totalOrdersInYear = 0;
      FORMATS.forEach(f => {
        stats[f][y].projects.forEach(pid => totalProjectsInYear.add(pid));
        totalOrdersInYear += stats[f][y].orders;
      });
      return {
        yr: y,
        projectCount: totalProjectsInYear.size,
        orderCount: totalOrdersInYear,
        ratio: totalProjectsInYear.size > 0 
          ? (totalOrdersInYear / totalProjectsInYear.size).toFixed(1) 
          : '0.0'
      };
    });

    return { rows, totals };
  }, [rawOrders]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0.00";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN', 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(val);
  };

  const formatNumber = (val: number) => {
    if (!mounted) return "0";
    return val.toLocaleString('es-MX');
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight">VP Construction Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salud de Datos IA</span>
                <span className="text-xs font-bold text-primary">{statsProcesamiento.pct}% Analizado</span>
              </div>
              <div className="h-8 w-16 bg-slate-100 rounded-full overflow-hidden border">
                <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${statsProcesamiento.pct}%` }} />
              </div>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex bg-slate-100 p-1 rounded-lg border gap-1">
              {YEARS.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`flex flex-col items-center justify-center min-w-[60px] px-2 py-1 rounded-md transition-all ${selectedYear === y ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <span className="text-xs font-bold">{y}</span>
                  <span className="text-[9px] font-medium opacity-80">
                    {countsByYear[y]} reg
                  </span>
                </button>
              ))}
            </div>
            <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-sm">
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Database className="h-4 w-4" /> Segmentación del Impacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Orden</label>
                    <Select value={filters.type} onValueChange={(v) => setFilters(f => ({...f, type: v}))}>
                      <SelectTrigger className="h-8 text-xs bg-slate-50 border-none font-medium"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="OT">OT (Trabajo)</SelectItem>
                        <SelectItem value="OCR">OCR (Cambio)</SelectItem>
                        <SelectItem value="OCI">OCI (Info)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Formato Unidad</label>
                    <Select value={filters.format} onValueChange={(v) => setFilters(f => ({...f, format: v}))}>
                      <SelectTrigger className="h-8 text-xs bg-slate-50 border-none font-medium"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="Bodega Aurrera">Bodega Aurrera</SelectItem>
                        <SelectItem value="Walmart Supercenter">Supercenter</SelectItem>
                        <SelectItem value="Sams Club">Sams Club</SelectItem>
                        <SelectItem value="Bodega Aurrera Express">BA Express</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Filtro por Causa</label>
                  <Select value={filters.cause} onValueChange={(v) => setFilters(f => ({...f, cause: v}))}>
                    <SelectTrigger className="h-8 text-xs bg-slate-50 border-none font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las Causas</SelectItem>
                      <SelectItem value="Actualización de Prototipo">Actualización Prototipo</SelectItem>
                      <SelectItem value="Errores/Omisiones">Errores/Omisiones</SelectItem>
                      <SelectItem value="Regulatorio">Cumplimiento / Autoridad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">PID / Nombre del Proyecto</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Ej. 126393 o 'Sams'..." 
                      className="pl-8 h-8 text-xs bg-slate-50 border-none font-medium"
                      value={filters.projectName}
                      onChange={(e) => setFilters(f => ({...f, projectName: e.target.value}))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm h-full">
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Distribución por Generador</CardTitle>
                </CardHeader>
                <CardContent className="h-[220px] p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.generatorData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {metrics.generatorData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm h-full">
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Impacto por Formato de Negocio</CardTitle>
                </CardHeader>
                <CardContent className="h-[220px] p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.formatData}
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        dataKey="value"
                      >
                        {metrics.formatData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value as number)} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="py-3 px-4 border-b bg-white">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[11px] font-black uppercase text-primary flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4" /> Jerarquía de Causa Raíz (Verdad Técnica)
                  </CardTitle>
                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold">
                    <span>{formatNumber(metrics.count)} REGISTROS</span>
                    <span className="text-primary font-black text-xs">{formatCurrency(metrics.totalImpact)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                      <tr>
                        <th className="p-3 text-left">CAUSA DETECTADA</th>
                        <th className="p-3 text-center">Nº</th>
                        <th className="p-3 text-center">IA HEALTH</th>
                        <th className="p-3 text-right">IMPACTO NETO</th>
                        <th className="p-3 text-center">% PESO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {metrics.causeTable.slice(0, 8).map((row: any, i) => (
                        <tr key={i} className="hover:bg-primary/5 transition-colors">
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700">{row.name}</span>
                              <span className="text-[9px] text-slate-400 uppercase">Basado en {row.count} órdenes</span>
                            </div>
                          </td>
                          <td className="p-3 text-center text-slate-500 font-medium">{formatNumber(row.count)}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={`text-[9px] h-4 ${row.processed === row.count ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-amber-200 text-amber-600 bg-amber-50'}`}>
                              {Math.round((row.processed / row.count) * 100)}% SEMÁNTICO
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(row.impact)}</td>
                          <td className="p-3 w-28">
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                              <div 
                                className="h-full bg-primary" 
                                style={{ width: `${metrics.totalImpact > 0 ? Math.min(100, (row.impact / metrics.totalImpact) * 100) : 0}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-black border-t-2">
                      <tr>
                        <td className="p-3 uppercase">Total Acumulado ({selectedYear})</td>
                        <td className="p-3 text-center">{formatNumber(metrics.count)}</td>
                        <td className="p-3"></td>
                        <td className="p-3 text-right text-primary text-sm">{formatCurrency(metrics.totalImpact)}</td>
                        <td className="p-3 text-center">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Impacto Financiero por Unidad Generadora</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.generatorData} layout="vertical" margin={{ left: 40, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} />
                    <Tooltip cursor={{fill: 'rgba(41, 98, 255, 0.05)'}} />
                    <Bar dataKey="value" fill="#2962FF" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#64748b', fontWeight: 'bold', formatter: (v: number) => formatCurrency(v) }} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-4 border-b bg-slate-800">
              <CardTitle className="text-[11px] font-black uppercase text-white tracking-widest">Histórico de Proyectos vs OC</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse text-center">
                  <thead className="bg-slate-700 text-white font-bold">
                    <tr>
                      <th className="p-2 border-r text-left bg-slate-800">MÉTRICAS POR AÑO</th>
                      {HISTORICAL_YEARS.map(yr => (
                        <th key={yr} colSpan={3} className="p-2 border-r bg-slate-600 uppercase tracking-tighter">{yr}</th>
                      ))}
                    </tr>
                    <tr className="bg-slate-100 text-slate-600 font-black border-b">
                      <th className="p-2 border-r text-left">FORMATO DE UNIDAD</th>
                      {HISTORICAL_YEARS.map(yr => (
                        <React.Fragment key={yr}>
                          <th className="p-1 border-r">Proyectos</th>
                          <th className="p-1 border-r">Órdenes</th>
                          <th className="p-1 border-r bg-primary/10 text-primary">Ratio Desv</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {historicalMetrics.rows?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-2 border-r text-left font-bold text-slate-700">{row.format}</td>
                        {row.yearStats.map((ys, i) => (
                          <React.Fragment key={i}>
                            <td className="p-1 border-r">{ys.projectCount}</td>
                            <td className="p-1 border-r">{ys.orderCount}</td>
                            <td className="p-1 border-r bg-slate-50 font-bold text-slate-800">{ys.ratio}</td>
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-black border-t-2 text-slate-800">
                    <tr>
                      <td className="p-2 border-r text-left uppercase">Totales Consolidados</td>
                      {historicalMetrics.totals?.map((ts, i) => (
                        <React.Fragment key={i}>
                          <td className="p-1 border-r">{ts.projectCount}</td>
                          <td className="p-1 border-r">{ts.orderCount}</td>
                          <td className="p-1 border-r bg-slate-100 text-primary">{ts.ratio}</td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
