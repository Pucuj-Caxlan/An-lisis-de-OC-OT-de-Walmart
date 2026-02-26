
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
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, limit, orderBy, doc, setDoc, getCountFromServer } from 'firebase/firestore';
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
  const [mounted, setMounted] = useState(false);
  const [totalInDb, setTotalInDb] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Leer Agregados Globales (SSOT para ver los 11,150)
  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg, isLoading: isAggLoading } = useDoc(aggRef);

  useEffect(() => {
    if (globalAgg) {
      setTotalInDb(globalAgg.totalOrders);
    }
  }, [globalAgg]);

  // Transformar agregados en nube de palabras local
  const localCloudWeights = useMemo(() => {
    if (!globalAgg?.rootCauses) return [];
    
    const causes = Object.entries(globalAgg.rootCauses) as [string, any][];
    let maxImpact = 0;
    let maxCount = 0;

    causes.forEach(([_, stats]) => {
      if (stats.impact > maxImpact) maxImpact = stats.impact;
      if (stats.count > maxCount) maxCount = stats.count;
    });

    return causes.map(([name, stats]) => {
      const impactNorm = maxImpact > 0 ? stats.impact / maxImpact : 0;
      const countNorm = maxCount > 0 ? stats.count / maxCount : 0;
      const weight = (impactNorm * 70) + (countNorm * 30);

      return {
        text: name,
        weight: Math.max(10, weight),
        impact: stats.impact,
        frequency: stats.count,
        sentiment: stats.impact > (maxImpact * 0.5) ? 'Crítico' : stats.impact > (maxImpact * 0.2) ? 'Riesgo' : 'Estable',
        category: 'Causa Raíz',
        trend: 'DB Analytics'
      } as WordConcept;
    }).sort((a, b) => b.impact - a.impact);
  }, [globalAgg]);

  const runIAAnalysis = async () => {
    if (!localCloudWeights.length) return;
    setIsAnalyzing(true);
    try {
      const topGroupsForIA = localCloudWeights.slice(0, 20).map(w => ({
        disciplina: w.text,
        causa: w.text,
        impactoTotal: w.impact,
        frecuencia: w.frequency
      }));

      const result = await analyzeWordCloud({ 
        groups: topGroupsForIA,
        totalImpact: globalAgg?.totalImpact || 0,
        totalOrders: globalAgg?.totalOrders || 0
      });

      setCloudData(result);
      toast({ title: "Diagnóstico IA Generado" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fallo IA", description: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (val: number) => {
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
              <BrainCircuit className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Inteligencia Semántica 80/20</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-2 px-3 py-1 uppercase font-black">
              <Database className="h-3 w-3" /> Universo: {totalInDb || '—'}
            </Badge>
            <Button onClick={runIAAnalysis} disabled={isAnalyzing || !localCloudWeights.length} className="bg-primary hover:bg-primary/90 gap-2 rounded-xl shadow-lg h-10 px-6">
              {isAnalyzing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Refinar con Gemini
            </Button>
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-8">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-none shadow-xl bg-white rounded-3xl overflow-hidden min-h-[500px] flex flex-col">
              <CardHeader className="bg-slate-50/50 border-b py-4 px-8">
                <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-widest">Nube de Impacto Financiero</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-10 flex flex-wrap items-center justify-center gap-4">
                {localCloudWeights.length === 0 ? (
                  <div className="text-center space-y-4">
                    <Database className="h-12 w-12 text-slate-200 mx-auto" />
                    <p className="text-xs font-bold text-slate-400 uppercase">Esperando agregados del universo...</p>
                  </div>
                ) : (
                  localCloudWeights.map((word, i) => (
                    <button
                      key={i}
                      className="transition-all hover:scale-110 active:scale-95 group relative"
                      style={{ 
                        fontSize: `${word.weight * 0.8 + 10}px`,
                        color: word.sentiment === 'Crítico' ? '#E11D48' : word.sentiment === 'Riesgo' ? '#F59E0B' : '#64748B',
                        fontWeight: word.weight > 50 ? '900' : '600',
                        opacity: word.weight / 100 + 0.4
                      }}
                    >
                      {word.text}
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-xl pointer-events-none">
                        {formatCurrency(word.impact)} • {word.frequency} registros
                      </span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-primary text-white">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Diagnóstico Ejecutivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {cloudData ? (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Problema Núcleo</p>
                        <p className="text-sm font-bold text-slate-800">{cloudData.coreProblem}</p>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Análisis 80/20</p>
                        <p className="text-xs text-slate-600 leading-relaxed italic">"{cloudData.executiveDiagnosis}"</p>
                      </div>
                      <div className="pt-4 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Concentración de Impacto</p>
                        <div className="flex items-end justify-between mb-1">
                          <span className="text-2xl font-black text-primary">{cloudData.concentrationPercentage}%</span>
                          <span className="text-[10px] font-bold text-slate-400">del presupuesto</span>
                        </div>
                        <Progress value={cloudData.concentrationPercentage} className="h-1.5" />
                      </div>
                    </>
                  ) : (
                    <div className="py-10 text-center space-y-4">
                      <Zap className="h-10 w-10 text-slate-100 mx-auto" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase px-6">Inicie el refinamiento IA para obtener el diagnóstico 80/20.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-none shadow-md bg-slate-900 text-white rounded-3xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Target className="h-4 w-4 text-accent" /> Acciones Estratégicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-8">
                  <div className="space-y-3">
                    {(cloudData?.strategicRecommendations || [
                      "Analizar las disciplinas con mayor frecuencia en la nube.",
                      "Verificar la integridad de los datos en registros críticos.",
                      "Exportar el reporte de Pareto para revisión de VP."
                    ]).map((rec, i) => (
                      <div key={i} className="flex gap-3 items-start group">
                        <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-accent group-hover:text-slate-900 transition-colors">
                          <span className="text-[10px] font-black">{i+1}</span>
                        </div>
                        <p className="text-xs text-slate-300 group-hover:text-white transition-colors">{rec}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
