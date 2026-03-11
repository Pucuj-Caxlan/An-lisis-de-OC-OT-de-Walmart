
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BrainCircuit, 
  RefreshCcw, 
  Database,
  Activity,
  Target,
  Zap,
  ChevronRight,
  ShieldCheck,
  Share2,
  Network,
  MousePointerClick
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { analyzeWordCloud, WordCloudOutput } from '@/ai/flows/word-cloud-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

const COLORS = {
  center: '#2962FF',
  discipline: '#0071CE',
  subDiscipline: '#FF8F00',
  accent: '#10B981'
};

interface Node {
  id: string;
  label: string;
  type: 'root' | 'discipline' | 'subDiscipline';
  impact: number;
  count: number;
  x: number;
  y: number;
  r: number;
  color: string;
  parentId?: string;
  isExpandable?: boolean;
}

interface Edge {
  from: string;
  to: string;
  color: string;
}

export default function WordCloudPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cloudData, setCloudData] = useState<WordCloudOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [expandedDisciplines, setExpandedDisciplines] = useState<Map<string, Node[]>>(new Map());
  const [isLoadingSub, setIsLoadingSub] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  // Cargamos las disciplinas principales de la taxonomía
  const discQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_disciplines'), orderBy('impact', 'desc'), limit(12)) : null, [db]);
  const { data: disciplinesDocs } = useCollection(discQuery);

  const toggleDiscipline = async (discNode: Node) => {
    if (expandedDisciplines.has(discNode.id)) {
      setExpandedDisciplines(prev => {
        const newMap = new Map(prev);
        newMap.delete(discNode.id);
        return newMap;
      });
      return;
    }

    setIsLoadingSub(discNode.id);
    try {
      // Buscamos registros de esta disciplina para extraer sub-disciplinas (subcausa_normalizada)
      const q = query(
        collection(db!, 'orders'),
        where('disciplina_normalizada', '==', discNode.label),
        limit(100)
      );
      const snap = await getDocs(q);
      
      const subMap = new Map<string, { impact: number, count: number }>();
      snap.docs.forEach(d => {
        const data = d.data();
        const sub = data.subcausa_normalizada || 'SIN DEFINIR';
        const impact = Number(data.impactoNeto || 0);
        
        if (!subMap.has(sub)) {
          subMap.set(sub, { impact: 0, count: 0 });
        }
        const entry = subMap.get(sub)!;
        entry.impact += impact;
        entry.count += 1;
      });

      const sortedSubs = Array.from(subMap.entries())
        .sort((a, b) => b[1].impact - a[1].impact)
        .slice(0, 6);

      const subNodes: Node[] = sortedSubs.map(([name, data], i) => {
        const angle = (i / sortedSubs.length) * Math.PI * 2;
        const dist = 100;
        return {
          id: `sub_${name}_${discNode.id}`,
          label: name,
          type: 'subDiscipline',
          impact: data.impact,
          count: data.count,
          x: discNode.x + Math.cos(angle) * dist,
          y: discNode.y + Math.sin(angle) * dist,
          r: 15 + (data.impact / (discNode.impact || 1)) * 15,
          color: COLORS.subDiscipline,
          parentId: discNode.id
        };
      });

      setExpandedDisciplines(prev => new Map(prev).set(discNode.id, subNodes));
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al expandir", description: "No se pudieron obtener sub-disciplinas." });
    } finally {
      setIsLoadingSub(null);
    }
  };

  const graphData = useMemo(() => {
    if (!disciplinesDocs || !globalAgg) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const centerX = 400;
    const centerY = 350;

    // 1. Root Node
    nodes.push({
      id: 'root',
      label: 'WALMART MÉXICO',
      type: 'root',
      impact: globalAgg.totalImpact || 0,
      count: globalAgg.totalOrders || 0,
      x: centerX,
      y: centerY,
      r: 45,
      color: COLORS.center
    });

    // 2. Disciplinas
    const discDistance = 200;
    disciplinesDocs.forEach((d, i) => {
      const angle = (i / disciplinesDocs.length) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * discDistance;
      const y = centerY + Math.sin(angle) * discDistance;
      
      const discNode: Node = {
        id: `disc_${d.id}`,
        label: d.name,
        type: 'discipline',
        impact: d.impact,
        count: d.count,
        x,
        y,
        r: 25 + (d.impact / globalAgg.totalImpact) * 40,
        color: COLORS.discipline,
        isExpandable: true
      };
      nodes.push(discNode);
      edges.push({ from: 'root', to: discNode.id, color: discNode.color });

      // 3. Sub-Disciplinas (si están expandidas)
      if (expandedDisciplines.has(discNode.id)) {
        const subs = expandedDisciplines.get(discNode.id)!;
        subs.forEach(sub => {
          nodes.push(sub);
          edges.push({ from: discNode.id, to: sub.id, color: sub.color });
        });
      }
    });

    return { nodes, edges };
  }, [disciplinesDocs, globalAgg, expandedDisciplines]);

  const runIAAnalysis = async () => {
    if (!disciplinesDocs?.length) return;
    setIsAnalyzing(true);
    try {
      const groups = disciplinesDocs.map(d => ({
        disciplina: d.name,
        causa: d.name,
        impactoTotal: d.impact,
        frecuencia: d.count
      }));

      const result = await analyzeWordCloud({ 
        groups,
        totalImpact: globalAgg?.totalImpact || 0,
        totalOrders: globalAgg?.totalOrders || 0
      });
      setCloudData(result);
      toast({ title: "Diagnóstico Generado", description: "Gemini ha analizado las relaciones del grafo." });
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
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Network className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Análisis Grafo de Inteligencia</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Universo Sincronizado</p>
               <p className="text-xs font-black text-primary">{(globalAgg?.totalOrders || 0).toLocaleString()} Relaciones Forenses</p>
            </div>
            <Button 
              onClick={runIAAnalysis} 
              disabled={isAnalyzing || !disciplinesDocs?.length} 
              className="bg-primary hover:bg-primary/90 text-white gap-2 rounded-xl shadow-md h-10 px-6 text-[10px] font-black uppercase tracking-widest"
            >
              {isAnalyzing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              {isAnalyzing ? 'Analizando...' : 'Diagnóstico Gemini'}
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Knowledge Graph Area */}
            <Card className="lg:col-span-8 border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden min-h-[750px] flex flex-col relative">
              <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:32px_32px] opacity-40" />
              
              <CardHeader className="bg-slate-50/50 border-b p-8 relative z-10">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-3">
                    <Share2 className="h-5 w-5 text-primary" /> Grafo de Disciplinas & Sub-Disciplinas
                  </CardTitle>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.discipline }} /><span className="text-[9px] font-black uppercase text-slate-500">Disciplina</span></div>
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.subDiscipline }} /><span className="text-[9px] font-black uppercase text-slate-500">Sub-Disciplina</span></div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 relative z-10 p-0 overflow-hidden bg-white/40">
                <svg viewBox="0 0 800 700" className="w-full h-full">
                  {/* Lines / Edges */}
                  {graphData.edges.map((edge, i) => {
                    const from = graphData.nodes.find(n => n.id === edge.from);
                    const to = graphData.nodes.find(n => n.id === edge.to);
                    if (!from || !to) return null;
                    const isHighlighted = hoveredNode?.id === from.id || hoveredNode?.id === to.id;
                    return (
                      <line 
                        key={i} 
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y} 
                        stroke={edge.color} 
                        strokeWidth={isHighlighted ? 3 : 1} 
                        strokeOpacity={isHighlighted ? 0.8 : 0.15}
                        className="transition-all duration-500"
                      />
                    );
                  })}

                  {/* Nodes */}
                  {graphData.nodes.map((node) => {
                    const isExpanded = expandedDisciplines.has(node.id);
                    const isProcessing = isLoadingSub === node.id;
                    
                    return (
                      <g 
                        key={node.id} 
                        transform={`translate(${node.x}, ${node.y})`}
                        className="cursor-pointer group"
                        onMouseEnter={() => setHoveredNode(node)}
                        onMouseLeave={() => setHoveredNode(null)}
                        onClick={() => node.isExpandable && toggleDiscipline(node)}
                      >
                        <circle 
                          r={node.r} 
                          fill={node.color} 
                          fillOpacity={hoveredNode?.id === node.id ? 0.9 : (node.type === 'subDiscipline' ? 0.5 : 0.7)}
                          stroke={node.isExpandable ? COLORS.accent : 'none'}
                          strokeWidth={isExpanded ? 4 : 2}
                          className="transition-all duration-300 group-hover:scale-110 shadow-lg"
                        />
                        {node.r > 12 && (
                          <text 
                            dy={node.r + 15} 
                            textAnchor="middle" 
                            fill="#1e293b" 
                            fontSize={node.type === 'root' ? 11 : (node.type === 'discipline' ? 9 : 7)} 
                            fontWeight="900"
                            className="uppercase pointer-events-none tracking-tight"
                          >
                            {node.label.length > 20 ? `${node.label.substring(0, 17)}...` : node.label}
                          </text>
                        )}
                        {isProcessing && (
                          <circle r={node.r + 5} fill="none" stroke={COLORS.accent} strokeWidth="2" strokeDasharray="4 4" className="animate-spin" />
                        )}
                        {node.isExpandable && !isExpanded && !isProcessing && (
                          <circle r={4} cy={0} fill="white" className="animate-pulse" />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Info Overlay on Hover */}
                {hoveredNode && (
                  <div className="absolute top-10 right-10 w-72 bg-white/95 backdrop-blur-xl border border-slate-200 p-6 rounded-[2rem] animate-in fade-in zoom-in duration-300 shadow-2xl z-50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: hoveredNode.color }} />
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                        {hoveredNode.type === 'root' ? 'Centro de Red' : (hoveredNode.type === 'discipline' ? 'Disciplina Técnica' : 'Sub-Disciplina')}
                      </p>
                    </div>
                    <h4 className="text-lg font-black text-slate-800 leading-tight uppercase mb-4">{hoveredNode.label}</h4>
                    <div className="space-y-3">
                       <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                         <span className="text-[9px] text-slate-400 font-bold uppercase">Impacto Financiero</span>
                         <span className="text-sm font-black text-slate-900">{formatCurrency(hoveredNode.impact)}</span>
                       </div>
                       <div className="flex justify-between items-end">
                         <span className="text-[9px] text-slate-400 font-bold uppercase">Volumen</span>
                         <span className="text-sm font-black text-slate-900">{hoveredNode.count} Registros</span>
                       </div>
                    </div>
                    {hoveredNode.isExpandable && (
                      <p className="text-[8px] font-black text-emerald-500 uppercase mt-4 tracking-widest">Haz clic para analizar relaciones de sub-causa</p>
                    )}
                  </div>
                )}

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-slate-200 px-6 py-3 rounded-full flex items-center gap-3 shadow-sm pointer-events-none">
                  <MousePointerClick className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Explora las Disciplinas para ver su impacto ramificado</span>
                </div>
              </CardContent>

              <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center relative z-10">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Grafo Multinivel • Inteligencia Forense de Relaciones</p>
                 <div className="flex gap-2">
                   <Badge variant="outline" className="text-[8px] font-black uppercase bg-white text-slate-500">Conexiones Verificadas</Badge>
                   <Badge variant="outline" className="text-[8px] font-black uppercase bg-white text-slate-500">Normalización SSOT</Badge>
                 </div>
              </div>
            </Card>

            {/* AI Strategic Insights Area */}
            <div className="lg:col-span-4 space-y-8">
              <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-8 bg-slate-900 text-white">
                   <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-3">
                     <BrainCircuit className="h-5 w-5" /> Análisis de Red Gemini
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  {!cloudData ? (
                    <div className="py-12 text-center space-y-4">
                       <Zap className="h-14 w-14 text-slate-200 mx-auto animate-pulse" />
                       <p className="text-xs text-slate-400 font-bold uppercase italic px-8 leading-relaxed">
                         Ejecuta el Diagnóstico Gemini para identificar el epicentro de las desviaciones en el grafo.
                       </p>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-700">
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Concentración Crítica</h4>
                        <p className="text-2xl font-headline font-bold text-slate-900 tracking-tight">{cloudData.coreProblem}</p>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Peso en la Red</h4>
                          <span className="text-3xl font-black text-primary">{cloudData.concentrationPercentage}%</span>
                        </div>
                        <Progress value={cloudData.concentrationPercentage} className="h-2" />
                        <p className="text-[9px] text-slate-400 italic">Este nodo es el principal driver del gasto en el universo analizado.</p>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                         <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                           <Activity className="h-3.5 w-3.5" /> Diagnóstico Estratégico
                         </h4>
                         <p className="text-xs text-slate-600 leading-relaxed italic">"{cloudData.executiveDiagnosis}"</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {cloudData && (
                <Card className="border-none shadow-xl bg-white rounded-[2.5rem] p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-3 border-b pb-4">
                    <Target className="h-5 w-5 text-primary" /> Hoja de Ruta de Mitigación
                  </h4>
                  <div className="space-y-4">
                    {cloudData.strategicRecommendations.map((rec, i) => (
                      <div key={i} className="flex gap-4 p-4 rounded-2xl bg-slate-50 group hover:bg-primary/5 transition-colors cursor-default border border-transparent hover:border-primary/10">
                        <div className="h-8 w-8 rounded-xl bg-white border shadow-sm text-primary flex items-center justify-center text-[10px] font-black shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                          {i + 1}
                        </div>
                        <p className="text-xs font-bold text-slate-600 leading-tight flex items-center">{rec}</p>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full rounded-xl gap-2 h-12 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50">
                    Exportar Análisis de Relaciones <ChevronRight className="h-4 w-4" />
                  </Button>
                </Card>
              )}
            </div>
          </div>

          {/* Bottom Data Integrity Banner */}
          <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between shadow-2xl relative overflow-hidden">
             <div className="flex items-center gap-6 relative z-10">
                <div className="bg-white/10 p-5 rounded-2xl border border-white/5">
                  <ShieldCheck className="h-10 w-10 text-emerald-400" />
                </div>
                <div className="space-y-1">
                   <h5 className="text-xl font-black uppercase tracking-tighter">Integridad del Grafo de Inteligencia</h5>
                   <p className="text-sm font-medium text-slate-400">Análisis basado en la red de interconexión de todas las órdenes de cambio sincronizadas.</p>
                </div>
             </div>
             <div className="flex items-center gap-4 relative z-10 mt-6 md:mt-0">
                <p className="text-[10px] font-black uppercase tracking-widest border border-white/10 px-8 py-4 rounded-xl bg-white/5 text-slate-300">
                  Sincronización: {globalAgg?.lastUpdate ? new Date(globalAgg.lastUpdate).toLocaleTimeString() : 'Pendiente'}
                </p>
                <div className="h-12 w-px bg-white/10 hidden md:block" />
                <p className="text-[10px] font-black uppercase text-emerald-400">SSOT Verificado</p>
             </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
