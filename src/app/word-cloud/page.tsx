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
import { collection, query, doc } from 'firebase/firestore';
import { analyzeWordCloud, WordCloudOutput } from '@/ai/flows/word-cloud-analysis-flow';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

const COLORS = {
  center: '#2962FF',
  'OBRA CIVIL': '#0071CE',
  'INSTALACIONES (MEP)': '#FFC220',
  'INGENIERÍA Y DISEÑO': '#44883E',
  'EQUIPAMIENTO': '#F47321',
  'GESTIÓN Y ADMON': '#E31837',
  'OTROS': '#54585A'
};

const GET_RAMO = (discipline: string): string => {
  const d = String(discipline || '').toUpperCase().trim();
  if (d.includes('CIVIL') || d.includes('ARQUITECTÓNICA') || d.includes('TERRACERÍAS') || d.includes('EDIFICACIÓN') || d.includes('OBRA GRIS') || d.includes('ESTRUCTURA')) return 'OBRA CIVIL';
  if (d.includes('INGENIERÍA') || d.includes('DISEÑO') || d.includes('ARQUITECTURA') || d.includes('PROYECTO')) return 'INGENIERÍA Y DISEÑO';
  if (d.includes('ELÉCTRICA') || d.includes('HIDRÁULICA') || d.includes('AIRE') || d.includes('REFRIGERACIÓN') || d.includes('SANITARIA') || d.includes('PCI') || d.includes('VOZ') || d.includes('ESPECIALES') || d.includes('FUME')) return 'INSTALACIONES (MEP)';
  if (d.includes('GESTIÓN') || d.includes('ADMINISTRACIÓN') || d.includes('SUPERVISIÓN') || d.includes('GERENCIA') || d.includes('TRÁMITES') || d.includes('LICENCIAS') || d.includes('LEGAL')) return 'GESTIÓN Y ADMON';
  if (d.includes('MOBILIARIO') || d.includes('EQUIPO') || d.includes('COCINA') || d.includes('RACKS') || d.includes('SEÑALIZACIÓN')) return 'EQUIPAMIENTO';
  return 'OTROS';
};

interface Node {
  id: string;
  label: string;
  type: 'root' | 'ramo' | 'discipline';
  impact: number;
  count: number;
  x: number;
  y: number;
  r: number;
  color: string;
  ramo?: string;
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
  const [expandedRamos, setExpandedRamos] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  const analyticsQuery = useMemoFirebase(() => db ? query(collection(db, 'hitos_analytics')) : null, [db]);
  const { data: analyticsDocs } = useCollection(analyticsQuery);

