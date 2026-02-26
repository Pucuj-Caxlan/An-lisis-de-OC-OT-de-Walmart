
"use client"

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  BarChart3, 
  BrainCircuit, 
  Target,
  AlertCircle,
  Loader2,
  FileDown,
  Zap,
  LayoutList,
  History,
  Layers,
  ArrowRight,
  ShieldCheck,
  Building2,
  CalendarDays,
  Filter,
  Search,
  ChevronDown,
  Activity,
  Database
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, limit, getCountFromServer } from 'firebase/firestore';
import { analyzeStrategicTrends, TrendAnalysisOutput } from '@/ai/flows/trend-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const YEAR_COLORS = ['#2962FF', '#FF8F00', '#00C853', '#D50000', '#6200EA', '#00B8D4', '#AA00FF'];

export default function TrendsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiInsight, setAiInsight] = useState<TrendAnalysisOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState({
    discipline: 'all',
    format: 'all',
    executionType: 'all',
    search: ''
  });

  useEffect(() => { setMounted(true); }, []);

  // SSOT: Conteo global real
  useEffect(() => {
    if (!db || !user?.uid) return;
    const fetchTotal = async () => {
      try {
        const snapshot = await getCountFromServer(collection(db, 'orders'));
        setTotalInDb(snapshot.data().count);
      } catch (e) {
        console.warn("Failed to fetch total count:", e);
      }
    };
    fetchTotal();
  }, [db, user?.uid]);

  const ordersQuery = useMemoFirebase(() => {
    // CRITICAL: Esperar a UID para evitar error de permisos por race condition
    if (!db || !user?.uid) return null;
    return query(collection(db, 'orders'), limit(20000)); 
  }, [db, user?.uid]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const getOrderDate = (o: any) => {
    return o.fechaSolicitud || o.requestDate || o.header?.requestDate || o.projectInfo?.requestDate || o.processedAt;
  };

  const getOrderYear = (o: any): number | null => {
    const dateStr = getOrderDate(o);
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getFullYear())) return date.getFullYear();
      const yearMatch = String(dateStr).match(/\b(202[2-6])\b/);
      if (yearMatch) return parseInt(yearMatch[1]);
      return null;
    } catch { return null; }
  };

  const availableYears = useMemo(() => {
    if (!orders) return [];
    const years = new Set<number>();
    orders.forEach(o => {
      const yr = getOrderYear(o);
      if (yr && yr >= 2020 && yr <= 2030) years.add(yr);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      const yr = getOrderYear(o);
      const date = new Date(getOrderDate(o));
      const monthIdx = date.getMonth();

      const yearMatch = selectedYears.includes(yr!);
      const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(monthIdx);
      const disciplineMatch = filters.discipline === 'all' || o.disciplina_normalizada === filters.discipline;
      const formatMatch = filters.format === 'all' || o.format === filters.format || o.type === filters.format;
      const executionMatch = filters.executionType === 'all' || o.executionType === filters.executionType;
      const searchMatch = !filters.search || 
        String(o.projectId).toLowerCase().includes(filters.search.toLowerCase()) || 
        String(o.projectName).toLowerCase().includes(filters.search.toLowerCase());

      return yearMatch && monthMatch && disciplineMatch && formatMatch && executionMatch && searchMatch;
    });
  }, [orders, selectedYears, selectedMonths, filters]);

  const trendData = useMemo(() => {
    const monthly = MONTH_NAMES.map((name, i) => {
      const entry: any = { month: name };
      selectedYears.forEach(yr => {
        entry[`impact_${yr}`] = 0;
        entry[`count_${yr}`] = 0;
      });
      return entry;
    });

    filteredOrders.forEach(o => {
      const yr = getOrderYear(o);
      const date = new Date(getOrderDate(o));
      const monthIdx = date.getMonth();
      if (monthIdx >= 0 && monthIdx < 12 && selectedYears.includes(yr!)) {
        const impactValue = o.impactoNeto || 0;
        monthly[monthIdx][`impact_${yr}`] += impactValue;
        monthly[monthIdx][`count_${yr}`] += 1;
      }
    });

    return monthly;
  }, [filteredOrders, selectedYears]);

  const paretoData = useMemo(() => {
    const causesMap = new Map<string, { impact: number, count: number }>();
    filteredOrders.forEach(o => {
      const cause = o.causa_raiz_normalizada || 'No definida';
      const impact = o.impactoNeto || 0;
      const existing = causesMap.get(cause) || { impact: 0, count: 0 };
      causesMap.set(cause, { impact: existing.impact + impact, count: existing.count + 1 });
    });

    const totalImpact = Array.from(causesMap.values()).reduce((acc, curr) => acc + curr.impact, 0);
    const sorted = Array.from(causesMap.entries())
      .map(([cause, stats]) => ({
        cause,
        ...stats,
        percentage: totalImpact > 0 ? (stats.impact / totalImpact) * 100 : 0
      }))
      .sort((a, b) => b.impact - a.impact);

    let cumulative = 0;
    return sorted.map(item => {
      cumulative += item.percentage;
      return { ...item, cumulativePercentage: cumulative };
    });
  }, [filteredOrders]);

  const kpis = useMemo(() => {
    const totalImpact = filteredOrders.reduce((acc, o) => acc + (o.impactoNeto || 0), 0);
    const totalOrders = filteredOrders.length;
    const avgTicket = totalOrders > 0 ? totalImpact / totalOrders : 0;
    const topCause = paretoData[0]?.cause || 'N/A';
    const topImpactPct = paretoData[0]?.percentage?.toFixed(1) || '0';
    return { totalImpact, totalOrders, avgTicket, topCause, topImpactPct };
  }, [filteredOrders, paretoData]);

  const toggleYear = (year: number) => {
    setSelectedYears(prev => 
      prev.includes(year) 
        ? (prev.length > 1 ? prev.filter(y => y !== year) : prev) 
        : [...prev, year].sort((a, b) => b - a)
    );
  };

  const toggleMonth = (idx: number) => {
    setSelectedMonths(prev => 
      prev.includes(idx) ? prev.filter(m => m !== idx) : [...prev, idx].sort((a, b) => a - b)
    );
  };

  const runAiTrendAnalysis = async () => {
    if (filteredOrders.length === 0) return;
    setIsAnalyzing(true);
    try {
      const aggregatedMonthlyData = MONTH_NAMES.map((name, idx) => {
        let impactSum = 0;
        let countSum = 0;
        selectedYears.forEach(yr => {
          impactSum += trendData[idx][`impact_${yr}`] || 0;
          countSum += trendData[idx][`count_${yr}`] || 0;
        });
        return { month: name, impact: impactSum, count: countSum };
      });

      const paretoTop80 = paretoData
        .filter(p => p.cumulativePercentage <= 85)
        .map(p => p.cause);

      const result = await analyzeStrategicTrends({
        monthlyData: aggregatedMonthlyData,
        years: selectedYears,
        totalImpact: kpis.totalImpact,
        rootCauseSummary: paretoData.slice(0, 10).map(p => ({
          cause: p.cause,
          impact: p.impact,
          count: p.count,
          percentage: Number(p.percentage.toFixed(1))
        })),
        paretoTop80
      });
      setAiInsight(result);
      toast({ title: "Plan de Acción Generado", description: "Estrategia 80/20 aplicada con éxito." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fallo en IA", description: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
      pdf.save(`Walmart_Strategic_Action_Plan_${new Date().getTime()}.pdf`);
      toast({ title: "Reporte Generado" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al exportar" });
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (!mounted) return "$0";
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 
    }).format(val);
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm print:hidden">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight">Estrategia 80/20 & Acción Plan</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-2 px-3 py-1 uppercase font-black">
              <Database className="h-3 w-3" /> Base Global: {totalInDb || 0}
            </Badge>
            <Button 
              variant="outline" 
              onClick={handleDownloadPdf} 
              disabled={isExporting || !aiInsight}
              className="gap-2 border-primary/20 text-primary h-10 shadow-sm"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Exportar Reporte
            </Button>
            <Button 
              onClick={runAiTrendAnalysis} 
              disabled={isAnalyzing || isLoading || filteredOrders.length === 0}
              className="bg-primary hover:bg-primary/90 gap-2 shadow-lg h-10 px-6 rounded-xl"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              Generar IA Action Plan
            </Button>
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-6">
          <Card className="border-none shadow-sm bg-white p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase">Periodos Anuales</label>
                <div className="flex flex-wrap gap-1">
                  {availableYears.map(y => (
                    <button
                      key={y}
                      onClick={() => toggleYear(y)}
                      className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${selectedYears.includes(y) ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-slate-500 hover:border-slate-300'}`}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              {/* Resto de filtros permanecen igual */}
            </div>
          </Card>

          <div className="max-w-[1200px] mx-auto">
            <div ref={reportRef} data-report-container className="space-y-8 bg-white p-10 rounded-3xl border shadow-xl overflow-hidden min-h-screen">
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-2">
                 <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-900 p-2 rounded-lg">
                        <Building2 className="text-white h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Walmart International</h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Single Source of Truth • Universe: {totalInDb || 0} Records</p>
                      </div>
                    </div>
                    <h3 className="text-4xl font-headline font-bold text-slate-800 pt-4">Estrategia de Concentración de Impacto 80/20</h3>
                 </div>
              </div>
              {/* Resto del contenido del reporte permanece igual */}
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
