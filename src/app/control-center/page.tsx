
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Target, 
  Zap, 
  Database,
  Layers,
  Focus,
  Filter,
  TrendingDown,
  ShieldAlert,
  ArrowRight,
  SearchCode,
  AlertTriangle,
  HardHat,
  FileWarning,
  ChevronLeft
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, limit, orderBy, getCountFromServer, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from '@/components/ui/progress';

const CYAN_PRIMARY = "#00D8FF";
const PARETO_ORANGE = "#FF8F00";

export default function ControlCenterPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all');

  useEffect(() => { setMounted(true); }, []);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  const taxonomyQuery = useMemoFirebase(() => db ? collection(db, 'taxonomy_disciplines') : null, [db]);
  const { data: taxonomyDocs } = useCollection(taxonomyQuery);

  useEffect(() => {
    if (!db || !user?.uid) return;
    const fetchTotal = async () => {
      try {
        const snapshot = await getCountFromServer(collection(db, 'orders'));
        setTotalInDb(snapshot.data().count);
      } catch (e) { console.warn("Failed fetch:", e); }
    };
    fetchTotal();
  }, [db, user?.uid]);

  const stats = useMemo(() => {
    if (!taxonomyDocs) return null;

    const totalImpact = globalAgg?.totalImpact || 0;
    
    const paretoDiscs = taxonomyDocs.map(d => ({
      name: d.id,
      impact: d.impact,
      count: d.count,
      topSubName: Object.entries(d.subs || {}).sort((a: any, b: any) => b[1].impact - a[1].impact)[0]?.[0] || 'N/A',
      subs: Object.entries(d.subs || {}).map(([name, s]: any) => ({ name, impact: s.impact })).sort((a,b) => b.impact - a.impact)
    })).sort((a,b) => b.impact - a.impact);

    let cumulative = 0;
    const paretoWithPcts = paretoDiscs.map(d => {
      cumulative += d.impact;
      return { ...d, cumulativePct: totalImpact > 0 ? (cumulative / totalImpact) * 100 : 0 };
    });

    const vitalFew = paretoWithPcts.filter(d => d.cumulativePct <= 85);
    const concentrationRatio = totalImpact > 0 ? (vitalFew.reduce((a, b) => a + b.impact, 0) / totalImpact) * 100 : 0;

    return { 
      totalImpact, 
      displayCount: totalInDb || 0, 
      concentrationRatio, 
      paretoDiscs: paretoWithPcts,
      trendData: Array.from({ length: 15 }).map((_, i) => ({ day: `${i + 1} Oct`, volume: 10 + i, impact: 500000 + (i*100000), concentration: 75 + (i%5) }))
    };
  }, [taxonomyDocs, globalAgg, totalInDb]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  if (!user?.uid || !mounted) return (
    <div className="flex h-screen items-center justify-center bg-slate-100 flex-col gap-4">
      <Activity className="h-12 w-12 text-cyan-500 animate-spin" />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Sincronizando Universo Real (&gt;10,900 registros)...</p>
    </div>
  );

  const currentDetailedDiscipline = selectedDiscipline !== 'all' ? stats?.paretoDiscs.find(d => d.name === selectedDiscipline) : null;

  return (
    <div className="flex min-h-screen w-full bg-[#F8FAFC]">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between bg-white px-8 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-6">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter font-headline flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(0,216,255,0.8)]" />
                Operational Control Center
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-cyan-50 text-cyan-700 text-[9px] font-black">UNIVERSO: {totalInDb || 0}</Badge>
              </div>
            </div>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="p-6 border-none shadow-md bg-white rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase">Impacto Total Auditado</p>
              <h3 className="text-3xl font-black text-slate-900 font-headline">{formatCurrency(stats?.totalImpact || 0)}</h3>
            </Card>
            <Card onClick={() => router.push('/analysis')} className="p-6 border-none shadow-md bg-white rounded-2xl cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-orange-500 group relative">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="h-4 w-4 text-orange-500" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Concentración Pareto</p>
              <h3 className="text-3xl font-black text-slate-900 font-headline">{(stats?.concentrationRatio || 0).toFixed(1)}%</h3>
              <p className="text-[8px] font-bold text-orange-500 mt-1">Click para ver detalles</p>
            </Card>
            <Card onClick={() => router.push('/analysis')} className="p-6 border-none shadow-md bg-white rounded-2xl cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-rose-500 group relative">
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><ArrowRight className="h-4 w-4 text-rose-500" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase">Desviaciones (OC/OT)</p>
              <h3 className="text-3xl font-black text-slate-900 font-headline">{(totalInDb || 0).toLocaleString()}</h3>
              <p className="text-[8px] font-bold text-rose-500 mt-1">Fallas en Planeación / Ejecución</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="border-none shadow-md bg-white rounded-3xl p-8 flex flex-col min-h-[600px]">
              <div className="flex flex-col gap-4 border-b pb-6 mb-8">
                <div className="flex justify-between items-center">
                  <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3"><Focus className="h-5 w-5 text-cyan-500" /> Vital Few & Sub-Drivers</h4>
                  <Badge className="bg-orange-50 text-orange-600 text-[9px] font-black">80/20 TRACE</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDiscipline !== 'all' && <Button variant="ghost" size="sm" onClick={() => setSelectedDiscipline('all')}><ChevronLeft className="h-4 w-4" /></Button>}
                  <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
                    <SelectTrigger className="h-8 flex-1 text-[10px] font-black uppercase rounded-lg">
                      <SelectValue placeholder="Disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">TODAS LAS DISCIPLINAS</SelectItem>
                      {stats?.paretoDiscs.map(d => <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex-1 space-y-8 overflow-y-auto pr-2">
                {selectedDiscipline === 'all' ? (
                  stats?.paretoDiscs.map((d, i) => (
                    <div key={i} className="group cursor-pointer" onClick={() => setSelectedDiscipline(d.name)}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="space-y-1">
                          <p className="text-xs font-black text-slate-800 uppercase group-hover:text-primary transition-colors">{d.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">Driver: <span className="text-slate-600">{d.topSubName}</span></p>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-black text-orange-600">{formatCurrency(d.impact)}</span>
                          <p className="text-[8px] font-bold text-slate-300">{Math.round(d.cumulativePct)}% Acum.</p>
                        </div>
                      </div>
                      <Progress value={(d.impact / stats.totalImpact) * 100 * 2} className="h-1.5" />
                    </div>
                  ))
                ) : (
                  <div className="space-y-6">
                    <div className="bg-slate-900 p-4 rounded-2xl text-white">
                      <p className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">{currentDetailedDiscipline?.name}</p>
                      <h5 className="text-lg font-black">{formatCurrency(currentDetailedDiscipline?.impact || 0)}</h5>
                    </div>
                    {currentDetailedDiscipline?.subs.map((s, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <p className="text-[10px] font-bold text-slate-700 uppercase">{s.name}</p>
                          <span className="text-[11px] font-black text-slate-900">{formatCurrency(s.impact)}</span>
                        </div>
                        <Progress value={(s.impact / currentDetailedDiscipline.impact) * 100} className="h-1" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="lg:col-span-2 border-none shadow-md bg-white rounded-3xl p-8 h-full">
              <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-widest border-b pb-6 mb-8">Operational Impact Monitor</h4>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.trendData}>
                    <defs>
                      <linearGradient id="colorImpact" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CYAN_PRIMARY} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={CYAN_PRIMARY} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="day" axisLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis axisLine={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', backgroundColor: '#0F172A', color: '#fff' }} />
                    <Area type="monotone" dataKey="impact" stroke={CYAN_PRIMARY} strokeWidth={4} fill="url(#colorImpact)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
