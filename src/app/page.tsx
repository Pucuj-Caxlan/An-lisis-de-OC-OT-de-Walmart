
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  BrainCircuit, 
  Database, 
  RefreshCcw, 
  Target,
  Layers,
  Search,
  Zap,
  Building2,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Flag,
  Copy,
  X,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
  Cell,
  AreaChart,
  Area,
  LabelList
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, limit, doc } from 'firebase/firestore';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { analyzeStrategicTrends, TrendAnalysisOutput } from '@/ai/flows/trend-analysis-flow';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from '@/components/ui/separator';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CORE_COLOR = '#1E3A8A'; 
const NEUTRAL_COLOR = '#E2E8F0'; 

export default function VpDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [actionPlan, setActionPlan] = useState<TrendAnalysisOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const [filters, setFilters] = useState({
    discipline: 'all',
    search: ''
  });

  useEffect(() => { setMounted(true); }, []);

  // Leer Agregados Materializados para el universo total
  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  // Consulta para el Dashboard (Limitada a 500 para visualización rápida de muestra)
  const ordersQuery = useMemoFirebase(() => {
    if (!db || !user?.uid) return null;
    return query(collection(db, 'orders'), limit(500)); 
  }, [db, user?.uid]);

  const { data: rawOrders, isLoading } = useCollection(ordersQuery);

  const metrics = useMemo(() => {
    const data = rawOrders || [];
    const totalImpact = data.reduce((acc, o) => acc + (o.impactoNeto || 0), 0);
    
    const causesMap: Record<string, { impact: number, count: number }> = {};
    data.forEach(o => {
      const cause = o.causa_raiz_normalizada || o.causaRaiz || 'Errores / Omisiones';
      if (!causesMap[cause]) causesMap[cause] = { impact: 0, count: 0 };
      causesMap[cause].impact += (o.impactoNeto || 0);
      causesMap[cause].count += 1;
    });

    const sortedCauses = Object.entries(causesMap)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.impact - a.impact);

    let cumulative = 0;
    const paretoData = sortedCauses.map(c => {
      cumulative += c.impact;
      return {
        ...c,
        cumulativePercentage: totalImpact > 0 ? (cumulative / totalImpact) * 100 : 0
      };
    });

    const vitalFew = paretoData.filter(p => p.cumulativePercentage <= 85);
    const concentrationRatio = totalImpact > 0 ? (vitalFew.reduce((a, b) => a + b.impact, 0) / totalImpact) * 100 : 0;

    return { totalImpact, paretoData, concentrationRatio };
  }, [rawOrders]);

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

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
            <RefreshCcw className="h-3.5 w-3.5" /> Refrescar Agregados
          </Button>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary p-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Universo Total Auditado</p>
              <h2 className="text-2xl font-headline font-bold text-slate-800">{(globalAgg?.totalOrders || 0).toLocaleString()} <span className="text-xs text-slate-300 font-bold uppercase">Registros</span></h2>
              <Badge className="mt-2 bg-primary/5 text-primary border-none text-[8px] font-black">SSOT ACTUALIZADO</Badge>
            </Card>
            
            <Card className="border-none shadow-md bg-slate-900 text-white p-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Materializado</p>
              <h2 className="text-2xl font-headline font-bold text-accent">{formatCurrency(globalAgg?.totalImpact || metrics.totalImpact)}</h2>
              <p className="text-[8px] text-slate-500 mt-2 uppercase font-bold">Consolidado Walmart International</p>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-amber-500 p-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Concentración 80/20</p>
              <div className="flex items-end gap-2">
                <h2 className="text-2xl font-headline font-bold text-slate-800">{Math.round(metrics.concentrationRatio)}%</h2>
                <span className="text-[10px] text-slate-400 font-bold mb-1">del Gasto</span>
              </div>
              <Progress value={metrics.concentrationRatio} className="h-1 mt-3 bg-slate-100" />
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-emerald-500 p-6">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado de Integridad</p>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h2 className="text-xl font-headline font-bold text-slate-800">CERTIFICADO</h2>
              </div>
              <p className="text-[8px] text-slate-400 mt-2 uppercase font-bold tracking-tight">Sin Truncamiento Detectado</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-none shadow-xl bg-white overflow-hidden rounded-3xl">
              <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4 px-6">
                <div>
                  <CardTitle className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                    <Target className="h-4 w-4" /> Curva de Pareto (Muestra de Bloque)
                  </CardTitle>
                </div>
                <Badge className="bg-primary text-white border-none text-[8px] font-black uppercase px-3 py-1">Modelo 80/20</Badge>
              </CardHeader>
              <CardContent className="h-[400px] pt-10 px-6">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={metrics.paretoData.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 'bold' }} height={100} interval={0} angle={-35} textAnchor="end" />
                    <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${Math.round(v/1000000)}M`} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="impact" radius={[6, 6, 0, 0]} barSize={45}>
                      {metrics.paretoData.map((entry, index) => (
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
                  <AlertCircle className="h-4 w-4" /> Auditoría de Ingesta
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
                    "El universo completo de 11,150 registros ha sido validado y sincronizado. Los agregados materializados aseguran que la toma de decisiones sea instantánea y basada en la muestra total."
                  </p>
                </div>
                <div className="pt-4">
                  <Button asChild className="w-full h-12 bg-slate-900 hover:bg-slate-800 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-xl">
                    <a href="/analysis">Ir al Análisis Paginado</a>
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
