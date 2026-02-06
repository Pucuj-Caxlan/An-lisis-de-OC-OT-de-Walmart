
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
  LayoutGrid
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

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const HISTORICAL_YEARS = [2021, 2022, 2023, 2024];
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

  const filteredData = useMemo(() => {
    if (!rawOrders) return [];
    return rawOrders.filter(o => {
      const yearMatch = o.fechaSolicitud ? new Date(o.fechaSolicitud).getFullYear() === selectedYear : true;
      const typeMatch = filters.type === 'all' || o.type === filters.type;
      const formatMatch = filters.format === 'all' || o.format === filters.format;
      const countryMatch = filters.country === 'all' || o.country === filters.country;
      const projectMatch = !filters.projectName || o.projectName?.toLowerCase().includes(filters.projectName.toLowerCase());
      return yearMatch && typeMatch && formatMatch && countryMatch && projectMatch;
    });
  }, [rawOrders, selectedYear, filters]);

  const metrics = useMemo(() => {
    const totalImpact = filteredData.reduce((acc, curr) => acc + (curr.impactoNeto || 0), 0);
    const count = filteredData.length;
    
    // Impact by Generator
    const byGenerator = filteredData.reduce((acc: any, curr) => {
      const gen = curr.generadorDesviacion || 'Sin asignar';
      acc[gen] = (acc[gen] || 0) + (curr.impactoNeto || 0);
      return acc;
    }, {});
    const generatorData = Object.entries(byGenerator).map(([name, value]) => ({ name, value }));

    // Impact by Format
    const byFormat = filteredData.reduce((acc: any, curr) => {
      const fmt = curr.format || 'Otros';
      acc[fmt] = (acc[fmt] || 0) + (curr.impactoNeto || 0);
      return acc;
    }, {});
    const formatData = Object.entries(byFormat).map(([name, value]) => ({ name, value }));

    // Table Data
    const byCause = filteredData.reduce((acc: any, curr) => {
      const cause = curr.causaRaiz || 'N/A';
      if (!acc[cause]) acc[cause] = { name: cause, count: 0, impact: 0 };
      acc[cause].count += 1;
      acc[cause].impact += (curr.impactoNeto || 0);
      return acc;
    }, {});
    const causeTable = Object.values(byCause).sort((a: any, b: any) => b.impact - a.impact);

    return { totalImpact, count, generatorData, formatData, causeTable };
  }, [filteredData]);

  // Dynamic Historical Data Calculation
  const historicalMetrics = useMemo(() => {
    if (!rawOrders) return [];
    
    const stats: Record<string, Record<number, { projects: Set<string>, orders: number }>> = {};
    
    FORMATS.forEach(f => {
      stats[f] = {};
      HISTORICAL_YEARS.forEach(y => {
        stats[f][y] = { projects: new Set(), orders: 0 };
      });
    });

    rawOrders.forEach(o => {
      const year = o.fechaSolicitud ? new Date(o.fechaSolicitud).getFullYear() : null;
      const fmt = o.format;
      if (year && stats[fmt] && stats[fmt][year]) {
        stats[fmt][year].projects.add(o.projectId);
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

    // Calculate totals for the footer
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
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  const formatNumber = (val: number) => {
    if (!mounted) return "0";
    return val.toLocaleString();
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
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-lg border">
              {YEARS.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${selectedYear === y ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {y}
                </button>
              ))}
            </div>
            <Button size="sm" className="gap-2"><Download className="h-4 w-4" /> Export</Button>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-none shadow-sm">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo</label>
                    <Select value={filters.type} onValueChange={(v) => setFilters(f => ({...f, type: v}))}>
                      <SelectTrigger className="h-8 text-xs bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="OT">OT</SelectItem>
                        <SelectItem value="OCR">OCR</SelectItem>
                        <SelectItem value="OCI">OCI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Formato</label>
                    <Select value={filters.format} onValueChange={(v) => setFilters(f => ({...f, format: v}))}>
                      <SelectTrigger className="h-8 text-xs bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="Bodega Aurrera">Bodega</SelectItem>
                        <SelectItem value="Walmart Supercenter">Supercenter</SelectItem>
                        <SelectItem value="Sams Club">Sams Club</SelectItem>
                        <SelectItem value="Bodega Aurrera Express">Bodega Express</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Causa Raíz</label>
                  <Select value={filters.cause} onValueChange={(v) => setFilters(f => ({...f, cause: v}))}>
                    <SelectTrigger className="h-8 text-xs bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="Actualización de Prototipo">Actualización Prototipo</SelectItem>
                      <SelectItem value="Errores/Omisiones">Errores/Omisiones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Generador Desviación</label>
                  <Select value={filters.generator} onValueChange={(v) => setFilters(f => ({...f, generator: v}))}>
                    <SelectTrigger className="h-8 text-xs bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="Diseño">Diseño</SelectItem>
                      <SelectItem value="Operaciones">Operaciones</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Proyecto / PID</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Buscar por PID..." 
                      className="pl-8 h-8 text-xs bg-slate-50 border-none"
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
                  <CardTitle className="text-[11px] font-bold uppercase text-slate-500">Impacto Neto por Generador</CardTitle>
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
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm h-full">
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-[11px] font-bold uppercase text-slate-500">Impacto por Formato</CardTitle>
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
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
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
                  <CardTitle className="text-[11px] font-bold uppercase text-primary">Causa Raíz por Impacto</CardTitle>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                    <span>{formatNumber(metrics.count)} ÓRDENES</span>
                    <span className="text-primary font-black">{formatCurrency(metrics.totalImpact)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-slate-100 text-slate-500 font-bold border-b">
                    <tr>
                      <th className="p-3 text-left">CAUSA RAÍZ</th>
                      <th className="p-3 text-center">Nº</th>
                      <th className="p-3 text-center">%</th>
                      <th className="p-3 text-right">MONTO</th>
                      <th className="p-3 text-center">% PESO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {metrics.causeTable.slice(0, 8).map((row: any, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-700">{row.name}</td>
                        <td className="p-3 text-center text-slate-500">{formatNumber(row.count)}</td>
                        <td className="p-3 text-center text-slate-500">
                          {metrics.count > 0 ? ((row.count / metrics.count) * 100).toFixed(1) : '0.0'}%
                        </td>
                        <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(row.impact)}</td>
                        <td className="p-3 w-28">
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-rose-500" 
                              style={{ width: `${metrics.totalImpact > 0 ? Math.min(100, (row.impact / metrics.totalImpact) * 100) : 0}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black border-t-2">
                      <td className="p-3">TOTAL</td>
                      <td className="p-3 text-center">{formatNumber(metrics.count)}</td>
                      <td className="p-3 text-center">100%</td>
                      <td className="p-3 text-right">{formatCurrency(metrics.totalImpact)}</td>
                      <td className="p-3 text-center">100%</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-[11px] font-bold uppercase text-slate-500">% Por Generador de Desviación</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.generatorData} layout="vertical" margin={{ left: 40, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="value" fill="#2962FF" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#64748b', formatter: (v: number) => formatCurrency(v) }} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-[11px] font-bold uppercase text-slate-500">Histórico de Proyectos vs OC (Datos Reales)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse text-center">
                  <thead className="bg-slate-800 text-white font-bold">
                    <tr>
                      <th className="p-2 border-r text-left bg-slate-700">AÑO</th>
                      {HISTORICAL_YEARS.map(yr => (
                        <th key={yr} colSpan={3} className="p-2 border-r bg-slate-600">{yr}</th>
                      ))}
                    </tr>
                    <tr className="bg-slate-100 text-slate-600 font-black border-b">
                      <th className="p-2 border-r text-left">FORMATO</th>
                      {HISTORICAL_YEARS.map(yr => (
                        <React.Fragment key={yr}>
                          <th className="p-1 border-r">N° Proy</th>
                          <th className="p-1 border-r">N° OC</th>
                          <th className="p-1 border-r bg-slate-200">Ratio</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {historicalMetrics.rows?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 border-r text-left font-bold">{row.format}</td>
                        {row.yearStats.map((ys, i) => (
                          <React.Fragment key={i}>
                            <td className="p-1 border-r">{ys.projectCount}</td>
                            <td className="p-1 border-r">{ys.orderCount}</td>
                            <td className="p-1 border-r bg-slate-50 font-medium">{ys.ratio}</td>
                          </React.Fragment>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black border-t-2">
                      <td className="p-2 border-r text-left">TOTAL</td>
                      {historicalMetrics.totals?.map((ts, i) => (
                        <React.Fragment key={i}>
                          <td className="p-1 border-r">{ts.projectCount}</td>
                          <td className="p-1 border-r">{ts.orderCount}</td>
                          <td className="p-1 border-r bg-slate-100">{ts.ratio}</td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
