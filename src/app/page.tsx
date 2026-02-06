
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Download,
  BarChart3,
  Search,
  TrendingUp,
  BrainCircuit,
  Database,
  RefreshCcw,
  CalendarDays
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

const YEARS = [2022, 2023, 2024, 2025, 2026];
const COLORS = ['#2962FF', '#FF8F00', '#00C853', '#D50000', '#6200EA', '#00B8D4', '#FFD600', '#AA00FF', '#37474F', '#9E9E9E'];

export default function VpDashboard() {
  const db = useFirestore();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear);
  const [mounted, setMounted] = useState(false);
  const [filters, setFilters] = useState({
    type: 'all',
    format: 'all',
    country: 'all',
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

  // Helper para normalizar el tipo de orden (PDF a Dashboard)
  const normalizeOrderType = (type: string = ""): string => {
    const t = type.toUpperCase();
    if (t.includes('TRABAJO') || t === 'OT') return 'OT';
    if (t.includes('CAMBIO') || t === 'OCR') return 'OCR';
    if (t.includes('INFO') || t === 'OCI') return 'OCI';
    return t;
  };

  // Helper para normalizar el formato
  const normalizeFormat = (format: string = ""): string => {
    const f = format.toLowerCase();
    if (f.includes('sams')) return 'Sams Club';
    if (f.includes('supercenter')) return 'Walmart Supercenter';
    if (f.includes('express')) return 'Bodega Aurrera Express';
    if (f.includes('aurrera')) return 'Bodega Aurrera';
    return format;
  };

  // Helper robusto para extraer el año, manejando fechas en español del OCR
  const getOrderYear = (o: any): number | null => {
    const dateStr = o.fechaSolicitud || o.requestDate || o.header?.requestDate || o.projectInfo?.requestDate || o.processedAt;
    if (!dateStr) return null;
    
    try {
      // Caso 1: Fecha ya es un objeto Date o ISO string estándar
      const date = new Date(dateStr);
      if (!isNaN(date.getFullYear())) return date.getFullYear();

      // Caso 2: Fecha con formato español (ej: "03 / septiembre / 2025")
      const lowerDate = String(dateStr).toLowerCase();
      const yearMatch = lowerDate.match(/\b(202[2-6])\b/);
      if (yearMatch) return parseInt(yearMatch[1]);

      return null;
    } catch {
      return null;
    }
  };

  // Conteo de registros por año para el selector
  const countsByYear = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    YEARS.forEach(y => counts[y] = 0);
    if (!rawOrders) return counts;
    
    rawOrders.forEach(o => {
      counts.all++;
      const yr = getOrderYear(o);
      if (yr && counts[yr] !== undefined) {
        counts[yr]++;
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
      const orderYear = getOrderYear(o);
      
      // Filtro de Año
      const yearMatch = selectedYear === 'all' || orderYear === selectedYear;
      
      // Normalización para filtros ejecutivos
      const rawType = o.type || o.header?.type || "";
      const normalizedType = normalizeOrderType(rawType);
      
      const rawFormat = o.format || o.projectInfo?.format || "Otros";
      const normalizedFormat = normalizeFormat(rawFormat);

      const orderCountry = o.country || "México";
      const orderPid = String(o.projectId || o.projectInfo?.projectId || "").toLowerCase();
      const orderName = String(o.projectName || o.projectInfo?.projectName || "").toLowerCase();

      const typeMatch = filters.type === 'all' || normalizedType === filters.type;
      const formatMatch = filters.format === 'all' || normalizedFormat === filters.format;
      const countryMatch = filters.country === 'all' || orderCountry === filters.country;
      const projectMatch = !filters.projectName || 
        orderName.includes(filters.projectName.toLowerCase()) ||
        orderPid.includes(filters.projectName.toLowerCase());
      
      return yearMatch && typeMatch && formatMatch && countryMatch && projectMatch;
    });
  }, [rawOrders, selectedYear, filters]);

  const metrics = useMemo(() => {
    const totalImpact = filteredData.reduce((acc, curr) => acc + (curr.impactoNeto || curr.financialImpact?.netImpact || 0), 0);
    const count = filteredData.length;
    
    const byGenerator = filteredData.reduce((acc: any, curr) => {
      const gen = curr.generadorDesviacion || curr.projectInfo?.requestingArea || 'Sin asignar';
      const impact = curr.impactoNeto || curr.financialImpact?.netImpact || 0;
      acc[gen] = (acc[gen] || 0) + impact;
      return acc;
    }, {});
    const generatorData = Object.entries(byGenerator)
      .map(([name, value]) => ({ name, value: value as number }))
      .sort((a, b) => b.value - a.value);

    const byFormat = filteredData.reduce((acc: any, curr) => {
      const rawFmt = curr.format || curr.projectInfo?.format || 'Otros';
      const fmt = normalizeFormat(rawFmt);
      const impact = curr.impactoNeto || curr.financialImpact?.netImpact || 0;
      acc[fmt] = (acc[fmt] || 0) + impact;
      return acc;
    }, {});
    const formatData = Object.entries(byFormat).map(([name, value]) => ({ name, value: value as number }));

    const byCause = filteredData.reduce((acc: any, curr) => {
      const cause = curr.semanticAnalysis?.causaRaizReal || curr.causaRaiz || curr.projectInfo?.rootCauseDeclared || 'No Identificada';
      const impact = curr.impactoNeto || curr.financialImpact?.netImpact || 0;
      if (!acc[cause]) acc[cause] = { name: cause, count: 0, impact: 0 };
      acc[cause].count += 1;
      acc[cause].impact += impact;
      return acc;
    }, {});
    const causeTable = Object.values(byCause).sort((a: any, b: any) => b.impact - a.impact);

    return { totalImpact, count, generatorData, formatData, causeTable };
  }, [filteredData]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN', 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(val);
  };

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
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">VP Construction Dashboard</h1>
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
            <div className="flex bg-slate-100 p-1 rounded-lg border gap-1 shadow-inner">
              <button
                onClick={() => setSelectedYear('all')}
                className={`flex flex-col items-center justify-center min-w-[55px] px-2 py-1 rounded-md transition-all ${selectedYear === 'all' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
              >
                <span className="text-xs font-bold">TODO</span>
                <span className="text-[9px] font-medium opacity-80">{countsByYear.all}</span>
              </button>
              {YEARS.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`flex flex-col items-center justify-center min-w-[55px] px-2 py-1 rounded-md transition-all ${selectedYear === y ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'}`}
                >
                  <span className="text-xs font-bold">{y}</span>
                  <span className="text-[9px] font-medium opacity-80">
                    {countsByYear[y] || 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 border-none shadow-sm bg-white">
              <CardHeader className="pb-2 border-b mb-4">
                <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Database className="h-4 w-4" /> Filtros Ejecutivos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Tipo de Orden</label>
                    <Select value={filters.type} onValueChange={(v) => setFilters(f => ({...f, type: v}))}>
                      <SelectTrigger className="h-9 text-xs bg-slate-50 border-none font-medium"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="OT">OT (Trabajo)</SelectItem>
                        <SelectItem value="OCR">OCR (Cambio)</SelectItem>
                        <SelectItem value="OCI">OCI (Info)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Formato Unidad</label>
                    <Select value={filters.format} onValueChange={(v) => setFilters(f => ({...f, format: v}))}>
                      <SelectTrigger className="h-9 text-xs bg-slate-50 border-none font-medium"><SelectValue /></SelectTrigger>
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">PID o Nombre del Proyecto</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Ej. 126393..." 
                      className="pl-9 h-9 text-xs bg-slate-50 border-none font-medium"
                      value={filters.projectName}
                      onChange={(e) => setFilters(f => ({...f, projectName: e.target.value}))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm h-full bg-white">
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

              <Card className="border-none shadow-sm h-full bg-white">
                <CardHeader className="py-3 px-4 border-b">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Impacto por Formato</CardTitle>
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
            <Card className="border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="py-3 px-4 border-b bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-[11px] font-black uppercase text-primary flex items-center gap-2 tracking-widest">
                    <BrainCircuit className="h-4 w-4" /> Jerarquía de Causa Raíz Real
                  </CardTitle>
                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold">
                    <span>{metrics.count} REGISTROS</span>
                    <span className="text-primary font-black text-sm">{formatCurrency(metrics.totalImpact)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b">
                      <tr>
                        <th className="p-3 text-left">CAUSA TÉCNICA (IA)</th>
                        <th className="p-3 text-center">Nº REG</th>
                        <th className="p-3 text-right">IMPACTO NETO</th>
                        <th className="p-3 text-center">% PESO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {metrics.causeTable.length === 0 ? (
                        <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">No hay datos para los filtros seleccionados.</td></tr>
                      ) : metrics.causeTable.slice(0, 10).map((row: any, i) => (
                        <tr key={i} className="hover:bg-primary/5 transition-colors">
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700">{row.name}</span>
                              <span className="text-[9px] text-slate-400 uppercase font-medium">Validación Semántica Activa</span>
                            </div>
                          </td>
                          <td className="p-3 text-center text-slate-500 font-bold">{row.count}</td>
                          <td className="p-3 text-right font-black text-slate-800">{formatCurrency(row.impact)}</td>
                          <td className="p-3 w-32">
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                              <div 
                                className="h-full bg-primary" 
                                style={{ width: `${metrics.totalImpact > 0 ? Math.min(100, (row.impact / metrics.totalImpact) * 100) : 0}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-800 text-white font-black border-t-2">
                      <tr>
                        <td className="p-3 uppercase tracking-tighter">Total Consolidado ({selectedYear === 'all' ? 'Histórico' : selectedYear})</td>
                        <td className="p-3 text-center">{metrics.count}</td>
                        <td className="p-3 text-right text-accent">{formatCurrency(metrics.totalImpact)}</td>
                        <td className="p-3 text-center">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Impacto por Área Solicitante</CardTitle>
              </CardHeader>
              <CardContent className="h-[400px] pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.generatorData} layout="vertical" margin={{ left: 40, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} />
                    <Tooltip cursor={{fill: 'rgba(41, 98, 255, 0.05)'}} formatter={(v) => formatCurrency(v as number)} />
                    <Bar dataKey="value" fill="#2962FF" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
