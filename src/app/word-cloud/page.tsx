
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
  Target,
  Zap,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  MousePointer2
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
    const maxFreq = Math.max(...taxonomyDocs.map(d => d.count), 1);
    
    return taxonomyDocs.map(d => {
      const impactRatio = d.impact / maxImpact;
      const freqRatio = d.count / maxFreq;
      // El peso se basa en impacto (60%) y frecuencia (40%)
      const weight = Math.max(12, (impactRatio * 0.6 + freqRatio * 0.4) * 80 + 12);
      
      let sentiment: 'Crítico' | 'Riesgo' | 'Estable' = 'Estable';
      if (impactRatio > 0.6) sentiment = 'Crítico';
      else if (freqRatio > 0.6) sentiment = 'Riesgo';

      return {
        text: d.name || d.id,
        weight,
        impact: d.impact,
        frequency: d.count,
        sentiment
      };
    }).slice(0, 40); // Top 40 para no saturar visualmente
  }, [taxonomyDocs]);

  const runIAAnalysis = async () => {
    if (!localCloudWeights.length) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeWordCloud({ 
        groups: localCloudWeights.map(w => ({ 
          disciplina: w.text, 
          causa: w.text, 
          impactoTotal: w.impact, 
          frecuencia: w.frequency 
        })),
        totalImpact: globalAgg?.totalImpact || 0,
        totalOrders: globalAgg?.totalOrders || 0
      });
      setCloudData(result);
      toast({ title: "Diagnóstico Situacional Generado", description: "Gemini ha procesado los drivers de impacto." });
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error en Motor IA", description: e.message }); 
    } finally { 
      setIsAnalyzing(false); 
    }
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen w-full bg-slate-50/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between border-b bg-white px-8 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-6">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter font-headline flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.6)]" />
                Nube Forense Situacional
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Diagnóstico de Concentración 80/20</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-4">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Universo Auditado</p>
               <p className="text-xs font-black text-primary">{(globalAgg?.totalOrders || 0).toLocaleString()} Registros</p>
            </div>
            <Button 
              onClick={runIAAnalysis} 
              disabled={isAnalyzing || !localCloudWeights.length} 
              className="bg-slate-900 hover:bg-slate-800 text-white gap-2 rounded-xl shadow-lg h-11 px-8 text-[10px] font-black uppercase tracking-widest"
            >
              {isAnalyzing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-accent" />}
              {isAnalyzing ? 'Procesando...' : 'Diagnóstico Gemini'}
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Visual Word Cloud Area */}
            <Card className="lg:col-span-8 border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden min-h-[650px] flex flex-col relative group">
              <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-30" />
              
              <CardHeader className="bg-slate-50/50 border-b p-8 relative z-10">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-widest flex items-center gap-3">
                    <MousePointer2 className="h-5 w-5 text-primary" /> Visualización de Criticidad
                  </CardTitle>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-rose-500" /><span className="text-[9px] font-black uppercase text-slate-500">Alto Impacto</span></div>
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-amber-500" /><span className="text-[9px] font-black uppercase text-slate-500">Alta Frecuencia</span></div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 relative z-10 overflow-y-auto">
                {localCloudWeights.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 text-slate-300">
                    <Database className="h-16 w-16 opacity-10" />
                    <p className="text-xs font-black uppercase tracking-widest">Sincronice datos para generar la nube</p>
                  </div>
                ) : (
                  localCloudWeights.map((word, i) => (
                    <button 
                      key={i} 
                      className="transition-all hover:scale-125 hover:z-50 relative group cursor-crosshair"
                      style={{ 
                        fontSize: `${word.weight}px`, 
                        color: word.sentiment === 'Crítico' ? '#E11D48' : (word.sentiment === 'Riesgo' ? '#D97706' : '#64748B'),
                        fontWeight: word.weight > 40 ? '900' : '700',
                        fontFamily: 'var(--font-headline)'
                      }}
                    >
                      {word.text}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-slate-900 text-white p-4 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-2xl pointer-events-none w-48 border border-white/10">
                        <p className="text-[10px] font-black uppercase text-accent mb-2 tracking-widest">{word.text}</p>
                        <div className="space-y-2">
                           <div className="flex justify-between items-end border-b border-white/10 pb-1">
                             <span className="text-[8px] text-slate-400 font-bold uppercase">Impacto</span>
                             <span className="text-xs font-black">{formatCurrency(word.impact)}</span>
                           </div>
                           <div className="flex justify-between items-end">
                             <span className="text-[8px] text-slate-400 font-bold uppercase">Frecuencia</span>
                             <span className="text-xs font-black">{word.frequency} OC/OT</span>
                           </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>

              <div className="p-8 bg-slate-50 border-t flex justify-between items-center relative z-10">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Escala basada en Impacto Financiero Real</p>
                 <Badge variant="outline" className="text-[8px] font-black uppercase bg-white border-slate-200">Top 40 Drivers Detectados</Badge>
              </div>
            </Card>

            {/* AI Insights Area */}
            <div className="lg:col-span-4 space-y-8">
              <Card className="border-none shadow-xl bg-slate-900 text-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-8 bg-slate-800/50">
                   <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-3">
                     <BrainCircuit className="h-5 w-5" /> Análisis Cognitivo 80/20
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  {!cloudData ? (
                    <div className="py-10 text-center space-y-4">
                       <Zap className="h-12 w-12 text-slate-700 mx-auto animate-pulse" />
                       <p className="text-xs text-slate-500 font-bold uppercase italic px-10">Ejecute el diagnóstico para que Gemini identifique el "Core Problem" del universo filtrado.</p>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-700">
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Driver Principal</h4>
                        <p className="text-xl font-headline font-bold text-white tracking-tight">{cloudData.coreProblem}</p>
                      </div>
                      
                      <Separator className="bg-white/10" />
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Concentración del Gasto</h4>
                          <span className="text-2xl font-black">{cloudData.concentrationPercentage}%</span>
                        </div>
                        <Progress value={cloudData.concentrationPercentage} className="h-2 bg-white/10" />
                        <p className="text-[9px] text-slate-400 italic">Este driver concentra la mayor erosión presupuestaria detectada en el periodo.</p>
                      </div>

                      <div className="bg-slate-800 p-6 rounded-3xl border border-white/5 space-y-3">
                         <h4 className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-2">
                           <Activity className="h-3.5 w-3.5" /> Diagnóstico VP
                         </h4>
                         <p className="text-xs text-slate-300 leading-relaxed italic">"{cloudData.executiveDiagnosis}"</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {cloudData && (
                <Card className="border-none shadow-xl bg-white rounded-[2.5rem] p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3 border-b pb-4">
                    <Target className="h-5 w-5 text-primary" /> Hoja de Ruta Estratégica
                  </h4>
                  <div className="space-y-4">
                    {cloudData.strategicRecommendations.map((rec, i) => (
                      <div key={i} className="flex gap-4 p-4 rounded-2xl bg-slate-50 group hover:bg-primary/5 transition-colors cursor-default">
                        <div className="h-8 w-8 rounded-xl bg-white border text-primary flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm group-hover:bg-primary group-hover:text-white transition-all">
                          {i + 1}
                        </div>
                        <p className="text-xs font-bold text-slate-700 leading-tight flex items-center">{rec}</p>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full rounded-xl gap-2 h-12 text-[10px] font-black uppercase tracking-widest border-slate-200">
                    Exportar Plan Forense <ChevronRight className="h-4 w-4" />
                  </Button>
                </Card>
              )}
            </div>
          </div>

          {/* Bottom Alert Banner */}
          <div className="bg-rose-600 p-6 rounded-[2rem] text-white flex flex-col md:flex-row items-center justify-between shadow-2xl">
             <div className="flex items-center gap-6 mb-4 md:mb-0">
                <div className="bg-white/20 p-4 rounded-full">
                  <ShieldCheck className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-0.5">
                   <h5 className="text-lg font-black uppercase tracking-tighter">Certificación de Integridad 80/20</h5>
                   <p className="text-xs font-bold opacity-70">Análisis verificado contra el universo de {(globalAgg?.totalImpact || 0).toLocaleString('es-MX', {style: 'currency', currency: 'MXN'})} auditados.</p>
                </div>
             </div>
             <p className="text-[10px] font-black uppercase tracking-widest border border-white/20 px-6 py-3 rounded-xl bg-white/10">
               Última Sincronización: {globalAgg?.lastUpdate ? new Date(globalAgg.lastUpdate).toLocaleString() : 'Pendiente'}
             </p>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
