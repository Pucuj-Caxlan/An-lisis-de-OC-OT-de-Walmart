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
const COLORS = ['#2962FF', '#FF8F00', '#00C853', '#D50000', '#6200EA', '#00B8D4', '#FFD600', '#AA00FF', '#37474F', '#9E9E9E'];

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

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
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
          {/* Dashboard Filters Grid */}
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
            {/* Main Data Table */}
            <Card className="border-none shadow-sm overflow-hidden">
              <CardHeader className="py-3 px-4 border-b bg-white">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[11px] font-bold uppercase text-primary">Causa Raíz por Impacto</CardTitle>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                    <span>{metrics.count} ÓRDENES</span>
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
                        <td className="p-3 text-center text-slate-500">{row.count}</td>
                        <td className="p-3 text-center text-slate-500">
                          {((row.count / metrics.count) * 100).toFixed(1)}%
                        </td>
                        <td className="p-3 text-right font-bold text-slate-800">{formatCurrency(row.impact)}</td>
                        <td className="p-3 w-28">
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-rose-500" 
                              style={{ width: `${Math.min(100, (row.impact / metrics.totalImpact) * 100)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black border-t-2">
                      <td className="p-3">TOTAL</td>
                      <td className="p-3 text-center">{metrics.count}</td>
                      <td className="p-3 text-center">100%</td>
                      <td className="p-3 text-right">{formatCurrency(metrics.totalImpact)}</td>
                      <td className="p-3 text-center">100%</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Distribution Bar Chart */}
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
                    <Bar dataKey="value" fill="#2962FF" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 10, fill: '#64748b' }} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Historical Pivot Table (Replicating Image Bottom Left) */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-[11px] font-bold uppercase text-slate-500">Histórico de Proyectos vs OC</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse text-center">
                  <thead className="bg-slate-800 text-white font-bold">
                    <tr>
                      <th className="p-2 border-r text-left bg-slate-700">AÑO</th>
                      <th colSpan={3} className="p-2 border-r bg-slate-600">2021</th>
                      <th colSpan={3} className="p-2 border-r bg-slate-500">2022</th>
                      <th colSpan={3} className="p-2 border-r bg-slate-400">2023</th>
                      <th colSpan={3} className="p-2">2024</th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-600 font-black border-b">
                      <th className="p-2 border-r text-left">FORMATO</th>
                      <th className="p-1 border-r">N° Proy</th><th className="p-1 border-r">N° OC</th><th className="p-1 border-r bg-slate-200">Ratio</th>
                      <th className="p-1 border-r">N° Proy</th><th className="p-1 border-r">N° OC</th><th className="p-1 border-r bg-slate-200">Ratio</th>
                      <th className="p-1 border-r">N° Proy</th><th className="p-1 border-r">N° OC</th><th className="p-1 border-r bg-slate-200">Ratio</th>
                      <th className="p-1 border-r">N° Proy</th><th className="p-1 border-r">N° OC</th><th className="p-1">Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {['Bodega', 'Supercenter', 'Sams Club', 'Mi Bodega'].map((fmt, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 border-r text-left font-bold">{fmt}</td>
                        <td className="p-1 border-r">22</td><td className="p-1 border-r">108</td><td className="p-1 border-r bg-slate-50">4.9</td>
                        <td className="p-1 border-r">16</td><td className="p-1 border-r">55</td><td className="p-1 border-r bg-slate-50">3.4</td>
                        <td className="p-1 border-r">44</td><td className="p-1 border-r">98</td><td className="p-1 border-r bg-slate-50">2.2</td>
                        <td className="p-1 border-r">41</td><td className="p-1 border-r">141</td><td className="p-1">3.4</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-black border-t-2">
                      <td className="p-2 border-r text-left">TOTAL</td>
                      <td className="p-1 border-r">85</td><td className="p-1 border-r">302</td><td className="p-1 border-r bg-slate-100">3.6</td>
                      <td colSpan={9} className="p-1">...</td>
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
