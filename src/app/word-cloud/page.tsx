
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BrainCircuit, 
  RefreshCcw, 
  Sparkles,
  Database,
  Activity,
  Target
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { analyzeWordCloud, WordCloudOutput } from '@/ai/flows/word-cloud-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

export default function WordCloudPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cloudData, setCloudData] = useState<WordCloudOutput | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  const taxonomyQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_causes'), orderBy('impact', 'desc')) : null, [db]);
  const { data: taxonomyDocs } = useCollection(taxonomyQuery);

  const localCloudWeights = useMemo(() => {
    if (!taxonomyDocs) return [];
    const maxImpact = Math.max(...taxonomyDocs.map(d => d.impact), 1);
    return taxonomyDocs.map(d => ({
      text: d.id,
      weight: Math.max(10, (d.impact / maxImpact) * 70 + 10),
      impact: d.impact,
      frequency: d.count,
      sentiment: d.impact > (maxImpact * 0.5) ? 'Crítico' : 'Estable'
    })).slice(0, 50);
  }, [taxonomyDocs]);

  const runIAAnalysis = async () => {
    if (!localCloudWeights.length) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeWordCloud({ 
        groups: localCloudWeights.map(w => ({ disciplina: w.text, causa: w.text, impactoTotal: w.impact, frecuencia: w.frequency })),
        totalImpact: globalAgg?.totalImpact || 0,
        totalOrders: globalAgg?.totalOrders || 0
      });
      setCloudData(result);
      toast({ title: "Diagnóstico IA Generado" });
    } catch (e: any) { toast({ variant: "destructive", title: "Fallo IA", description: e.message }); } finally { setIsAnalyzing(false); }
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
            <div className="flex items-center gap-2"><BrainCircuit className="h-6 w-6 text-primary" /><h1 className="text-xl font-headline font-bold text-slate-800 uppercase">Nube Forense 80/20</h1></div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-2 px-3 py-1 uppercase font-black"><Database className="h-3 w-3" /> Universo: {globalAgg?.totalOrders || 0}</Badge>
            <Button onClick={runIAAnalysis} disabled={isAnalyzing || !localCloudWeights.length} className="bg-primary hover:bg-primary/90 gap-2 rounded-xl shadow-lg h-10 px-6">
              {isAnalyzing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Refinar con Gemini
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-none shadow-xl bg-white rounded-3xl min-h-[500px] flex flex-wrap items-center justify-center gap-4 p-10">
              {localCloudWeights.length === 0 ? <p className="text-xs font-bold text-slate-400 uppercase">Cargando Taxonomía...</p> : localCloudWeights.map((word, i) => (
                <button key={i} className="transition-all hover:scale-110 relative group" style={{ fontSize: `${word.weight}px`, color: word.sentiment === 'Crítico' ? '#E11D48' : '#64748B', fontWeight: '900' }}>
                  {word.text}
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 z-50 shadow-xl pointer-events-none">{formatCurrency(word.impact)}</span>
                </button>
              ))}
            </Card>
            <div className="space-y-6">
              <Card className="border-none shadow-md bg-white rounded-3xl overflow-hidden p-6 space-y-4">
                <h4 className="text-sm font-black uppercase text-primary flex items-center gap-2"><Activity className="h-4 w-4" /> Diagnóstico Ejecutivo</h4>
                {cloudData ? (
                  <>
                    <p className="text-sm font-bold text-slate-800">{cloudData.coreProblem}</p>
                    <Separator />
                    <p className="text-xs text-slate-600 italic">"{cloudData.executiveDiagnosis}"</p>
                    <div className="pt-4"><div className="flex justify-between mb-1"><span className="text-2xl font-black text-primary">{cloudData.concentrationPercentage}%</span></div><Progress value={cloudData.concentrationPercentage} className="h-1.5" /></div>
                  </>
                ) : <p className="text-[10px] font-bold text-slate-400 uppercase text-center py-10">Inicie el refinamiento IA.</p>}
              </Card>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
