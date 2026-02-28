
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  RefreshCcw, 
  Target, 
  CheckCircle2, 
  TrendingUp,
  Focus,
  Zap,
  DollarSign,
  ArrowUpRight,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Line,
  Cell
} from 'recharts';
import { useFirestore, useMemoFirebase, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, orderBy, query } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const CORE_COLOR = '#2962FF'; 
const ACCENT_COLOR = '#FF8F00'; 

export default function VpDashboard() {
  const db = useFirestore();
  const { isAuthReady } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  const taxonomyQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_disciplines'), orderBy('impact', 'desc')) : null, [db]);
  const { data: taxonomyDocs, isLoading: isTaxLoading } = useCollection(taxonomyQuery);

  const paretoData = useMemo(() => {
    if (!taxonomyDocs) return [];
    const totalImpact = globalAgg?.totalImpact || 1;
    let cumulative = 0;
    
    return taxonomyDocs.map(d => {
      cumulative += d.impact;
      return {
        name: d.id,
        impact: d.impact,
        cumulativePercentage: (cumulative / totalImpact) * 100
      };
    });
  }, [taxonomyDocs, globalAgg]);

  const vitalFew = useMemo(() => paretoData.filter(p => p.cumulativePercentage <= 85), [paretoData]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  if (isTaxLoading || !isAuthReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <RefreshCcw className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between border-b bg-white px-8 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-6">
            <SidebarTrigger />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter font-headline">Executive Dashboard VP</h1>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Walmart International • Universe: {(globalAgg?.totalOrders || 0).toLocaleString()} Records</p>
            </div>
          </div>
          <Badge variant="outline" className="h-8 bg-emerald-50 text-emerald-700 border-emerald-100 gap-2 px-3 uppercase font-black text-[9px]">
            <CheckCircle2 className="h-3.5 w-3.5" /> Integridad IA: {globalAgg?.totalProcessed || 0}
          </Badge>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary p-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Materializado</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{formatCurrency(globalAgg?.totalImpact || 0)}</h2>
            </Card>
            <Card className="border-none shadow-md bg-slate-900 text-white border-l-4 border-l-accent p-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Concentración 80/20</p>
              <h2 className="text-3xl font-black text-white tracking-tighter">85%</h2>
              <Progress value={85} className="h-1 mt-2 bg-white/10" />
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-blue-600 p-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Análisis Forense</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{(globalAgg?.totalProcessed || 0).toLocaleString()}</h2>
            </Card>
            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 p-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vital Few (Core)</p>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{vitalFew.length}</h2>
            </Card>
          </div>

          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-3xl">
            <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-6 px-8">
              <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2"><Focus className="h-5 w-5" /> Curva de Concentración de Impacto (Pareto)</CardTitle>
              <Badge className="bg-primary text-white border-none text-[9px] font-black px-4 py-1.5 shadow-lg shadow-primary/20">ESTRATEGIA 80/20</Badge>
            </CardHeader>
            <CardContent className="h-[450px] pt-12 px-8">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} height={80} interval={0} angle={-35} textAnchor="end" />
                  <YAxis yAxisId="left" tickFormatter={(v) => `$${Math.round(v/1000000)}M`} tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: ACCENT_COLOR }} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="impact" radius={[8, 8, 0, 0]} barSize={40} name="Impacto">
                    {paretoData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.cumulativePercentage <= 85 ? CORE_COLOR : '#E2E8F0'} />)}
                  </Bar>
                  <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" stroke={ACCENT_COLOR} strokeWidth={4} dot={{ r: 6, fill: ACCENT_COLOR }} name="% Acumulado" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
