
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BrainCircuit, 
  RefreshCcw, 
  Target, 
  Zap, 
  TrendingUp, 
  Activity, 
  AlertTriangle, 
  ShieldCheck,
  LayoutGrid,
  Filter,
  Search,
  ArrowRight,
  Info,
  Layers,
  SearchCode,
  Database,
  CheckCircle2,
  Clock,
  ChevronDown,
  Calendar,
  X,
  History,
  Sparkles
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, limit, orderBy, doc, setDoc, getDoc, getCountFromServer } from 'firebase/firestore';
import { analyzeWordCloud, WordCloudOutput } from '@/ai/flows/word-cloud-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';

type WordConcept = {
  text: string;
  weight: number;
  impact: number;
  frequency: number;
  sentiment: 'Crítico' | 'Riesgo' | 'Estable';
  category: 'Disciplina' | 'Causa Raíz' | 'Concepto Técnico';
  trend: string;
};

export default function WordCloudPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cloudData, setCloudData] = useState<WordCloudOutput | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);

  const [filters, setFilters] = useState({
    year: 'TODO',
    month: 'all',
    discipline: 'all',
    format: 'all',
    status: 'all',
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
    if (!db || !user?.uid) return null;
    // Ajustado a 10,000 (Límite máximo de Structured Query)
    return query(collection(db, 'orders'), orderBy('impactoNeto', 'desc'), limit(10000));
  }, [db, user?.uid]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const snapshotId = useMemo(() => {
    const filterKey = JSON.stringify(filters).replace(/[^a-zA-Z0-9]/g, '_');
    return `cloud_snapshot_${filterKey}`;
  }, [filters]);

  useEffect(() => {
    const loadSnapshot = async () => {
      if (!db || !user?.uid || !snapshotId) return;
      try {
        const snap = await getDoc(doc(db, 'word_cloud_snapshots', snapshotId));
        if (snap.exists()) {
          setCloudData(snap.data() as WordCloudOutput);
        } else {
          setCloudData(null);
        }
      } catch (e) {
        console.error("Error loading snapshot:", e);
      }
    };
    loadSnapshot();
  }, [db, user?.uid, snapshotId]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => {
      const dateStr = o.fechaSolicitud || o.requestDate || "";
      const yearMatch = filters.year === 'TODO' || dateStr.includes(filters.year);
      const monthMatch = filters.month === 'all' || new Date(dateStr).getMonth() === parseInt(filters.month);
      const discMatch = filters.discipline === 'all' || o.disciplina_normalizada === filters.discipline;
      const formatMatch = filters.format === 'all' || o.format === filters.format || o.type === filters.format;
      const statusMatch = filters.status === 'all' || o.classification_status === filters.status;
      const searchMatch = !filters.search || 
        String(o.projectId).toLowerCase().includes(filters.search.toLowerCase()) || 
        String(o.projectName).toLowerCase().includes(filters.search.toLowerCase());
      
      return yearMatch && monthMatch && discMatch && formatMatch && statusMatch && searchMatch;
    });
  }, [orders, filters]);

  const localCloudWeights = useMemo(() => {
    const groups: Record<string, { impact: number; count: number; disc: string; causa: string }> = {};
    let maxImpact = 0;
    let maxCount = 0;

    filteredOrders.forEach(o => {
      const disc = o.disciplina_normalizada || 'Indefinida';
      const causa = o.causa_raiz_normalizada || o.causaRaiz || 'Sin definir';
      const key = `${disc}|${causa}`;
      
      if (!groups[key]) groups[key] = { impact: 0, count: 0, disc, causa };
      groups[key].impact += (o.impactoNeto || 0);
      groups[key].count += 1;
      
      if (groups[key].impact > maxImpact) maxImpact = groups[key].impact;
      if (groups[key].count > maxCount) maxCount = groups[key].count;
    });

    return Object.values(groups).map(g => {
      const impactNorm = maxImpact > 0 ? g.impact / maxImpact : 0;
      const countNorm = maxCount > 0 ? g.count / maxCount : 0;
      const weight = (impactNorm * 70) + (countNorm * 30);

      return {
        text: g.causa === 'Sin definir' ? g.disc : g.causa,
        weight: Math.max(10, weight),
        impact: g.impact,
        frequency: g.count,
        sentiment: g.impact > (maxImpact * 0.5) ? 'Crítico' : g.impact > (maxImpact * 0.2) ? 'Riesgo' : 'Estable',
        category: 'Causa Raíz',
        trend: 'DB Analytics'
      } as WordConcept;
    }).sort((a, b) => b.impact - a.impact);
  }, [filteredOrders]);

  const runAnalysis = async (forceIA = false) => {
    if (filteredOrders.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "Cargue registros primero." });
      return;
    }

    const totalImpact = filteredOrders.reduce((a, b) => a + (b.impactoNeto || 0), 0);
    const top5Impact = localCloudWeights.slice(0, 5).reduce((a, b) => a + b.impact, 0);
    const concentration = totalImpact > 0 ? Math.round((top5Impact / totalImpact) * 100) : 0;

    if (!forceIA) {
      setCloudData({
        concepts: localCloudWeights,
        executiveDiagnosis: "Análisis generado instantáneamente desde la base estructurada. Presione 'Refinar con IA' para un diagnóstico estratégico profundo.",
        coreProblem: localCloudWeights[0]?.text || "Indefinido",
        concentrationPercentage: concentration,
        strategicRecommendations: ["Validar registros pendientes de clasificación para mejorar precisión."]
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const topGroupsForIA = localCloudWeights.slice(0, 30).map(w => ({
        disciplina: w.text,
        causa: w.text,
        impactoTotal: w.impact,
        frecuencia: w.frequency
      }));

      const result = await analyzeWordCloud({ 
        groups: topGroupsForIA,
        totalImpact,
        totalOrders: filteredOrders.length
      });

      const finalData: WordCloudOutput = {
        ...result,
        concepts: localCloudWeights,
        concentrationPercentage: result.concentrationPercentage || concentration
      };

      setCloudData(finalData);

      if (db) {
        await setDoc(doc(db, 'word_cloud_snapshots', snapshotId), {
          ...finalData,
          id: snapshotId,
          generatedAt: new Date().toISOString(),
          filters,
          stats: {
            sampleSize: filteredOrders.length,
            totalImpact
          }
        });
      }

      toast({ title: "Análisis Estratégico Completo" });
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Error de Conexión", 
        description: "Fallo al procesar inteligencia semántica." 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN', 
      maximumFractionDigits: 0 
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
              <BrainCircuit className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Inteligencia Semántica 80/20</h1>
            </div>
          </div>
        </header>
      </SidebarInset>
    </div>
  );
}
