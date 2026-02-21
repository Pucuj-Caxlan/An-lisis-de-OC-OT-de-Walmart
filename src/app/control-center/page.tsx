
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  TrendingUp, 
  Target, 
  ShieldCheck, 
  Zap, 
  Clock, 
  Building2, 
  Database,
  LayoutGrid,
  FileSpreadsheet,
  Download,
  Share2,
  MoreHorizontal
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
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy, getCountFromServer } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CYAN_PRIMARY = "#00D8FF";
const CYAN_SECONDARY = "#70EFFF";
const CYAN_DARK = "#009BB2";
const NEUTRAL_GREY = "#F3F4F6";

const Sparkline = ({ data, color }: { data: any[], color: string }) => (
  <div className="h-10 w-24">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          fill={color} 
          fillOpacity={0.1} 
          strokeWidth={1.5} 
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default function ControlCenterPage() {
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState('impact');

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
    return query(collection(db, 'orders'), orderBy('processedAt', 'desc'), limit(5000));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const stats = useMemo(() => {
    if (!orders) return null;
    const totalImpact = orders.reduce((acc, o) => acc + (o.impactoNeto || 0), 0);
    const avgTicket = orders.length > 0 ? totalImpact / orders.length : 0;
    const signedCount = orders.filter(o => o.isSigned).length;
    const signRatio = orders.length > 0 ? (signedCount / orders.length) * 10 : 5.0; // Scale 0-10 for reference image look
    
    // Trend Data (Last 30 days dummy mock for line style)
    const trendData = Array.from({ length: 20 }).map((_, i) => ({
      day: `${i + 1} oct.`,
      value: Math.floor(Math.random() * 10) + 5,
      impact: Math.floor(Math.random() * 500000) + 100000
    }));

    // By Format (Donut)
    const formatMap: Record<string, number> = {};
    orders.forEach(o => {
      const f = o.format || 'Otros';
      formatMap[f] = (formatMap[f] || 0) + 1;
    });
    const formatData = Object.entries(formatMap).map(([name, value]) => ({ name, value }));

    // By Stage (Stacked Bar Style)
    const stages = ['Diseño', 'Construcción', 'Equipamiento', 'Cierre'];
    const stageData = stages.map(s => ({
      name: s,
      '0-8': Math.floor(Math.random() * 20),
      '9-11': Math.floor(Math.random() * 20),
      '14-19': Math.floor(Math.random() * 20),
      '20-23': Math.floor(Math.random() * 20),
    }));

    // By Discipline (Bubble Style)
    const disciplineMap: Record<string, number> = {};
    orders.forEach(o => {
      const d = o.disciplina_normalizada || 'Otros';
      disciplineMap[d] = (disciplineMap[d] || 0) + (o.impactoNeto || 0);
    });
    const bubbleData = Object.entries(disciplineMap).map(([name, impact]) => ({
      name,
      x: Math.random() * 100,
      y: Math.random() * 100,
      z: impact / 100000,
      impact
    })).slice(0, 10);

    return { totalImpact, avgTicket, signRatio, trendData, formatData, stageData, bubbleData };
  }, [orders]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-slate-100"><Activity className="h-12 w-12 text-cyan-500 animate-spin" /></div>;

  return (
    <div className="flex min-h-screen w-full bg-[#E5E7EB]">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between bg-white px-8 border-b border-slate-200">
          <div className="flex items-center gap-6">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-tight font-headline">Walmart International | Construction Operational Control</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] font-bold border-slate-300">OCTUBRE 2024</Badge>
                <div className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Dashboard View</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-400"><FileSpreadsheet className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="text-slate-400"><Download className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="text-slate-400"><Share2 className="h-5 w-5" /></Button>
          </div>
        </header>

        <main className="p-8 space-y-8">
          {/* TOP KPI ROW (Matching Image style) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { label: 'N° OF ORDERS', value: totalInDb || 0, color: CYAN_PRIMARY, spark: true },
              { label: 'AVG IMPACT (MXN)', value: Math.round((stats?.avgTicket || 0) / 1000) + 'k', color: CYAN_PRIMARY, spark: true },
              { label: 'PROCESS TIME (DAYS)', value: '35,0', color: CYAN_PRIMARY, spark: true },
              { label: 'COMPLIANCE SCORE', value: (stats?.signRatio || 5.0).toFixed(1) + '/10', color: '#FFB800', spark: false }
            ].map((kpi, i) => (
              <Card key={i} className="border-none shadow-sm overflow-hidden bg-white rounded-sm">
                <CardContent className="p-0 flex h-24">
                  <div className="w-2 h-full" style={{ backgroundColor: kpi.color }} />
                  <div className="flex-1 p-4 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{kpi.label}</p>
                      <h3 className="text-3xl font-black text-slate-800">{kpi.value}</h3>
                    </div>
                    {kpi.spark && <Sparkline data={Array.from({length: 10}).map(() => ({value: Math.random()}))} color={kpi.color} />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT: Distribution by Format (Gender equivalent) */}
            <Card className="border-none shadow-sm bg-white rounded-sm p-6 h-full min-h-[400px]">
              <h4 className="text-xs font-black text-slate-800 uppercase border-b pb-4 mb-6">By Store Format</h4>
              <div className="h-[250px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.formatData}
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats?.formatData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? CYAN_PRIMARY : '#BDEFFF'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-2xl font-black text-slate-800">58,7%</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Supercenter</p>
                </div>
              </div>
              <div className="flex justify-center gap-6 mt-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-cyan-100 rounded-sm" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Sams Club</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-[#00D8FF] rounded-sm" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Supercenter</span>
                </div>
              </div>
            </Card>

            {/* RIGHT: Trend By (Matching Image style) */}
            <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-sm p-6 overflow-hidden">
              <div className="flex justify-between items-center border-b pb-4 mb-6">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Trend By</h4>
                <div className="flex bg-slate-100 p-1 rounded-sm gap-1">
                  {['N° Orders', 'Impact', 'Avg Time', 'Compliance'].map((t) => (
                    <button 
                      key={t}
                      className={`px-4 py-1 text-[9px] font-black uppercase rounded-sm transition-all ${t === 'N° Orders' ? 'bg-[#00D8FF] text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CYAN_PRIMARY} stopOpacity={0.1}/>
                        <stop offset="95%" stopColor={CYAN_PRIMARY} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#9CA3AF', fontWeight: 'bold' }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#9CA3AF' }} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke={CYAN_PRIMARY} 
                      strokeWidth={3} 
                      fill="url(#colorValue)" 
                      dot={{ r: 4, fill: CYAN_PRIMARY, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* BOTTOM LEFT: By Stage & Day (Stacked Horizontal Equivalent) */}
            <Card className="border-none shadow-sm bg-white rounded-sm p-6">
              <h4 className="text-xs font-black text-slate-800 uppercase border-b pb-4 mb-6 tracking-widest">By Stage & Intensity</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.stageData} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fontWeight: 'bold', fill: '#6B7280' }} 
                    />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="0-8" stackId="a" fill="#70EFFF" barSize={12} radius={[2, 0, 0, 2]} />
                    <Bar dataKey="9-11" stackId="a" fill="#40E5FF" />
                    <Bar dataKey="14-19" stackId="a" fill="#00D8FF" />
                    <Bar dataKey="20-23" stackId="a" fill="#00B8D4" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-4">
                {['0-8', '9-11', '14-19', '20-23'].map((label, i) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="h-2 w-4 rounded-[1px]" style={{ backgroundColor: [ '#70EFFF', '#40E5FF', '#00D8FF', '#00B8D4' ][i] }} />
                    <span className="text-[8px] font-black text-slate-400 uppercase">{label}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* BOTTOM RIGHT: By Discipline (Bubble/Circular Equivalent) */}
            <Card className="border-none shadow-sm bg-white rounded-sm p-6">
              <h4 className="text-xs font-black text-slate-800 uppercase border-b pb-4 mb-6 tracking-widest">By Discipline Impact</h4>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis type="number" dataKey="x" hide />
                    <YAxis type="number" dataKey="y" hide />
                    <ZAxis type="number" dataKey="z" range={[400, 4000]} name="Impacto" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-2 border shadow-sm rounded-sm">
                            <p className="text-[10px] font-black uppercase text-slate-800">{data.name}</p>
                            <p className="text-[9px] text-cyan-600 font-bold">{formatCurrency(data.impact)}</p>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Scatter name="Disciplines" data={stats?.bubbleData} fill={CYAN_PRIMARY}>
                      {stats?.bubbleData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? CYAN_PRIMARY : CYAN_SECONDARY} fillOpacity={0.8} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-5 gap-2 mt-4">
                {stats?.bubbleData.slice(0, 5).map((d, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase truncate">{d.name}</p>
                    <p className="text-[9px] font-bold text-slate-800">{Math.round(d.z / 10)}%</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </main>
        
        <footer className="px-8 py-4 bg-white border-t flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <span>*WAI-FD DASHBOARD // DESIGNED BY: WALMART INT. CONSTRUCTION</span>
          <div className="flex gap-4">
            <MoreHorizontal className="h-4 w-4" />
          </div>
        </footer>
      </SidebarInset>
    </div>
  );
}
