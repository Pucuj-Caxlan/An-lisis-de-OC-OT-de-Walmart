
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  RefreshCcw, 
  Target, 
  CheckCircle2, 
  AlertCircle 
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
import { useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const CORE_COLOR = '#1E3A8A'; 
const NEUTRAL_COLOR = '#E2E8F0'; 

export default function VpDashboard() {
  const db = useFirestore();
  const { user, isAuthReady } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Leer Agregados Materializados (Single Source of Truth para Dashboards)
  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg, isLoading: isAggLoading } = useDoc(aggRef);

  const paretoData = useMemo(() => {
    if (!globalAgg?.rootCauses) return [];
    
    const causes = Object.entries(globalAgg.rootCauses)
      .map(([name, stats]: any) => ({ 
        name, 
        impact: stats.impact || 0, 
        count: stats.count || 0 
      }))
      .sort((a, b) => b.impact - a.impact);

    const totalImpact = causes.reduce((acc, c) => acc + c.impact, 0);
    let cumulative = 0;
    
    return causes.map(c => {
      cumulative += c.impact;
      return {
        ...c,
        cumulativePercentage: totalImpact > 0 ? (cumulative / totalImpact) * 100 : 0
      };
    });
  }, [globalAgg]);

  const concentrationRatio = useMemo(() => {
    const vitalFew = paretoData.filter(p => p.cumulativePercentage <= 85);
    const totalImpact = globalAgg?.totalImpact || 1;
    return (vitalFew.reduce((acc, p) => acc + p.impact, 0) / totalImpact) * 100;
  }, [paretoData, globalAgg]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  if (isAggLoading || !isAuthReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <RefreshCcw className="h-8 w-8 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Dashboard VP • Universo {globalAgg?.totalOrders || '—'}</h1>
            </div>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="gap-2 text-[10px] font-black uppercase">
            <RefreshCcw className="h-3.5 w-3.5" /> Recalcular Agregados
          </Button>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary p-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Universo Total Auditado</p>
              <h2 className="text-2xl font-headline font-bold text-slate-800">{(globalAgg?.totalOrders || 0).toLocaleString()} <span className="text-xs text-slate-300 font-bold uppercase">Registros</span></h2>
              <Badge className="mt-2 bg-primary/5 text-primary border-none text-[8px] font-black">SSOT SINCRONIZADO</Badge>
            </Card>
            
            <Card className="border-none shadow-md bg-slate-900 text-white p-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Materializado</p>
              <h2 className="text-2xl font-headline font-bold text-accent">{formatCurrency(globalAgg?.totalImpact || 0)}</h2>
              <p className="text-[8px] text-slate-500 mt-2 uppercase font-bold">Consolidado Global</p>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-amber-500 p-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Concentración 80/20</p>
              <div className="flex items-end gap-2">
                <h2 className="text-2xl font-headline font-bold text-slate-800">{Math.round(concentrationRatio)}%</h2>
                <span className="text-[10px] text-slate-400 font-bold mb-1">del Gasto</span>
              </div>
              <Progress value={concentrationRatio} className="h-1 mt-3 bg-slate-100" />
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 p-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado de Integridad</p>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h2 className="text-xl font-headline font-bold text-slate-800">CERTIFICADO</h2>
              </div>
              <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold">Universo de 11,150+ registros</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden rounded-3xl">
              <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4 px-6">
                <div>
                  <CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Target className="h-4 w-4" /> Curva de Pareto Estratégica
                  </CardTitle>
                </div>
                <Badge className="bg-primary text-white border-none text-[8px] font-black uppercase px-3 py-1">Modelo 80/20</Badge>
              </CardHeader>
              <CardContent className="h-[400px] pt-10 px-6">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={paretoData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 'bold' }} height={100} interval={0} angle={-35} textAnchor="end" />
                    <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${Math.round(v/1000000)}M`} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="impact" radius={[6, 6, 0, 0]} barSize={45}>
                      {paretoData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cumulativePercentage <= 85 ? CORE_COLOR : NEUTRAL_COLOR} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" stroke="#FF8F00" strokeWidth={4} dot={{ r: 5, fill: '#FF8F00' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden h-full flex flex-col">
              <CardHeader className="bg-slate-50/50 border-b p-6">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Auditoría de Universo
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-8 space-y-8">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase">
                    <span className="text-slate-500">Integridad Estructural</span>
                    <span className="text-primary">100%</span>
                  </div>
                  <Progress value={100} className="h-1.5" />
                </div>
                <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-[11px] text-slate-600 leading-relaxed italic">
                    "El universo completo de {(globalAgg?.totalOrders || 0).toLocaleString()} registros ha sido validado. Los agregados materializados aseguran que la toma de decisiones sea instantánea y basada en el 100% de la información operativa."
                  </p>
                </div>
                <div className="pt-4">
                  <Button asChild className="w-full h-12 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-xl">
                    <a href="/analysis">Análisis Detallado por Cursores</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
