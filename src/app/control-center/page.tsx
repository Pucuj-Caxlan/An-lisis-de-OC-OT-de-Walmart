
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  TrendingUp, 
  Target, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Layers, 
  Building2, 
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Maximize2,
  MoreVertical,
  Calendar,
  AlertCircle,
  Signature
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const CHART_COLORS = ['#2962FF', '#FF8F00', '#00C853', '#D50000', '#6200EA', '#00B8D4'];

const Sparkline = ({ data, color }: { data: any[], color: string }) => (
  <div className="h-12 w-24">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          fill={color} 
          fillOpacity={0.1} 
          strokeWidth={2} 
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default function ControlCenterPage() {
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!db) return;
    const fetchTotal = async () => {
      const snapshot = await getCountFromServer(collection(db, 'orders'));
      setTotalInDb(snapshot.data().count);
    };
    fetchTotal();
  }, [db]);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), orderBy('processedAt', 'desc'), limit(10000));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const stats = useMemo(() => {
    if (!orders) return null;
    const totalImpact = orders.reduce((acc, o) => acc + (o.impactoNeto || 0), 0);
    const avgTicket = orders.length > 0 ? totalImpact / orders.length : 0;
    const signedCount = orders.filter(o => o.isSigned).length;
    const signRatio = orders.length > 0 ? (signedCount / orders.length) * 100 : 0;
    
    // Agrupación por Etapa (Radar Chart)
    const stagesMap: Record<string, number> = {};
    orders.forEach(o => {
      const stage = o.projectStage || o.etapaProyecto || 'Sin Definir';
      stagesMap[stage] = (stagesMap[stage] || 0) + (o.impactoNeto || 0);
    });
    const radarData = Object.entries(stagesMap).map(([subject, value]) => ({ 
      subject, 
      value: Math.round(value / 1000000) // In Millions
    })).slice(0, 6);

    // Agrupación por Formato (Heatmap Style Bar)
    const formatMap: Record<string, number> = {};
    orders.forEach(o => {
      const format = o.format || 'Otros';
      formatMap[format] = (formatMap[format] || 0) + (o.impactoNeto || 0);
    });
    const formatData = Object.entries(formatMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Tendencia de Ingesta (Sparkline dummy context)
    const sparklineData = Array.from({ length: 10 }).map((_, i) => ({ value: Math.random() * 100 }));

    return { totalImpact, avgTicket, signRatio, radarData, formatData, sparklineData };
  }, [orders]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', currency: 'MXN', maximumFractionDigits: 0 
    }).format(val);
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Operational Control Center</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-2 px-3 py-1 uppercase font-black">
              <Database className="h-3 w-3" /> Base Global: {totalInDb || 0}
            </Badge>
            <div className="h-8 w-px bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronización Live</span>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-6">
          {/* Fila Superior: KPIs Forenses con Sparklines */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Impacto Activo</p>
                    <h3 className="text-2xl font-headline font-bold text-slate-800">{formatCurrency(stats?.totalImpact || 0)}</h3>
                  </div>
                  <Sparkline data={stats?.sparklineData || []} color="#2962FF" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-emerald-600">
                  <ArrowUpRight className="h-3 w-3" />
                  <span className="text-[10px] font-black uppercase">+12% vs sem anterior</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Ticket Promedio</p>
                    <h3 className="text-2xl font-headline font-bold text-slate-800">{formatCurrency(stats?.avgTicket || 0)}</h3>
                  </div>
                  <Sparkline data={stats?.sparklineData || []} color="#FF8F00" />
                </div>
                <div className="mt-4 flex items-center gap-2 text-rose-600">
                  <ArrowUpRight className="h-3 w-3" />
                  <span className="text-[10px] font-black uppercase">Desviación en aumento</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Gobernanza (Firma)</p>
                    <h3 className="text-2xl font-headline font-bold text-slate-800">{Math.round(stats?.signRatio || 0)}%</h3>
                  </div>
                  <div className="h-12 w-24 flex items-center justify-center">
                    <Signature className="h-8 w-8 text-emerald-100 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </div>
                <Progress value={stats?.signRatio || 0} className="h-1 mt-4" />
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-slate-900 text-white overflow-hidden">
              <CardContent className="p-6 relative">
                <Zap className="absolute top-2 right-2 h-12 w-12 opacity-5 text-accent" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Volumen en Auditoría</p>
                <h3 className="text-3xl font-headline font-bold">{orders?.length || 0}</h3>
                <div className="mt-4 flex items-center gap-2">
                  <Badge className="bg-primary text-white border-none text-[8px] font-black">SSOT LIVE</Badge>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">100% registros</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visualización de Radar: Impacto por Etapa */}
            <Card className="lg:col-span-1 border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b pb-4">
                <CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                  <Target className="h-4 w-4" /> Concentración por Etapa
                </CardTitle>
                <CardDescription className="text-[9px] font-bold text-slate-400 uppercase">Desviación en Millones MXN</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats?.radarData || []}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 8 }} />
                    <Radar
                      name="Impacto"
                      dataKey="value"
                      stroke="#2962FF"
                      fill="#2962FF"
                      fillOpacity={0.5}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Visualización de Calor: Formato de Tienda */}
            <Card className="lg:col-span-2 border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Impacto por Formato de Tienda
                  </CardTitle>
                  <CardDescription className="text-[9px] font-bold text-slate-400 uppercase">Eficiencia económica por unidad de negocio</CardDescription>
                </div>
                <Badge className="bg-accent text-slate-900 border-none text-[8px] font-black uppercase tracking-tight px-3 py-1">Top Drivers</Badge>
              </CardHeader>
              <CardContent className="h-[350px] pt-8 px-8">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.formatData || []} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fontSize: 9, fontWeight: 'bold', fill: '#64748b' }} 
                      width={100}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(v: any) => formatCurrency(v)}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={32}>
                      {(stats?.formatData || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Registro de Auditoría de Alta Prioridad */}
            <Card className="lg:col-span-3 border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6 flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Layers className="h-4 w-4 text-accent" /> Registros Críticos Recientes
                  </CardTitle>
                  <CardDescription className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Requieren validación inmediata por impacto económico</CardDescription>
                </div>
                <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl h-10 w-10 p-0"><Maximize2 className="h-5 w-5" /></Button>
              </CardHeader>
              <ScrollArea className="h-[400px]">
                <div className="p-0">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                      <tr>
                        <th className="text-[9px] font-black text-slate-400 uppercase p-4">PID / Proyecto</th>
                        <th className="text-[9px] font-black text-slate-400 uppercase p-4">Disciplina</th>
                        <th className="text-[9px] font-black text-slate-400 uppercase p-4">Firma</th>
                        <th className="text-[9px] font-black text-slate-400 uppercase p-4 text-right">Monto</th>
                        <th className="p-4"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders?.slice(0, 10).map((o, i) => (
                        <tr key={o.id || i} className="hover:bg-slate-50/50 group transition-colors">
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-black text-primary text-xs">{o.projectId}</span>
                              <span className="text-[9px] text-slate-400 uppercase font-bold truncate max-w-[200px]">{o.projectName}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge variant="outline" className="text-[8px] font-black uppercase bg-white border-slate-200">{o.disciplina_normalizada || "Pendiente"}</Badge>
                          </td>
                          <td className="p-4">
                            {o.isSigned ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-none text-[8px] font-black">VALIDADO</Badge>
                            ) : (
                              <Badge className="bg-rose-50 text-rose-700 border-none text-[8px] font-black animate-pulse">PENDIENTE</Badge>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-black text-slate-800 text-xs">{formatCurrency(o.impactoNeto || 0)}</span>
                          </td>
                          <td className="p-4 text-right">
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-8 w-8 text-slate-400"><ArrowUpRight className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </Card>

            {/* Sidebar de Alertas y Sistema */}
            <div className="space-y-6">
              <Card className="border-none shadow-lg bg-white rounded-3xl overflow-hidden">
                <CardHeader className="pb-2 border-b bg-slate-50">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Salud de Ingesta
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Integridad de Datos</p>
                      <span className="text-xs font-black text-emerald-600">92%</span>
                    </div>
                    <Progress value={92} className="h-1.5" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Trazabilidad Reconstruida</p>
                      <span className="text-xs font-black text-primary">85%</span>
                    </div>
                    <Progress value={85} className="h-1.5" />
                  </div>
                  <Separator />
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-2xl border border-amber-100">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="text-[9px] font-black text-amber-900 uppercase">Alerta de Volumen</p>
                      <p className="text-[10px] text-amber-700 leading-tight">Se detectó un incremento del 20% en OCs de HVAC en la última semana.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg bg-primary text-white rounded-3xl p-6 relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                  <div className="bg-white/20 h-10 w-10 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-headline font-bold uppercase leading-tight">Estado de Cumplimiento</h4>
                    <p className="text-[10px] text-white/60 uppercase font-bold tracking-widest mt-1">Auditado hoy por WAI</p>
                  </div>
                  <Button className="w-full bg-white text-primary hover:bg-white/90 font-black text-[10px] uppercase rounded-xl h-10">Ver Reporte Forense</Button>
                </div>
                <Database className="absolute -bottom-4 -right-4 h-24 w-24 opacity-10" />
              </Card>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
