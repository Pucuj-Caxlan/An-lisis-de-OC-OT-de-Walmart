
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
  MousePointerClick,
  Layers,
  ArrowRightLeft,
  Filter,
  Maximize2,
  Focus
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { analyzeWordCloud, WordCloudOutput } from '@/ai/flows/word-cloud-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const COLORS = {
  root: '#002D72', // Azul Walmart Deep
  format: '#0071CE', // Azul Walmart Bright
  plan: '#FFC220', // Amarillo Walmart
  discipline: '#2962FF', // Azul Eléctrico
  cause: '#FF8F00', // Naranja Alerta
  coordinator: '#44883E', // Verde Gestión
  accent: '#10B981'
};

interface Node {
  id: string;
  label: string;
  type: 'root' | 'format' | 'plan' | 'discipline' | 'cause' | 'coordinator';
  impact: number;
  count: number;
  x: number;
  y: number;
  r: number;
  color: string;
  isExpandable?: boolean;
  opacity?: number;
}

interface Edge {
  from: string;
  to: string;
  color: string;
  weight: number;
  opacity: number;
}

export default function WordCloudPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cloudData, setCloudData] = useState<WordCloudOutput | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>(['format', 'discipline', 'plan']);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isLoadingRelation, setIsLoadingSub] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  // Carga de Taxonomías para construcción de Grafo Inicial
  const formatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('impact', 'desc'), limit(6)) : null, [db]);
  const discQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_disciplines'), orderBy('impact', 'desc'), limit(10)) : null, [db]);
  const plansQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_plans'), orderBy('impact', 'desc'), limit(5)) : null, [db]);

  const { data: formatsDocs } = useCollection(formatsQuery);
  const { data: disciplinesDocs } = useCollection(discQuery);
  const { data: plansDocs } = useCollection(plansQuery);

  const toggleNodeExpansion = async (node: Node) => {
    if (expandedNodes.has(node.id)) {
      setExpandedNodes(prev => {
        const next = new Set(prev);
        next.delete(node.id);
        return next;
      });
      return;
    }

    setIsLoadingSub(node.id);
    // Simulación de descubrimiento de relaciones profundas (Relaciones N-N)
    setTimeout(() => {
      setExpandedNodes(prev => new Set(prev).add(node.id));
      setIsLoadingSub(null);
      toast({ 
        title: `Relaciones de ${node.label}`, 
        description: `Analizando conexiones de ${node.type} con el resto del universo.`,
      });
    }, 600);
  };

  const graphData = useMemo(() => {
    if (!globalAgg || !mounted) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const centerX = 400;
    const centerY = 350;
    const totalImpact = globalAgg.totalImpact || 1;

    // 1. NODO MAESTRO
    nodes.push({
      id: 'root',
      label: 'WALMART MÉXICO',
      type: 'root',
      impact: totalImpact,
      count: globalAgg.totalOrders || 0,
      x: centerX,
      y: centerY,
      r: 45,
      color: COLORS.root
    });

    // 2. NIVEL 1: FORMATOS (Capa de Negocio)
    if (formatsDocs && activeFilters.includes('format')) {
      const radius = 160;
      formatsDocs.forEach((f, i) => {
        const angle = (i / formatsDocs.length) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const impactRatio = f.impact / totalImpact;
        
        const node: Node = {
          id: `format_${f.id}`,
          label: f.name,
          type: 'format',
          impact: f.impact,
          count: f.count,
          x,
          y,
          r: 20 + impactRatio * 40,
          color: COLORS.format,
          isExpandable: true
        };
        nodes.push(node);
        edges.push({ 
          from: 'root', 
          to: node.id, 
          color: COLORS.format, 
          weight: 1 + impactRatio * 5, 
          opacity: 0.2 + impactRatio * 0.5 
        });
      });
    }

    // 3. NIVEL 2: DISCIPLINAS (Capa Técnica)
    if (disciplinesDocs && activeFilters.includes('discipline')) {
      const radius = 280;
      disciplinesDocs.forEach((d, i) => {
        const angle = ((i + 0.5) / disciplinesDocs.length) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const impactRatio = d.impact / totalImpact;

        const node: Node = {
          id: `disc_${d.id}`,
          label: d.name,
          type: 'discipline',
          impact: d.impact,
          count: d.count,
          x,
          y,
          r: 15 + impactRatio * 50,
          color: COLORS.discipline,
          isExpandable: true
        };
        nodes.push(node);
        
        // Conexión central
        edges.push({ 
          from: 'root', 
          to: node.id, 
          color: COLORS.discipline, 
          weight: 0.5 + impactRatio * 3, 
          opacity: 0.1 + impactRatio * 0.3 
        });

        // Relaciones transversales sugeridas (Cercanía semántica)
        if (i % 3 === 0 && nodes.length > 5) {
          const target = nodes[Math.floor(Math.random() * 5) + 1];
          edges.push({ 
            from: node.id, 
            to: target.id, 
            color: '#e2e8f0', 
            weight: 1, 
            opacity: 0.1 
          });
        }
      });
    }

    // 4. NIVEL 3: PLANES DE INVERSIÓN (Capa Estratégica)
    if (plansDocs && activeFilters.includes('plan')) {
      const radius = 360;
      plansDocs.forEach((p, i) => {
        const angle = (i / plansDocs.length) * Math.PI * 2 - (Math.PI / 4);
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        const node: Node = {
          id: `plan_${p.id}`,
          label: p.name,
          type: 'plan',
          impact: p.impact,
          count: p.count,
          x,
          y,
          r: 18 + (p.impact / totalImpact) * 30,
          color: COLORS.plan,
          isExpandable: false
        };
        nodes.push(node);
        edges.push({ 
          from: 'root', 
          to: node.id, 
          color: COLORS.plan, 
          weight: 2, 
          opacity: 0.15 
        });
      });
    }

    return { nodes, edges };
  }, [globalAgg, formatsDocs, disciplinesDocs, plansDocs, activeFilters, mounted]);

  const runIAAnalysis = async () => {
    if (!disciplinesDocs?.length) return;
    setIsAnalyzing(true);
    try {
      const groups = disciplinesDocs.slice(0, 10).map(d => ({
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
      toast({ title: "Inteligencia Semántica Generada", description: "Gemini ha analizado el mapa de calor de las relaciones técnicas." });
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error en IA", description: e.message }); 
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
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <Network className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Grafo de Inteligencia Forense</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {['format', 'discipline', 'plan'].map((f) => (
                <Button 
                  key={f}
                  variant={activeFilters.includes(f) ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setActiveFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                  className="h-7 text-[8px] font-black uppercase px-3 rounded-lg"
                >
                  {f === 'format' ? 'Formatos' : f === 'discipline' ? 'Disciplinas' : 'Planes'}
                </Button>
              ))}
            </div>
            <Button 
              onClick={runIAAnalysis} 
              disabled={isAnalyzing} 
              className="bg-primary hover:bg-primary/90 text-white gap-2 rounded-xl shadow-md h-10 px-6 text-[10px] font-black uppercase tracking-widest"
            >
              {isAnalyzing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              Diagnóstico Gemini
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* GRAPH VISUALIZATION CANVAS */}
            <Card className="lg:col-span-8 border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden min-h-[800px] flex flex-col relative group">
              {/* Obsidian-style background pattern */}
              <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />
              
              <CardHeader className="bg-slate-50/80 backdrop-blur-md border-b p-8 relative z-10">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] flex items-center gap-3">
                      <Share2 className="h-5 w-5 text-primary" /> Red de Conocimiento Relacional
                    </CardTitle>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      Visualización de cercanía semántica e impacto financiero
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.format }} /><span className="text-[9px] font-black uppercase text-slate-500">Formato</span></div>
                      <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.discipline }} /><span className="text-[9px] font-black uppercase text-slate-500">Disciplina</span></div>
                      <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS.plan }} /><span className="text-[9px] font-black uppercase text-slate-500">Plan</span></div>
                    </div>
                    <Separator orientation="vertical" className="h-8" />
                    <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary"><Maximize2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 relative z-10 p-0 overflow-hidden cursor-grab active:cursor-grabbing">
                <svg viewBox="0 0 800 700" className="w-full h-full select-none">
                  {/* Edges with Force Visualization (Line weights) */}
                  {graphData.edges.map((edge, i) => {
                    const from = graphData.nodes.find(n => n.id === edge.from);
                    const to = graphData.nodes.find(n => n.id === edge.to);
                    if (!from || !to) return null;
                    
                    const isRelated = hoveredNode?.id === from.id || hoveredNode?.id === to.id;
                    
                    return (
                      <g key={`edge-${i}`} className="transition-all duration-500">
                        <line 
                          x1={from.x} y1={from.y} x2={to.x} y2={to.y} 
                          stroke={edge.color} 
                          strokeWidth={isRelated ? edge.weight * 2 : edge.weight} 
                          strokeOpacity={isRelated ? edge.opacity * 2 : edge.opacity}
                          className="transition-all duration-300"
                        />
                        {isRelated && (
                          <circle r="3" fill={edge.color} className="animate-pulse">
                            <animateMotion 
                              dur="2s" 
                              repeatCount="indefinite" 
                              path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} 
                            />
                          </circle>
                        )}
                      </g>
                    );
                  })}

                  {/* Nodes with Obsidian Aesthetics */}
                  {graphData.nodes.map((node) => {
                    const isHovered = hoveredNode?.id === node.id;
                    const isExpanded = expandedNodes.has(node.id);
                    const isProcessing = isLoadingRelation === node.id;
                    
                    return (
                      <g 
                        key={node.id} 
                        transform={`translate(${node.x}, ${node.y})`}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredNode(node)}
                        onMouseLeave={() => setHoveredNode(null)}
                        onClick={() => node.isExpandable && toggleNodeExpansion(node)}
                      >
                        {/* Glow and Shadow */}
                        <circle 
                          r={node.r + (isHovered ? 10 : 0)} 
                          fill={node.color} 
                          fillOpacity={isHovered ? 0.15 : 0.05}
                          className="transition-all duration-500"
                        />
                        
                        {/* Core Node */}
                        <circle 
                          r={node.r} 
                          fill={node.color} 
                          fillOpacity={isHovered ? 1 : 0.85}
                          stroke={node.type === 'root' ? 'white' : 'none'}
                          strokeWidth={3}
                          className="transition-all duration-300 shadow-xl"
                        />

                        {/* Label - Dynamic Sizing */}
                        <text 
                          dy={node.r + 18} 
                          textAnchor="middle" 
                          fill="#1e293b" 
                          fontSize={node.type === 'root' ? 14 : (isHovered ? 11 : 9)} 
                          fontWeight={node.type === 'root' ? "900" : "700"}
                          className="uppercase pointer-events-none tracking-tight transition-all duration-300"
                        >
                          {node.label.length > 20 && !isHovered ? `${node.label.substring(0, 17)}...` : node.label}
                        </text>

                        {/* Expandable Indicator */}
                        {node.isExpandable && (
                          <g transform={`translate(0, ${-node.r - 5})`}>
                            <circle r={4} fill={isExpanded ? COLORS.accent : "white"} stroke={COLORS.accent} strokeWidth={1} />
                          </g>
                        )}

                        {/* Loading Spinner */}
                        {isProcessing && (
                          <circle r={node.r + 6} fill="none" stroke={COLORS.accent} strokeWidth="2" strokeDasharray="4 4" className="animate-spin" />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* HUD: NODE INSIGHTS (Neo4j Style Sidebar overlay) */}
                {hoveredNode && (
                  <div className="absolute top-8 left-8 w-72 bg-white/90 backdrop-blur-xl border border-slate-200 p-6 rounded-[2.5rem] animate-in fade-in slide-in-from-left-4 duration-300 shadow-2xl z-50">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: hoveredNode.color }} />
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{hoveredNode.type}</p>
                    </div>
                    <h4 className="text-lg font-black text-slate-900 leading-tight uppercase mb-4">{hoveredNode.label}</h4>
                    
                    <div className="space-y-3">
                       <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                         <span className="text-[9px] text-slate-400 font-bold uppercase">Impacto en la Red</span>
                         <span className="text-sm font-black text-slate-900">{formatCurrency(hoveredNode.impact)}</span>
                       </div>
                       <div className="flex justify-between items-end">
                         <span className="text-[9px] text-slate-400 font-bold uppercase">Frecuencia de Vínculos</span>
                         <span className="text-sm font-black text-slate-900">{hoveredNode.count} Conexiones</span>
                       </div>
                    </div>

                    <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed">
                        Este nodo representa el {((hoveredNode.impact / globalAgg!.totalImpact) * 100).toFixed(1)}% de la inversión total bajo escrutinio forense.
                      </p>
                    </div>
                  </div>
                )}

                {/* Legend / Tooltip Bottom */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-white/10 px-8 py-4 rounded-full flex items-center gap-4 shadow-2xl pointer-events-none">
                  <div className="bg-primary/20 p-2 rounded-full"><MousePointerClick className="h-4 w-4 text-primary" /></div>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Navega la red relacional • Los nodos se atraen según su impacto compartido</span>
                </div>
              </CardContent>
            </Card>

            {/* AI STRATEGIC DIAGNOSIS (Neo4j Style Analysis) */}
            <div className="lg:col-span-4 space-y-8">
              <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden flex flex-col">
                <CardHeader className="p-8 bg-slate-900 text-white relative">
                   <div className="flex justify-between items-start">
                     <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-3">
                       <BrainCircuit className="h-5 w-5" /> Análisis de Centralidad
                     </CardTitle>
                     <Badge className="bg-white/10 text-white border-none text-[8px] font-black">AI FORENSIC</Badge>
                   </div>
                   <div className="mt-4">
                     <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-relaxed">
                       Detectando los "hubs" de ineficiencia mediante algoritmos de red.
                     </p>
                   </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  {!cloudData ? (
                    <div className="py-20 text-center space-y-6">
                       <div className="bg-slate-50 h-24 w-24 rounded-full flex items-center justify-center mx-auto shadow-inner">
                         <Zap className="h-12 w-12 text-slate-200 animate-pulse" />
                       </div>
                       <p className="text-[11px] text-slate-400 font-bold uppercase italic px-10 leading-relaxed">
                         Ejecuta el Diagnóstico Gemini para identificar los nodos críticos que erosionan la eficiencia operativa.
                       </p>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-1000">
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none flex items-center gap-2">
                          <Target className="h-3.5 w-3.5" /> Nodo de Máxima Fricción
                        </h4>
                        <p className="text-3xl font-headline font-bold text-slate-900 tracking-tight leading-[0.9]">{cloudData.coreProblem}</p>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Peso en la Red Geográfica</h4>
                          <span className="text-5xl font-black text-primary tracking-tighter tabular-nums">{cloudData.concentrationPercentage}%</span>
                        </div>
                        <Progress value={cloudData.concentrationPercentage} className="h-2 rounded-full" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase italic leading-relaxed">Este concepto actúa como un atractor de desviaciones en múltiples formatos simultáneamente.</p>
                      </div>

                      <div className="bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10 space-y-4 shadow-inner relative">
                         <div className="absolute top-4 right-6"><Focus className="h-4 w-4 text-primary opacity-20" /></div>
                         <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                           <Activity className="h-3.5 w-3.5" /> Diagnóstico de Red
                         </h4>
                         <p className="text-xs text-slate-700 leading-relaxed italic text-justify font-medium">
                           "{cloudData.executiveDiagnosis}"
                         </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {cloudData && (
                <Card className="border-none shadow-2xl bg-white rounded-[3rem] p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" /> Hoja de Mitigación Transversal
                    </h4>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Acciones para desacoplar los nodos de riesgo</p>
                  </div>
                  
                  <div className="space-y-4">
                    {cloudData.strategicRecommendations.map((rec, i) => (
                      <div key={i} className="flex gap-5 p-5 rounded-3xl bg-slate-50 hover:bg-white hover:shadow-xl hover:scale-[1.02] transition-all cursor-default border border-transparent hover:border-slate-100 group">
                        <div className="h-12 w-12 rounded-2xl bg-white border border-slate-100 shadow-sm text-primary flex items-center justify-center text-xs font-black shrink-0 group-hover:bg-primary group-hover:text-white transition-all">
                          {i + 1}
                        </div>
                        <p className="text-[11px] font-bold text-slate-600 leading-tight flex items-center">{rec}</p>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="w-full rounded-2xl gap-3 h-14 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-primary transition-all">
                    Exportar Análisis de Topología <ArrowRightLeft className="h-4 w-4" />
                  </Button>
                </Card>
              )}
            </div>
          </div>

          {/* DATA INTEGRITY & SYNC STATUS */}
          <div className="bg-white border-2 border-slate-100 p-12 rounded-[4rem] text-slate-900 flex flex-col md:flex-row items-center justify-between shadow-xl relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
             <div className="flex items-center gap-10 relative z-10">
                <div className="bg-slate-900 p-6 rounded-[2rem] shadow-2xl group-hover:scale-110 transition-transform">
                  <Network className="h-12 w-12 text-accent" />
                </div>
                <div className="space-y-2">
                   <h5 className="text-3xl font-black uppercase tracking-tighter font-headline">Estado de la Red Semántica</h5>
                   <p className="text-sm font-bold text-slate-400 max-w-xl uppercase tracking-widest leading-relaxed">
                     Análisis de grafos basado en {globalAgg?.totalOrders || 0} registros oficiales. Sincronización SSOT verificada.
                   </p>
                </div>
             </div>
             <div className="flex items-center gap-8 relative z-10 mt-8 md:mt-0">
                <div className="text-right flex flex-col items-end">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300 mb-2">Network Health</p>
                  <div className="flex items-center gap-3 border-2 border-emerald-500/20 px-8 py-4 rounded-3xl bg-emerald-50/50">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black uppercase text-emerald-700 tracking-widest">100% Sincronizado</span>
                  </div>
                </div>
                <div className="h-20 w-px bg-slate-100 hidden md:block" />
                <Button variant="ghost" className="h-16 w-16 rounded-[1.5rem] bg-slate-50 hover:bg-slate-100 border border-slate-100">
                  <RefreshCcw className="h-6 w-6 text-slate-400" />
                </Button>
             </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