  const toggleRamo = (ramoId: string) => {
    setExpandedRamos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ramoId)) {
        newSet.delete(ramoId);
      } else {
        newSet.add(ramoId);
      }
      return newSet;
    });
  };

  const graphData = useMemo(() => {
    if (!analyticsDocs || analyticsDocs.length === 0) return { nodes: [], edges: [] };

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const centerX = 400;
    const centerY = 350;

    // 1. Root Node
    nodes.push({
      id: 'root',
      label: 'WALMART MÉXICO',
      type: 'root',
      impact: globalAgg?.totalImpact || 0,
      count: globalAgg?.totalOrders || 0,
      x: centerX,
      y: centerY,
      r: 45,
      color: COLORS.center
    });

    // 2. Group by Ramo
    const ramoMap = new Map<string, { impact: number, count: number, subDiscs: Map<string, { impact: number, count: number }> }>();
    analyticsDocs.forEach(d => {
      const r = GET_RAMO(d.discipline || 'OTROS');
      const disc = String(d.discipline).trim().toUpperCase();
      const impact = Number(d.impact || 0);
      const count = Number(d.count || 0);

      if (!ramoMap.has(r)) {
        ramoMap.set(r, { impact: 0, count: 0, subDiscs: new Map() });
      }
      const entry = ramoMap.get(r)!;
      entry.impact += impact;
      entry.count += count;

      if (!entry.subDiscs.has(disc)) {
        entry.subDiscs.set(disc, { impact: 0, count: 0 });
      }
      const dEntry = entry.subDiscs.get(disc)!;
      dEntry.impact += impact;
      dEntry.count += count;
    });

    // 3. Layout Generation (Orbital)
    const ramos = Array.from(ramoMap.entries()).sort((a, b) => b[1].impact - a[1].impact);
    const ramoDistance = 180;
    const discDistance = 90;

    ramos.forEach(([name, data], i) => {
      const angle = (i / ramos.length) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * ramoDistance;
      const y = centerY + Math.sin(angle) * ramoDistance;
      
      const ramoId = `ramo_${name}`;
      const isExpanded = expandedRamos.has(ramoId);

      const ramoNode: Node = {
        id: ramoId,
        label: name,
        type: 'ramo',
        impact: data.impact,
        count: data.count,
        x,
        y,
        r: 30 + (data.impact / (globalAgg?.totalImpact || 1)) * 35,
        color: COLORS[name as keyof typeof COLORS] || COLORS.OTROS,
        isExpandable: true
      };
      nodes.push(ramoNode);
      edges.push({ from: 'root', to: ramoNode.id, color: ramoNode.color });

      // Disciplines for this Ramo (if expanded)
      if (isExpanded) {
        const topDiscs = Array.from(data.subDiscs.entries())
          .sort((a, b) => b[1].impact - a[1].impact)
          .slice(0, 6);

        topDiscs.forEach(([dName, dData], j) => {
          const dAngle = angle - 0.6 + (j / Math.max(1, topDiscs.length - 1)) * 1.2;
          const dx = x + Math.cos(dAngle) * discDistance;
          const dy = y + Math.sin(dAngle) * discDistance;

          const discNode: Node = {
            id: `disc_${dName}_${ramoId}`,
            label: dName,
            type: 'discipline',
            impact: dData.impact,
            count: dData.count,
            x: dx,
            y: dy,
            r: 12 + (dData.impact / (data.impact || 1)) * 12,
            color: ramoNode.color,
            ramo: name
          };
          nodes.push(discNode);
          edges.push({ from: ramoNode.id, to: discNode.id, color: ramoNode.color });
        });
      }
    });

    return { nodes, edges };
  }, [analyticsDocs, globalAgg, expandedRamos]);

  const runIAAnalysis = async () => {
    if (!analyticsDocs?.length) return;
    setIsAnalyzing(true);
    try {
      const groups = graphData.nodes
        .filter(n => n.type === 'ramo')
        .map(n => ({
          disciplina: n.label,
          causa: n.label,
          impactoTotal: n.impact,
          frecuencia: n.count
        }));

      const result = await analyzeWordCloud({ 
        groups,
        totalImpact: globalAgg?.totalImpact || 0,
        totalOrders: globalAgg?.totalOrders || 0
      });
      setCloudData(result);
      toast({ title: "Diagnóstico Generado", description: "Gemini ha analizado las fuerzas del grafo." });
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
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Grafo de Inteligencia Forense</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Universo Sincronizado</p>
               <p className="text-xs font-black text-primary">{(globalAgg?.totalOrders || 0).toLocaleString()} Nodos Auditados</p>
            </div>
            <Button 
              onClick={runIAAnalysis} 
              disabled={isAnalyzing || !analyticsDocs?.length} 
              className="bg-primary hover:bg-primary/90 text-white gap-2 rounded-xl shadow-md h-10 px-6 text-[10px] font-black uppercase tracking-widest"
            >
              {isAnalyzing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              {isAnalyzing ? 'Calculando...' : 'Analizar con Gemini'}
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Visual Knowledge Graph Area */}
            <Card className="lg:col-span-8 border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden min-h-[750px] flex flex-col relative group">
              <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
              
              <CardHeader className="bg-slate-50/50 border-b p-8 relative z-10">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-3">
                    <Share2 className="h-5 w-5 text-primary" /> Red Dinámica de Desviaciones Técnicas
                  </CardTitle>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary" /><span className="text-[9px] font-black uppercase text-slate-500">Inversión Walmart</span></div>
                    <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-[9px] font-black uppercase text-slate-500">Nodo Expandible</span></div>
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
                        strokeWidth={isHighlighted ? 2.5 : 1} 
                        strokeOpacity={isHighlighted ? 0.6 : 0.1}
                        className="transition-all duration-500"
                      />
                    );
                  })}

                  {/* Nodes */}
                  {graphData.nodes.map((node) => {
                    const isExpanded = expandedRamos.has(node.id);
                    return (
                      <g 
                        key={node.id} 
                        transform={`translate(${node.x}, ${node.y})`}
                        className="cursor-pointer group"
                        onMouseEnter={() => setHoveredNode(node)}
                        onMouseLeave={() => setHoveredNode(null)}
                        onClick={() => node.isExpandable && toggleRamo(node.id)}
                      >
                        <circle 
                          r={node.r} 
                          fill={node.color} 
                          fillOpacity={hoveredNode?.id === node.id ? 0.8 : (node.type === 'discipline' ? 0.4 : 0.6)}
                          stroke={node.isExpandable ? '#10B981' : node.color}
                          strokeWidth={node.isExpandable ? (isExpanded ? 4 : 2) : 1}
                          className="transition-all duration-300 group-hover:scale-105"
                        />
                        {node.r > 15 && (
                          <text 
                            dy={node.r + 15} 
                            textAnchor="middle" 
                            fill={COLORS.center} 
                            fontSize={node.type === 'root' ? 11 : 8} 
                            fontWeight="900"
                            className="uppercase pointer-events-none tracking-tight"
                          >
                            {node.label}
                          </text>
                        )}
                        {node.isExpandable && !isExpanded && (
                          <circle r={4} cy={0} fill="white" className="animate-pulse" />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Interaction Instruction */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-full flex items-center gap-2 shadow-sm pointer-events-none">
                  <MousePointerClick className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Haz clic en los nodos verdes para abrir especialidades</span>
                </div>

                {/* Info Overlay on Hover */}
                {hoveredNode && (
                  <div className="absolute top-10 right-10 w-64 bg-white/95 backdrop-blur-xl border border-slate-200 p-6 rounded-3xl animate-in fade-in zoom-in duration-300 shadow-2xl z-50">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">{hoveredNode.type === 'root' ? 'Núcleo Central' : (hoveredNode.type === 'ramo' ? 'Ramo Técnico' : 'Especialidad')}</p>
                    <h4 className="text-lg font-black text-slate-800 leading-tight uppercase mb-4">{hoveredNode.label}</h4>
                    <div className="space-y-3">
                       <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                         <span className="text-[9px] text-slate-400 font-bold uppercase">Impacto Financiero</span>
                         <span className="text-sm font-black text-slate-900">{formatCurrency(hoveredNode.impact)}</span>
                       </div>
                       <div className="flex justify-between items-end">
                         <span className="text-[9px] text-slate-400 font-bold uppercase">Volumen</span>
                         <span className="text-sm font-black text-slate-900">{hoveredNode.count} OC/OT</span>
                       </div>
                    </div>
                  </div>
                )}
              </CardContent>

              <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center relative z-10">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Análisis 80/20 • Grafo Dinámico de Relaciones</p>
                 <div className="flex gap-2">
                   <Badge variant="outline" className="text-[8px] font-black uppercase bg-white text-slate-500">Relaciones Verificadas</Badge>
                   <Badge variant="outline" className="text-[8px] font-black uppercase bg-white text-slate-500">Sincronización SSOT</Badge>
                 </div>
              </div>
            </Card>

            {/* AI Insights Area */}
            <div className="lg:col-span-4 space-y-8">
              <Card className="border-none shadow-xl bg-white rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-8 bg-slate-900 text-white">
                   <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-3">
                     <BrainCircuit className="h-5 w-5" /> Análisis Situacional IA
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  {!cloudData ? (
                    <div className="py-10 text-center space-y-4">
                       <Zap className="h-12 w-12 text-slate-200 mx-auto animate-pulse" />
                       <p className="text-xs text-slate-400 font-bold uppercase italic px-6 leading-relaxed">
                         Solicita un análisis a la IA para identificar el driver principal de la red de desviaciones.
                       </p>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-700">
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Epicentro de Desviación</h4>
                        <p className="text-2xl font-headline font-bold text-slate-900 tracking-tight leading-none">{cloudData.coreProblem}</p>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-end">
                          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Concentración de Impacto</h4>
                          <span className="text-3xl font-black text-primary">{cloudData.concentrationPercentage}%</span>
                        </div>
                        <Progress value={cloudData.concentrationPercentage} className="h-2" />
                        <p className="text-[9px] text-slate-400 italic">Este nodo concentra la mayor parte de las desviaciones financieras detectadas.</p>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
                         <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                           <Activity className="h-3.5 w-3.5" /> Diagnóstico de Red
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
                    Exportar Mapa Forense <ChevronRight className="h-4 w-4" />
                  </Button>
                </Card>
              )}
            </div>
          </div>

          {/* Bottom Data Integrty Banner */}
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between shadow-2xl relative overflow-hidden">
             <div className="flex items-center gap-6 relative z-10">
                <div className="bg-white/10 p-4 rounded-2xl border border-white/5">
                  <ShieldCheck className="h-8 w-8 text-emerald-400" />
                </div>
                <div className="space-y-0.5">
                   <h5 className="text-lg font-black uppercase tracking-tighter">Integridad de Análisis Multinodo</h5>
                   <p className="text-xs font-bold text-slate-400">Datos basados en el impacto financiero total auditado por la unidad forense.</p>
                </div>
             </div>
             <div className="flex items-center gap-4 relative z-10 mt-4 md:mt-0">
                <p className="text-[10px] font-black uppercase tracking-widest border border-white/10 px-6 py-3 rounded-xl bg-white/5 text-slate-300">
                  Corte: {globalAgg?.lastUpdate ? new Date(globalAgg.lastUpdate).toLocaleDateString() : 'Pendiente'}
                </p>
                <div className="h-10 w-px bg-white/10 hidden md:block" />
                <p className="text-[10px] font-black uppercase text-emerald-400">Fuerzas de Red Verificadas</p>
             </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
