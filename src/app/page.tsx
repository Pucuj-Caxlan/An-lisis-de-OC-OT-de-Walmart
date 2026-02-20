
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
  
  const [filters, setFilters] = useState({
    format: 'all',
    projectName: '',
    discipline: 'all'
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
      const disciplineMatch = filters.discipline === 'all' || o.semanticAnalysis?.especialidadImpactada === filters.discipline;
      const searchStr = filters.projectName.toLowerCase();
      const oPid = String(o.projectId || "").toLowerCase();
      const oPName = String(o.projectName || "").toLowerCase();
      const searchMatch = !searchStr || oPid.includes(searchStr) || oPName.includes(searchStr);
      
      return yearMatch && disciplineMatch && searchMatch;
    });
  }, [rawOrders, selectedYear, filters]);

  const metrics = useMemo(() => {
    const impactValues = filteredData.map(o => o.impactoNeto || 0);
    const totalImpact = impactValues.reduce((acc, curr) => acc + curr, 0);
    const count = filteredData.length;

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

    return { totalImpact, count, paretoData };
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-md bg-white border-l-4 border-l-primary overflow-hidden">
              <CardContent className="pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Auditado</p>
                <h2 className="text-2xl font-headline font-bold text-slate-800">{formatCurrency(metrics.totalImpact)}</h2>
                <Badge variant="outline" className="mt-2 text-[9px] bg-primary/5 text-primary border-primary/20">{metrics.count} Órdenes</Badge>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md bg-slate-800 text-white">
              <CardContent className="pt-6 flex justify-between items-center">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estrategia 80/20</p>
                  <p className="text-xs text-slate-400">Identificación de causas raíz críticas por impacto económico.</p>
                </div>
                <div className="bg-white/10 p-2 rounded-lg text-center min-w-[100px] border border-white/5">
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Impacto Pareto</p>
                  <p className="text-sm font-black text-emerald-400">80% Control</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-none shadow-sm bg-white p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        </main>
      </SidebarInset>
    </div>
  );
}
