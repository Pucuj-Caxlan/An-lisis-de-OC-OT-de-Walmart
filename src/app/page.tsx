
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  TrendingUp, 
  BrainCircuit, 
  Database, 
  RefreshCcw, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Users,
  Target,
  ListOrdered,
  Layers,
  Search,
  X,
  ArrowRight,
  Activity,
  AlertTriangle,
  Zap,
  ShieldAlert,
  Lightbulb,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Flag
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
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, setDoc, getDoc } from 'firebase/firestore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateRootCauseIntelligence, RootCauseIntelligenceOutput } from '@/ai/flows/root-cause-intelligence-flow';
import { useToast } from '@/hooks/use-toast';

const YEARS = [2022, 2023, 2024, 2025, 2026];
const COLORS = ['#2962FF', '#FF8F00', '#00C853', '#D50000', '#6200EA', '#00B8D4', '#FFD600', '#AA00FF', '#37474F', '#9E9E9E'];

export default function VpDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear);
  const [mounted, setMounted] = useState(false);
  const [drilldownConcept, setDrilldownConcept] = useState<string | null>(null);
  const [isGeneratingIntelligence, setIsGeneratingIntelligence] = useState(false);
  const [activeIntelligence, setActiveIntelligence] = useState<RootCauseIntelligenceOutput | null>(null);
  
  const [filters, setFilters] = useState({
    type: 'all',
    format: 'all',
    planType: 'all',
    coordinator: 'all',
    projectName: '',
    discipline: 'all',
    priority: 'all'
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'));
  }, [db]);

  const { data: rawOrders, isLoading } = useCollection(ordersQuery);

  const getOrderYear = (o: any): number | null => {
    const dateStr = o.fechaSolicitud || o.requestDate || o.processedAt;
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getFullYear())) return date.getFullYear();
      return null;
    } catch { return null; }
  };

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN', 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(val);
  };

  const filteredData = useMemo(() => {
    if (!rawOrders) return [];
    return rawOrders.filter(o => {
      const orderYear = getOrderYear(o);
      const yearMatch = selectedYear === 'all' || orderYear === selectedYear;
      const priorityMatch = filters.priority === 'all' || o.semanticAnalysis?.priorityCategory === filters.priority;
      const disciplineMatch = filters.discipline === 'all' || o.semanticAnalysis?.especialidadImpactada === filters.discipline;
      const searchStr = filters.projectName.toLowerCase();
      const oPid = String(o.projectId || "").toLowerCase();
      const oPName = String(o.projectName || "").toLowerCase();
      const searchMatch = !searchStr || oPid.includes(searchStr) || oPName.includes(searchStr);
      
      return yearMatch && priorityMatch && disciplineMatch && searchMatch;
    });
  }, [rawOrders, selectedYear, filters]);

  const metrics = useMemo(() => {
    const impactValues = filteredData.map(o => o.impactoNeto || 0);
    const totalImpact = impactValues.reduce((acc, curr) => acc + curr, 0);
    const count = filteredData.length;
    const p0Count = filteredData.filter(o => o.semanticAnalysis?.priorityCategory === 'P0').length;

    const causes = filteredData.reduce((acc: any, curr) => {
      const cause = curr.semanticAnalysis?.causaRaizReal || curr.causaRaiz || 'No definida';
      const impact = curr.impactoNeto || 0;
      if (!acc[cause]) acc[cause] = { name: cause, count: 0, impact: 0 };
      acc[cause].count += 1;
      acc[cause].impact += impact;
      return acc;
    }, {});
    
    const sortedCauses = Object.values(causes).sort((a: any, b: any) => b.impact - a.impact);
    let cumulativeSum = 0;
    const paretoData = sortedCauses.map((c: any) => {
      cumulativeSum += c.impact;
      return {
        ...c,
        cumulativeImpact: cumulativeSum,
        cumulativePercentage: totalImpact > 0 ? (cumulativeSum / totalImpact) * 100 : 0
      };
    });

    return { totalImpact, count, p0Count, paretoData };
  }, [filteredData]);

  return (
    <div className="flex min-h-screen w-full bg-slate-50/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">VP Construction Analytics</h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="flex bg-slate-100 p-1 rounded-xl border gap-1">
              <button onClick={() => setSelectedYear('all')} className={`px-3 py-1 rounded-lg text-xs font-bold ${selectedYear === 'all' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>TODO</button>
              {YEARS.map(y => (
                <button key={y} onClick={() => setSelectedYear(y)} className={`px-3 py-1 rounded-lg text-xs font-bold ${selectedYear === y ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-white'}`}>{y}</button>
              ))}
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary overflow-hidden">
              <CardContent className="pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Auditado</p>
                <h2 className="text-2xl font-headline font-bold text-slate-800">{formatCurrency(metrics.totalImpact)}</h2>
                <Badge variant="outline" className="mt-2 text-[9px] bg-primary/5 text-primary border-primary/20">{metrics.count} Órdenes</Badge>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-white border-l-4 border-l-rose-500">
              <CardContent className="pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Foco de Atención (P0)</p>
                <h2 className="text-2xl font-headline font-bold text-rose-600">{metrics.p0Count} CRÍTICOS</h2>
                <p className="text-[9px] text-slate-500 mt-2 font-medium">Inmediata intervención requerida</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-slate-800 text-white md:col-span-2">
              <CardContent className="pt-6 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estrategia 80/20 (Economía de Enfoque)</p>
                  <p className="text-xs text-slate-400">Priorizando las causas P0/P1 se controla el 80% del impacto.</p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-white/10 p-2 rounded-lg text-center min-w-[100px] border border-white/5">
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Impacto P0</p>
                    <p className="text-sm font-black text-rose-400">{formatCurrency(filteredData.filter(o => o.semanticAnalysis?.priorityCategory === 'P0').reduce((a,c)=>a+(c.impactoNeto||0),0))}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filtros Ejecutivos
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Flag className="h-3 w-3" /> Prioridad</label>
                <Select value={filters.priority} onValueChange={(v) => setFilters(f => ({...f, priority: v}))}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-xs font-medium"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="P0">P0 - Crítico</SelectItem>
                    <SelectItem value="P1">P1 - Alto</SelectItem>
                    <SelectItem value="P2">P2 - Medio</SelectItem>
                    <SelectItem value="P3">P3 - Bajo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><BrainCircuit className="h-3 w-3" /> Disciplina</label>
                <Select value={filters.discipline} onValueChange={(v) => setFilters(f => ({...f, discipline: v}))}>
                  <SelectTrigger className="h-9 bg-slate-50 border-none text-xs font-medium"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="Eléctrico">Eléctrico</SelectItem>
                    <SelectItem value="Civil">Civil</SelectItem>
                    <SelectItem value="Estructuras">Estructuras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><Search className="h-3 w-3" /> Buscar PID / Proyecto</label>
                <Input 
                  placeholder="Buscar..." 
                  className="h-9 bg-slate-50 border-none text-xs font-medium"
                  value={filters.projectName}
                  onChange={(e) => setFilters(f => ({...f, projectName: e.target.value}))}
                />
              </div>
            </div>
          </Card>

          <Tabs defaultValue="pareto" className="w-full">
            <TabsList className="bg-slate-100 p-1 mb-6 rounded-xl border">
              <TabsTrigger value="pareto" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Activity className="h-4 w-4" /> Pareto 80/20 Impacto
              </TabsTrigger>
              <TabsTrigger value="prioritization" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <ShieldCheck className="h-4 w-4" /> Priorización Estratégica
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pareto">
               <Card className="border-none shadow-md bg-white">
                  <CardHeader className="border-b bg-slate-50/50">
                    <CardTitle className="text-sm font-black uppercase text-primary tracking-widest flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" /> Curva de Pareto: Causa Raíz vs Impacto Acumulado
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[450px] pt-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={metrics.paretoData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} height={70} />
                        <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${Math.round(v/1000000)}M`} />
                        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 9 }} />
                        <Tooltip />
                        <Bar yAxisId="left" dataKey="impact" fill="#2962FF" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" stroke="#FF8F00" strokeWidth={3} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="prioritization">
               <div className="grid gap-4">
                  {filteredData.sort((a,b) => (b.semanticAnalysis?.priorityScore || 0) - (a.semanticAnalysis?.priorityScore || 0)).slice(0, 10).map((order, i) => (
                    <Card key={i} className={`border-none shadow-sm bg-white overflow-hidden border-l-4 ${order.semanticAnalysis?.priorityCategory === 'P0' ? 'border-l-rose-500' : 'border-l-amber-500'}`}>
                       <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex gap-4 items-center">
                             <div className="text-center bg-slate-50 p-2 rounded-lg border min-w-[60px]">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Score</p>
                                <p className="text-lg font-black text-slate-800">{order.semanticAnalysis?.priorityScore || 0}</p>
                             </div>
                             <div>
                                <h4 className="font-bold text-slate-800">{order.projectName} ({order.projectId})</h4>
                                <p className="text-xs text-slate-500 italic max-w-md truncate">{order.semanticAnalysis?.prioritizationReasoning || order.standardizedDescription}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-4">
                             <Badge className={order.semanticAnalysis?.priorityCategory === 'P0' ? 'bg-rose-600' : 'bg-amber-500'}>
                                {order.semanticAnalysis?.priorityCategory}
                             </Badge>
                             <div className="text-right">
                                <p className="text-xs font-black text-slate-800">{formatCurrency(order.impactoNeto || 0)}</p>
                                <p className="text-[10px] text-slate-400 uppercase">{order.semanticAnalysis?.tipoError}</p>
                             </div>
                          </div>
                       </CardContent>
                    </Card>
                  ))}
               </div>
            </TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </div>
  );
}
