
"use client"

import React, { useState, useMemo, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Maximize2,
  Filter,
  Loader2,
  ShieldCheck,
  Search,
  CalendarDays,
  Target,
  Layers,
  FileText,
  BrainCircuit,
  Zap,
  Activity,
  Database,
  LayoutDashboard,
  Info,
  X,
  AlertTriangle,
  Ruler,
  FileSearch,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  Clock,
  ShieldAlert,
  ArrowRightLeft,
  MapPin,
  Globe,
  Focus,
  Sparkles,
  Hammer,
  Handshake,
  MessageSquareText,
  ListFilter,
  TextSearch,
  MousePointerClick
} from 'lucide-react';
import {
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  CartesianGrid,
  PieChart,
  Pie,
  ComposedChart,
  Line,
  Legend
} from 'recharts';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup
} from "react-simple-maps";
import { useFirestore, useMemoFirebase, useUser, useCollection, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, where, limit, getDocs } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { detectAnomalies, AnomalyDetectionOutput } from '@/ai/flows/anomaly-detection-flow';

// Línea original: const GEO_URL = "";
const GEO_URL = "https://raw.githubusercontent.com/Anvito/geo-mexico/master/maps/mexico_estates.json";

const CHIP_COLORS = [
  'border-blue-400 text-blue-600',
  'border-rose-400 text-rose-600',
  'border-indigo-400 text-indigo-600',
  'border-emerald-400 text-emerald-600',
  'border-amber-400 text-amber-600',
  'border-orange-400 text-orange-600',
  'border-red-400 text-red-600',
  'border-violet-400 text-violet-600',
  'border-cyan-400 text-cyan-600',
  'border-teal-400 text-teal-600',
];

const RECURRING_COLORS = [
  '#002D72', '#0071CE', '#2962FF', '#06B6D4', '#10B981', 
  '#84CC16', '#F59E0B', '#F97316', '#EF4444', '#D946EF',
  '#8B5CF6', '#6366F1', '#475569', '#1E293B', '#334155',
  '#64748B', '#94A3B8', '#CBD5E1', '#E2E8F0', '#F1F5F9',
  '#A8A29E', '#78716C', '#44403C', '#27272A', '#0F172A'
];

const CAUSE_COLORS: Record<string, string> = {
  "ALTA DE ALCANCE EN PLAN": "text-blue-600 border-blue-200",
  "ERRORES / OMISIONES": "text-rose-600 border-rose-200",
  "SOLICITUD DE CUMPLIMIENTO / AUTORIDAD": "text-indigo-600 border-indigo-200",
  "ACTUALIZACIÓN DE PROTOTIPO": "text-emerald-600 border-emerald-200",
  "INICIATIVAS ESTRATÉGICAS Y ADICIONES A SCOPE FUERA DE PROTOTIPO": "text-amber-600 border-amber-200",
  "ALCANCE CONOCIDO NO ASIGNADO POR CONCURSOS": "text-orange-600 border-orange-200",
  "IMPREVISTOS POR SINIESTRO": "text-red-600 border-red-200",
  "HALLAZGOS / IMPREVISTOS EN SITIO DURANTE PROCESO DE CONSTRUCCIÓN": "text-violet-600 border-violet-200",
  "REQUERIMIENTO DE PROCESOS CONSTRUCTIVOS": "text-cyan-600 border-cyan-200",
  "CAMBIO DE NEGOCIACIÓN": "text-teal-600 border-teal-200"
};

const CAUSE_DESCRIPTIONS: Record<string, string> = {
  "ALTA DE ALCANCE EN PLAN": "Solicitud de trabajos adicionales a proveedores que prestaron servicio en la misma unidad en planes anteriores.",
  "ERRORES / OMISIONES": "Falta de aplicación de CI, criterio, prototipo o especificación. También aplica por falta de aplicación de normativa de la autoridad.",
  "SOLICITUD DE CUMPLIMIENTO / AUTORIDAD": "Modificación ambiental, redistribución de bolsa de estacionamiento o cambio en infraestructura de vialidades en zonas aledañas.",
  "ACTUALIZACIÓN DE PROTOTIPO": "Implementación de CI o actualización a la versión vigente de prototipo.",
  "INICIATIVAS ESTRATÉGICAS Y ADICIONES A SCOPE FUERA DE PROTOTIPO": "Implementación de self-checkout o implementación de cajones pickup.",
  "ALCANCE CONOCIDO NO ASIGNADO POR CONCURSOS": "Acuerdos con desarrolladores omitidos por Wal-Mart en el alcance de la contratista.",
  "IMPREVISTOS POR SINIESTRO": "Inundaciones, caídos o derrumbes, o desastres naturales.",
  "HALLAZGOS / IMPREVISTOS EN SITIO DURANTE PROCESO DE CONSTRUCCIÓN": "Detección de roca en subsuelo, detección de nivel freático, cimentaciones ocultas o temas INAH.",
  "REQUERIMIENTO DE PROCESOS CONSTRUCTIVOS": "Sobre excavaciones, protección a colindancias o tapiales.",
  "CAMBIO DE NEGOCIACIÓN": "Confinamiento de estacionamientos, modificación en Co-Tenancy o modificación de acuerdos pactados con el oferente."
};

const CAUSE_ICONS: Record<string, any> = {
  "ALTA DE ALCANCE EN PLAN": Info,
  "ERRORES / OMISIONES": X,
  "SOLICITUD DE CUMPLIMIENTO / AUTORIDAD": FileSearch,
  "ACTUALIZACIÓN DE PROTOTIPO": Ruler,
  "INICIATIVAS ESTRATÉGICAS Y ADICIONES A SCOPE FUERA DE PROTOTIPO": Sparkles,
  "ALCANCE CONOCIDO NO ASIGNADO POR CONCURSOS": AlertTriangle,
  "IMPREVISTOS POR SINIESTRO": Activity,
  "HALLAZGOS / IMPREVISTOS EN SITIO DURANTE PROCESO DE CONSTRUCCIÓN": Zap,
  "REQUERIMIENTO DE PROCESOS CONSTRUCTIVOS": Hammer,
  "CAMBIO DE NEGOCIACIÓN": Handshake
};

const STATE_MARKERS: Record<string, number[]> = {
  "CIUDAD DE MÉXICO": [-99.1332, 19.4326],
  "ESTADO DE MÉXICO": [-99.6557, 19.2826],
  "NUEVO LEÓN": [-100.3161, 25.6866],
  "JALISCO": [-103.3496, 20.6597],
  "PUEBLA": [-98.2062, 19.0414],
  "VERACRUZ": [-96.1342, 19.1738],
  "GUANAJUATO": [-101.2574, 21.0190],
  "QUERÉTARO": [-100.3881, 20.5888],
  "YUCATÁN": [-89.6225, 20.9674],
  "CHIAPAS": [-93.1134, 16.7569],
  "GUERRERO": [-99.5005, 17.5516],
  "OAXACA": [-96.7266, 17.0732],
  "TAMAULIPAS": [-98.1930, 23.7369],
  "SONORA": [-110.9773, 29.0730],
  "CHIHUAHUA": [-106.0691, 28.6330],
  "BAJA CALIFORNIA": [-115.4545, 32.6245],
  "QUINTANA ROO": [-88.2961, 18.5042],
  "SAN LUIS POTOSÍ": [-100.9755, 22.1565],
  "SINALOA": [-107.3916, 24.8054],
  "COAHUILA": [-101.0005, 25.4232],
  "MICHOACÁN": [-101.1844, 19.7006],
  "DURANGO": [-104.6532, 24.0277],
  "HIDALGO": [-98.7624, 20.1011],
  "MORELOS": [-99.2360, 18.9220],
  "AGUASCALIENTES": [-102.2916, 21.8853],
  "TLAXCALA": [-98.2384, 19.3181],
  "NAYARIT": [-104.8947, 21.5039],
  "COLIMA": [-103.7271, 19.2433],
  "TABASCO": [-92.9303, 17.9869],
  "ZACATECAS": [-102.5835, 22.7709],
  "CAMPECHE": [-90.5349, 19.8301],
  "BAJA CALIFORNIA SUR": [-110.3126, 24.1426]
};

const CustomTooltip = ({ active, payload, formatCurrency }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xl text-slate-900 z-50 min-w-[220px]">
        <p className="text-[10px] font-black uppercase text-primary mb-3 tracking-widest border-b pb-2">{data.name || data.phrase || data.label}</p>
        <div className="space-y-2">
          <div className="flex justify-between gap-6">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Repeticiones:</span>
            <span className="text-xs font-black text-slate-900">{data.count || 0} registros</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Impacto MXN:</span>
            <span className="text-xs font-black text-slate-900">{formatCurrency(data.impact || data.value || 0)}</span>
          </div>
          {data.percentage !== undefined && (
            <div className="flex justify-between gap-6">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Participación:</span>
              <span className="text-xs font-black text-emerald-600">{data.percentage || 0}%</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function VpDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const { isAuthReady } = useUser();
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'analytical' | 'executive' | 'coordinator' | 'geography' | 'recurring'>('analytical');
  
  const [yearFilter, setYearFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  
  const [aggMode, setAggMode] = useState<'cause' | 'discipline'>('cause');
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [selectedBar, setSelectedBar] = useState<any>(null);
  const [selectedSubBar, setSelectedSubBar] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [mapScale, setMapScale] = useState(1);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [evidenceData, setEvidenceData] = useState<any[]>([]);

  const [isGlobalAuditing, setIsGlobalAuditing] = useState(false);
  const [globalAuditResult, setGlobalAuditResult] = useState<AnomalyDetectionOutput | null>(null);

  const [recurringSubTab, setRecurringSubTab] = useState<'clusters' | 'phrases' | 'details'>('clusters');
  const [analyzedOrders, setAnalyzedOrders] = useState<any[]>([]);
  const [isLoadingRecurring, setIsLoadingRecurring] = useState(false);

  // Estados para detalle de cluster en pestaña de causas recurrentes
  const [selectedRecurringCluster, setSelectedRecurringCluster] = useState<string | null>(null);
  const [clusterDetailOrders, setClusterDetailOrders] = useState<any[]>([]);
  const [isFetchingClusterDetail, setIsFetchingClusterDetail] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const globalAggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(globalAggRef);

  const formatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('name', 'asc')) : null, [db]);
  const plansQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_plans'), orderBy('name', 'asc')) : null, [db]);
  
  const { data: availableFormats } = useCollection(formatsQuery);
  const { data: availablePlans } = useCollection(plansQuery);

  const analyticsQuery = useMemoFirebase(() => {
    if (!db || !isAuthReady) return null;
    let baseQuery = collection(db, 'hitos_analytics');
    if (yearFilter !== 'all') {
      const yearNum = Number(yearFilter);
      if (!isNaN(yearNum)) {
        return query(baseQuery, where('year', '==', yearNum));
      }
    }
    return baseQuery;
  }, [db, isAuthReady, yearFilter]);

  const { data: rawAnalytics } = useCollection(analyticsQuery);

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val);
  };

  const summaryContext = useMemo(() => {
    if (!rawAnalytics) return { totalImpact: 0, totalOrders: 0, chips: [], globalTopSubcauses: [] };

    const chipMap = new Map<string, any>();
    const globalSubcauseMap = new Map<string, any>();
    let totalImpact = 0;
    let totalOrders = 0;

    rawAnalytics.forEach(d => {
      const matchFormat = formatFilter === 'all' || d.format === formatFilter;
      const matchPlan = planFilter === 'all' || d.plan === planFilter;

      if (matchFormat && matchPlan) {
        const impact = Number(d.impact || 0);
        const count = Number(d.count || 0);
        totalImpact += impact;
        totalOrders += count;

        const subKey = d.subcause || 'ADICIONALES Y TRABAJOS COMPLEMENTARIOS';
        const fullKey = `${d.discipline} | ${subKey}`;
        if (!globalSubcauseMap.has(fullKey)) {
          globalSubcauseMap.set(fullKey, { discipline: d.discipline, subcause: subKey, impact: 0, count: 0 });
        }
        const gsc = globalSubcauseMap.get(fullKey);
        gsc.impact += impact;
        gsc.count += count;

        const chipKey = aggMode === 'cause' ? d.cause : d.discipline;
        if (!chipKey) return;

        if (chipMap.has(chipKey)) {
          const e = chipMap.get(chipKey);
          e.impact += impact;
          e.count += count;
        } else {
          chipMap.set(chipKey, { name: chipKey, impact, count });
        }
      }
    });

    const chips = Array.from(chipMap.values())
      .sort((a, b) => b.impact - a.impact)
      .map((c, i) => ({ 
        ...c, 
        percentage: ((c.impact / (totalImpact || 1)) * 100).toFixed(1),
        color: CHIP_COLORS[i % CHIP_COLORS.length]
      }));

    const globalTopSubcauses = Array.from(globalSubcauseMap.values())
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 10);

    return { totalImpact, totalOrders, chips, globalTopSubcauses };
  }, [rawAnalytics, formatFilter, planFilter, aggMode]);

  const recurringData = useMemo(() => {
    if (viewMode !== 'recurring' || !rawAnalytics) return { clusters: [], totalAnalyzed: 0 };

    const clustersMap = new Map<string, any>();
    const totalImpactUniverse = summaryContext.totalImpact || 1;

    rawAnalytics.forEach(d => {
      const matchFormat = formatFilter === 'all' || d.format === formatFilter;
      const matchPlan = planFilter === 'all' || d.plan === planFilter;

      if (matchFormat && matchPlan) {
        const clusterName = d.subcause || 'ADICIONALES Y TRABAJOS COMPLEMENTARIOS';
        if (!clustersMap.has(clusterName)) {
          clustersMap.set(clusterName, { 
            name: clusterName, 
            count: 0, 
            impact: 0, 
            discipline: d.discipline,
            mainCause: d.cause,
          });
        }
        const cluster = clustersMap.get(clusterName);
        cluster.count += d.count;
        cluster.impact += d.impact;
      }
    });

    const allClustersSorted = Array.from(clustersMap.values())
      .sort((a, b) => b.impact - a.impact);

    const topLimit = 60;
    const finalClusters: any[] = [];
    let othersImpact = 0;
    let othersCount = 0;

    allClustersSorted.forEach((c, idx) => {
      if (idx < topLimit || (c.impact / totalImpactUniverse) > 0.002) {
        finalClusters.push({
          ...c,
          percentage: Number(((c.impact / totalImpactUniverse) * 100).toFixed(1))
        });
      } else {
        othersImpact += c.impact;
        othersCount += c.count;
      }
    });

    if (othersImpact > 0) {
      finalClusters.push({
        name: 'OTROS REGISTROS (Varios)',
        impact: othersImpact,
        count: othersCount,
        discipline: 'MULTIDISCIPLINARIO',
        mainCause: 'VARIAS',
        percentage: Number(((othersImpact / totalImpactUniverse) * 100).toFixed(1))
      });
    }

    return { 
      clusters: finalClusters.sort((a, b) => b.impact - a.impact), 
      totalAnalyzed: summaryContext.totalOrders 
    };
  }, [viewMode, rawAnalytics, formatFilter, planFilter, summaryContext.totalImpact, summaryContext.totalOrders]);

  useEffect(() => {
    if (viewMode === 'recurring' && db) {
      const fetchSample = async () => {
        setIsLoadingRecurring(true);
        try {
          let q = query(collection(db, 'orders'), orderBy('impactoNeto', 'desc'), limit(500));
          if (yearFilter !== 'all') q = query(q, where('year', '==', Number(yearFilter)));
          const snap = await getDocs(q);
          setAnalyzedOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); } finally { setIsLoadingRecurring(false); }
      };
      fetchSample();
    }
  }, [viewMode, db, yearFilter]);

  const fetchClusterDetails = async (clusterName: string) => {
    if (!db) return;
    setIsFetchingClusterDetail(true);
    setSelectedRecurringCluster(clusterName);
    try {
      let q = query(
        collection(db, 'orders'), 
        where('subcausa_normalizada', '==', clusterName),
        orderBy('impactoNeto', 'desc'),
        limit(50)
      );
      
      if (yearFilter !== 'all') {
        q = query(q, where('year', '==', Number(yearFilter)));
      }

      const snap = await getDocs(q);
      setClusterDetailOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      
      toast({ 
        title: "Detalle Cargado", 
        description: `Se han recuperado los registros clave del cluster: ${clusterName}` 
      });

      // Scroll automático al detalle
      setTimeout(() => {
        const element = document.getElementById('cluster-detail-section');
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 300);

    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Error de Carga", description: e.message });
    } finally {
      setIsFetchingClusterDetail(false);
    }
  };

  const topPhrases = useMemo(() => {
    if (analyzedOrders.length === 0) return [];
    const phrases = new Map<string, { count: number, impact: number }>();
    const stopwords = new Set(['DE', 'LA', 'EL', 'EN', 'POR', 'QUE', 'LOS', 'LAS', 'UN', 'UNA', 'CON', 'NO', 'PARA', 'SE', 'DEL', 'AL', 'LO', 'SI', 'PORQUE', 'Y', 'O', 'A', 'N/A', 'SIN', 'CONTRATISTA', 'PARA', 'ESTA', 'SUS', 'SON', 'REALIZAR', 'SUMINISTRO', 'TRABAJOS', 'CAMBIO', 'OBRA', 'SOLICITUD', 'SEUN', 'SEGÚN', 'DEBIDO', 'ESTE', 'FUE', 'REALIZO', 'CORRESPONDIENTE']);
    
    analyzedOrders.forEach(o => {
      const desc = String(o.descripcion || '').toUpperCase();
      const words = desc.split(/[\s,.\-()]+/).filter(w => w.length > 2 && !stopwords.has(w));
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i+1]}`;
        if (!phrases.has(phrase)) phrases.set(phrase, { count: 0, impact: 0 });
        const p = phrases.get(phrase)!;
        p.count++;
        p.impact += Number(o.impactoNeto || 0);
      }
    });
    return Array.from(phrases.entries())
      .map(([phrase, data]) => ({ phrase, ...data, avgImpact: data.impact / data.count }))
      .filter(p => p.count > 2)
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 50);
  }, [analyzedOrders]);

  const geographyData = useMemo(() => {
    if (!rawAnalytics) return { states: [], municipalities: new Map<string, any[]>(), maxImpact: 0 };
    const stateMap = new Map<string, any>();
    const munMap = new Map<string, Map<string, any>>();
    let maxImpact = 0;
    rawAnalytics.forEach(d => {
      const matchFormat = formatFilter === 'all' || d.format === formatFilter;
      const matchPlan = planFilter === 'all' || d.plan === planFilter;
      if (matchFormat && matchPlan) {
        const state = d.state || 'CIUDAD DE MÉXICO';
        const mun = d.municipality || 'SIN MUNICIPIO';
        if (!stateMap.has(state)) stateMap.set(state, { name: state, impact: 0, count: 0 });
        const s = stateMap.get(state);
        s.impact += d.impact;
        s.count += d.count;
        if (s.impact > maxImpact) maxImpact = s.impact;
        if (!munMap.has(state)) munMap.set(state, new Map());
        const muns = munMap.get(state)!;
        if (!muns.has(mun)) muns.set(mun, { name: mun, impact: 0, count: 0 });
        const m = muns.get(mun);
        m.impact += d.impact;
        m.count += d.count;
      }
    });
    const finalMunMap = new Map<string, any[]>();
    munMap.forEach((muns, state) => finalMunMap.set(state, Array.from(muns.values()).sort((a, b) => b.impact - a.impact)));
    return { states: Array.from(stateMap.values()).sort((a, b) => b.impact - a.impact), municipalities: finalMunMap, maxImpact };
  }, [rawAnalytics, formatFilter, planFilter]);

  const handleGlobalAudit = async () => {
    if (!db) return;
    setIsGlobalAuditing(true);
    setGlobalAuditResult(null);
    try {
      let q = query(collection(db, 'orders'), orderBy('impactoNeto', 'desc'), limit(15));
      if (yearFilter !== 'all') q = query(q, where('year', '==', Number(yearFilter)));
      const snap = await getDocs(q);
      const sample = snap.docs.map(d => ({
        id: d.id,
        projectId: d.data().projectId || "N/A",
        impactoNeto: Number(d.data().impactoNeto || 0),
        causaRaiz: d.data().causa_raiz_normalizada || "Sin clasificar",
        isSigned: !!d.data().isSigned,
        appendixF: !!d.data().appendixF,
        descripcion: d.data().descripcion || "",
        semanticAnalysis: d.data().semanticAnalysis || null
      }));
      if (sample.length === 0) {
        toast({ title: "Sin datos", description: "No hay registros para auditar." });
        setIsGlobalAuditing(false);
        return;
      }
      const result = await detectAnomalies({ orders: sample });
      setGlobalAuditResult(result);
      toast({ title: "Auditoría Finalizada", description: "El motor forense ha procesado el universo seleccionado." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en Auditoría", description: e.message });
    } finally { setIsGlobalAuditing(false); }
  };

  const coordinatorData = useMemo(() => {
    if (!rawAnalytics) return [];
    const coordMap = new Map<string, any>();
    rawAnalytics.forEach(d => {
      const matchFormat = formatFilter === 'all' || d.format === formatFilter;
      const matchPlan = planFilter === 'all' || d.plan === planFilter;
      if (matchFormat && matchPlan && d.coordinator) {
        if (!coordMap.has(d.coordinator)) coordMap.set(d.coordinator, { name: d.coordinator, impact: 0, count: 0 });
        const c = coordMap.get(d.coordinator);
        c.impact += d.impact;
        c.count += d.count;
      }
    });
    return Array.from(coordMap.values()).sort((a, b) => b.impact - a.impact);
  }, [rawAnalytics, formatFilter, planFilter]);

  const planChartData = useMemo(() => {
    if (!rawAnalytics) return [];
    const planMap = new Map<string, any>();
    rawAnalytics.forEach(d => {
      const matchFormat = formatFilter === 'all' || d.format === formatFilter;
      const matchPlan = planFilter === 'all' || d.plan === planFilter;
      if (matchFormat && matchPlan && d.plan) {
        if (!planMap.has(d.plan)) planMap.set(d.plan, { name: d.plan, impact: 0, count: 0 });
        const p = planMap.get(d.plan);
        p.impact += d.impact;
        p.count += d.count;
      }
    });
    return Array.from(planMap.values()).sort((a, b) => b.impact - a.impact);
  }, [rawAnalytics, formatFilter, planFilter]);

  const top10BarData = useMemo(() => {
    if (!rawAnalytics || !activeChip) return [];
    const secondaryMap = new Map<string, any>();
    rawAnalytics.forEach(d => {
      const matchFormat = formatFilter === 'all' || d.format === formatFilter;
      const matchPlan = planFilter === 'all' || d.plan === planFilter;
      const chipKey = aggMode === 'cause' ? d.cause : d.discipline;
      const secondaryKey = aggMode === 'cause' ? d.discipline : d.cause;

      if (matchFormat && matchPlan && chipKey === activeChip) {
        if (secondaryMap.has(secondaryKey)) {
          const e = secondaryMap.get(secondaryKey);
          e.impact += Number(d.impact || 0);
          e.count += Number(d.count || 0);
        } else {
          secondaryMap.set(secondaryKey, { name: secondaryKey, impact: Number(d.impact || 0), count: Number(d.count || 0) });
        }
      }
    });
    return Array.from(secondaryMap.values()).sort((a, b) => b.impact - a.impact).slice(0, 10);
  }, [rawAnalytics, activeChip, aggMode, formatFilter, planFilter]);

  const groupedSubItems = useMemo(() => {
    if (!rawAnalytics || !activeChip || !selectedBar) return [];
    const subMap = new Map<string, any>();
    rawAnalytics.forEach(d => {
      const matchFormat = formatFilter === 'all' || d.format === formatFilter;
      const matchPlan = planFilter === 'all' || d.plan === planFilter;
      const chipKey = aggMode === 'cause' ? d.cause : d.discipline;
      const secondaryKey = aggMode === 'cause' ? d.discipline : d.cause;
      
      if (matchFormat && matchPlan && chipKey === activeChip && secondaryKey === selectedBar.name) {
        const subName = d.subcause || 'ADICIONALES Y TRABAJOS COMPLEMENTARIOS';
        if (subMap.has(subName)) {
          const e = subMap.get(subName);
          e.impact += Number(d.impact || 0);
          e.count += Number(d.count || 0);
        } else {
          subMap.set(subName, { name: subName, impact: Number(d.impact || 0), count: Number(d.count || 0), isSistemic: Number(d.count || 0) > 50 });
        }
      }
    });
    return Array.from(subMap.values()).sort((a, b) => b.impact - a.impact);
  }, [rawAnalytics, activeChip, selectedBar, aggMode, formatFilter, planFilter]);

  const handleExploreDetails = (causeName: string) => {
    setViewMode('analytical');
    setAggMode('cause');
    setActiveChip(causeName);
    setSelectedBar(null);
  };

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length) {
      setSelectedBar(data.activePayload[0].payload);
      setSelectedSubBar(null);
      setEvidenceData([]);
    }
  };

  const fetchEvidence = async (secondary: string, sub: string, isOthers: boolean, names?: string[]) => {
    if (!db || !activeChip) return;
    setIsLoadingDetail(true);
    setEvidenceData([]);
    try {
      let q = query(
        collection(db, 'orders'),
        where(aggMode === 'cause' ? 'causa_raiz_normalizada' : 'disciplina_normalizada', '==', activeChip),
        where(aggMode === 'cause' ? 'disciplina_normalizada' : 'causa_raiz_normalizada', '==', secondary),
        where('subcausa_normalizada', '==', sub),
        orderBy('impactoNeto', 'desc'),
        limit(20)
      );
      const snap = await getDocs(q);
      setEvidenceData(snap.docs.map(d => ({ ...d.data() })));
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Fallo de Carga", description: "No se pudo obtener el lote de evidencia." });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between border-b bg-white px-8 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-6">
            <SidebarTrigger />
            <div className="flex flex-col">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter font-headline flex items-center gap-3">
                <LayoutDashboard className="h-6 w-6 text-primary" />
                Dashboard Ejecutivo VP
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                Visualización Multi-nivel • Sincronización SSOT Activa
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border mr-4 overflow-x-auto max-w-[800px] scrollbar-hide">
              {[
                { id: 'analytical', label: 'Analítico' },
                { id: 'executive', label: 'Ejecutivo' },
                { id: 'coordinator', label: 'Por Coordinador' },
                { id: 'geography', label: 'Por Estado/Mun' },
                { id: 'recurring', label: 'Causas Recurrentes' }
              ].map((m) => (
                <Button 
                  key={m.id}
                  variant={viewMode === m.id ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setViewMode(m.id as any)}
                  className={`h-8 text-[10px] font-black uppercase px-4 rounded-xl transition-all ${viewMode === m.id ? 'bg-primary shadow-lg text-white' : 'text-slate-500'}`}
                >
                  {m.label}
                </Button>
              ))}
            </div>

            <Separator orientation="vertical" className="h-8 mx-2" />

            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <CalendarDays className="h-4 w-4 text-slate-400 ml-2" />
              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger className="h-9 w-32 bg-transparent border-none text-[10px] font-black uppercase shadow-none focus:ring-0">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS AÑOS</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <Target className="h-4 w-4 text-slate-400 ml-2" />
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="h-9 w-32 bg-transparent border-none text-[10px] font-black uppercase shadow-none focus:ring-0">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS PLANES</SelectItem>
                  {availablePlans?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <Filter className="h-4 w-4 text-slate-400 ml-2" />
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger className="h-9 w-32 bg-transparent border-none text-[10px] font-black uppercase shadow-none focus:ring-0">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODOS LOS FORMATOS</SelectItem>
                  {availableFormats?.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

        <main className="p-8 space-y-10 max-w-[1600px] mx-auto w-full pb-40">
          
          {viewMode === 'recurring' ? (
            <div className="space-y-12 animate-in fade-in zoom-in duration-700">
              <div className="bg-white rounded-3xl border shadow-xl p-8 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><MessageSquareText className="h-32 w-32" /></div>
                <div className="flex items-center gap-6 relative z-10">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <BrainCircuit className="h-10 w-10" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter font-headline">Causas Recurrentes en Descripciones</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Análisis Semántico + Extracción de Patrones (NLP) • Universo Completo</p>
                  </div>
                </div>
                <div className="flex items-center gap-12 relative z-10">
                  <div className="text-right">
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">{recurringData.totalAnalyzed.toLocaleString()}</p>
                    <p className="text-[10px] font-black uppercase text-slate-400">Registros en Análisis</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-primary tracking-tighter">{recurringData.clusters.length}</p>
                    <p className="text-[10px] font-black uppercase text-slate-400">Clusters Detectados</p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-emerald-600 tracking-tighter">{topPhrases.length}</p>
                    <p className="text-[10px] font-black uppercase text-slate-400">Patrones de Impacto</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border w-fit">
                <Button 
                  variant={recurringSubTab === 'clusters' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setRecurringSubTab('clusters')}
                  className={`h-10 text-[10px] font-black uppercase px-6 rounded-xl transition-all gap-2 ${recurringSubTab === 'clusters' ? 'bg-primary shadow-lg text-white' : 'text-slate-500'}`}
                >
                  <Layers className="h-4 w-4" /> Clusters de Ineficiencia
                </Button>
                <Button 
                  variant={recurringSubTab === 'phrases' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setRecurringSubTab('phrases')}
                  className={`h-10 text-[10px] font-black uppercase px-6 rounded-xl transition-all gap-2 ${recurringSubTab === 'phrases' ? 'bg-primary shadow-lg text-white' : 'text-slate-500'}`}
                >
                  <TextSearch className="h-4 w-4" /> Patrones de Texto (NLP)
                </Button>
                <Button 
                  variant={recurringSubTab === 'details' ? 'default' : 'ghost'} 
                  size="sm" 
                  onClick={() => setRecurringSubTab('details')}
                  className={`h-10 text-[10px] font-black uppercase px-6 rounded-xl transition-all gap-2 ${recurringSubTab === 'details' ? 'bg-primary shadow-lg text-white' : 'text-slate-500'}`}
                >
                  <FileText className="h-4 w-4" /> Detalle Forense
                </Button>
              </div>

              {recurringSubTab === 'clusters' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="border-none shadow-xl bg-white rounded-[2rem] p-8">
                      <CardHeader className="p-0 mb-8">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-3">
                          <TrendingUp className="h-5 w-5 text-primary" /> Frecuencia de Incidencias Técnicas
                        </CardTitle>
                      </CardHeader>
                      <div className="h-[650px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={recurringData.clusters} layout="vertical" margin={{ left: 240, right: 30, top: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis 
                              type="category" 
                              dataKey="name" 
                              tick={{ fontSize: 7, fontWeight: '900', fill: '#1e293b' }} 
                              width={230} 
                              axisLine={false} 
                              tickLine={false} 
                            />
                            <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                            <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={15}>
                              {recurringData.clusters.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={RECURRING_COLORS[index % RECURRING_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>

                    <Card className="border-none shadow-xl bg-white rounded-[2rem] p-8">
                      <CardHeader className="p-0 mb-8">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800 flex items-center gap-3">
                          <Activity className="h-5 w-5 text-emerald-500" /> Distribución Impacto (%)
                        </CardTitle>
                      </CardHeader>
                      <div className="h-[650px] flex flex-col items-center">
                        <ResponsiveContainer width="100%" height="90%">
                          <PieChart>
                            <Pie
                              data={recurringData.clusters}
                              dataKey="impact"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={80}
                              outerRadius={160}
                              paddingAngle={1}
                              stroke="#fff"
                              strokeWidth={1}
                              label={false}
                            >
                              {recurringData.clusters.map((entry, index) => (
                                <Cell key={`cell-pie-${index}`} fill={RECURRING_COLORS[index % RECURRING_COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '7px', fontWeight: 'bold', textTransform: 'uppercase', maxHeight: '100%', overflowY: 'auto', paddingLeft: '20px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </Card>
                  </div>

                  <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-slate-900 text-white p-8">
                      <CardTitle className="text-lg font-black uppercase tracking-tight">Vínculo: Subcausas Técnicas vs. Causa Raíz Maestra</CardTitle>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Haz clic en un clúster para ver el detalle de sus registros</p>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase w-12 text-center">#</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Cluster / Driver Detectado</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Causa Raíz Predominante</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-center">Registros</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-center">% Impacto</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-right pr-8">Impacto Neto (M)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recurringData.clusters.map((c, i) => (
                            <TableRow 
                              key={i} 
                              className={`hover:bg-primary/5 transition-all border-b cursor-pointer ${selectedRecurringCluster === c.name ? 'bg-primary/10' : ''}`}
                              onClick={() => fetchClusterDetails(c.name)}
                            >
                              <TableCell className="text-center font-black text-slate-300">{i + 1}</TableCell>
                              <TableCell className="font-bold text-xs text-slate-800 uppercase flex items-center gap-2">
                                {c.name}
                                {selectedRecurringCluster === c.name && <MousePointerClick className="h-3 w-3 text-primary animate-pulse" />}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[8px] font-black uppercase ${CAUSE_COLORS[c.mainCause] || 'border-slate-200'}`}>
                                  {c.mainCause}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-xs font-medium text-slate-500">{c.count}</TableCell>
                              <TableCell className="text-center">
                                <span className="text-[10px] font-black text-emerald-600">{c.percentage}%</span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-bold text-primary pr-8">{formatCurrency(c.impact)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Detalle del Cluster Seleccionado */}
                  {selectedRecurringCluster && (
                    <Card id="cluster-detail-section" className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden animate-in slide-in-from-bottom-4 duration-500 border-t-4 border-t-primary">
                      <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-widest flex items-center gap-3">
                            <Database className="h-5 w-5 text-primary" /> Análisis Detallado: {selectedRecurringCluster}
                          </CardTitle>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Registros clave que impulsan el impacto financiero de este cluster</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedRecurringCluster(null)}>
                          <X className="h-5 w-5 text-slate-400" />
                        </Button>
                      </CardHeader>
                      <CardContent className="p-0">
                        {isFetchingClusterDetail ? (
                          <div className="h-60 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando evidencia forense...</p>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader className="bg-slate-50/50">
                              <TableRow>
                                <TableHead className="text-[10px] font-black uppercase pl-8">PID / Proyecto</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Disciplina</TableHead>
                                <TableHead className="text-[10px] font-black uppercase">Narrativa Original</TableHead>
                                <TableHead className="text-[10px] font-black uppercase text-right pr-8">Impacto Neto</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {clusterDetailOrders.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={4} className="h-40 text-center text-[10px] font-black text-slate-300 uppercase">Sin registros detectados en este filtro.</TableCell>
                                </TableRow>
                              ) : clusterDetailOrders.map((order, i) => (
                                <TableRow key={i} className="hover:bg-slate-50/50 transition-colors">
                                  <TableCell className="pl-8 py-4">
                                    <div className="space-y-0.5">
                                      <p className="text-xs font-black text-primary">{order.projectId}</p>
                                      <p className="text-[10px] text-slate-400 uppercase font-bold truncate max-w-[150px]">{order.projectName || 'N/A'}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[8px] font-black uppercase">{order.disciplina_normalizada || 'OTRO'}</Badge>
                                  </TableCell>
                                  <TableCell className="max-w-[500px]">
                                    <p className="text-[11px] text-slate-600 italic leading-relaxed line-clamp-2">"{order.descripcion}"</p>
                                  </TableCell>
                                  <TableCell className="text-right pr-8 font-mono font-bold text-slate-900">{formatCurrency(order.impactoNeto)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                        <div className="p-6 bg-slate-50 border-t text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Visualizando los 50 registros de mayor impacto para este cluster • Sincronización SSOT Activa</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {recurringSubTab === 'phrases' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {topPhrases.slice(0, 12).map((p, i) => (
                      <Card key={i} className="border-none shadow-lg bg-white rounded-2xl p-6 group hover:shadow-2xl transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary font-black text-xs">#{i+1}</div>
                          <Badge className="bg-rose-50 text-rose-600 border-none uppercase text-[8px] font-black">Driver Detectado</Badge>
                        </div>
                        <h4 className="text-sm font-black text-slate-800 uppercase leading-tight mb-4 min-h-[40px]">{p.phrase}</h4>
                        <Separator className="mb-4" />
                        <div className="flex justify-between items-end">
                           <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">Impacto en Red</p>
                              <p className="text-sm font-black text-slate-900">{formatCurrency(p.impact)}</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase">Frecuencia</p>
                              <p className="text-xs font-bold text-primary">{p.count} veces</p>
                           </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b p-8 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-widest flex items-center gap-3">
                          <ListFilter className="h-5 w-5 text-primary" /> Inventario de Patrones Lingüísticos Forenses
                        </CardTitle>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Detección de ineficiencias a través de bi-gramas en el universo analizado</p>
                      </div>
                      {isLoadingRecurring && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase pl-8">Patrón de Texto Detectado</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-center">Incidencias</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-right">Impacto Financiero Acumulado</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-right">Costo Promedio / Evento</TableHead>
                            <TableHead className="text-[10px] font-black uppercase pr-8 text-center">Nivel de Alerta</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {topPhrases.map((p, i) => {
                            const isCritical = p.impact > 15000000;
                            return (
                              <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                                <TableCell className="pl-8 py-4 font-bold text-xs text-slate-700">{p.phrase}</TableCell>
                                <TableCell className="text-center font-black text-primary">{p.count}</TableCell>
                                <TableCell className="text-right font-mono font-bold text-slate-900">{formatCurrency(p.impact)}</TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold text-slate-500">{formatCurrency(p.avgImpact)}</TableCell>
                                <TableCell className="pr-8 text-center">
                                  {isCritical ? (
                                    <Badge className="bg-rose-600 text-white text-[8px] font-black uppercase">Crítico 80/20</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200">Operativo</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {recurringSubTab === 'details' && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <Card className="border-none shadow-2xl bg-white rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b p-8">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">Buscador Forense de Narrativas Técnicas</CardTitle>
                        <div className="flex gap-4">
                           <div className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl shadow-sm">
                             <Search className="h-4 w-4 text-slate-400" />
                             <input type="text" placeholder="Buscar palabras clave (ej. ROCA, UVIE, PCI)..." className="text-[10px] font-bold uppercase outline-none w-80 bg-transparent" />
                           </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                       <Table>
                         <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px] font-black uppercase pl-8">Folio PID</TableHead>
                              <TableHead className="text-[10px] font-black uppercase">Descripción Original del Cambio</TableHead>
                              <TableHead className="text-[10px] font-black uppercase">Clasificación Estratégica</TableHead>
                              <TableHead className="text-[10px] font-black uppercase text-right pr-8">Impacto Neto</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                            {analyzedOrders.slice(0, 100).map((o, i) => (
                              <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                                <TableCell className="pl-8 font-black text-primary text-xs">{o.projectId}</TableCell>
                                <TableCell className="max-w-[600px]">
                                  <p className="text-[11px] text-slate-600 italic leading-relaxed line-clamp-2">"{o.descripcion}"</p>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[8px] font-black uppercase">{o.subcausa_normalizada || 'SIN CLASIFICAR'}</Badge>
                                </TableCell>
                                <TableCell className="text-right pr-8 font-mono font-bold text-slate-900">{formatCurrency(o.impactoNeto)}</TableCell>
                              </TableRow>
                            ))}
                         </TableBody>
                       </Table>
                       <div className="p-8 border-t bg-slate-50/50 text-center">
                         <p className="text-[10px] font-black text-slate-400 uppercase">Visualizando muestra de los registros más impactantes • Sincronización SSOT Verificada</p>
                       </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          ) : viewMode === 'executive' ? (
            <div className="space-y-12 animate-in fade-in zoom-in duration-700">
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="p-8 border-none shadow-xl bg-white border-l-4 border-l-primary rounded-3xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Impacto Auditado</p>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{formatCurrency(summaryContext.totalImpact)}</h2>
                  <p className="text-[9px] text-emerald-600 font-bold uppercase mt-2 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Base de Datos Homologada</p>
                </Card>
                <Card className="p-8 border-none shadow-xl bg-white border-l-4 border-l-emerald-500 rounded-3xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Volumen de Órdenes</p>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{summaryContext.totalOrders.toLocaleString()}</h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">Registros únicos procesados</p>
                </Card>
                <Card className="p-8 border-none shadow-xl bg-white border-l-4 border-l-amber-500 rounded-3xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Divergencia Semántica</p>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">18.4%</h2>
                  <p className="text-[9px] text-rose-500 font-bold uppercase mt-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Foco en Sub-causas</p>
                </Card>
                <Card className="p-8 border-none shadow-xl bg-white border-l-4 border-l-indigo-500 rounded-3xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Especialidades Activas</p>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">12</h2>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-2">Categorías técnicas mapeadas</p>
                </Card>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                      <Target className="h-6 w-6 text-primary" /> Categorías de Causa Raíz (Homologadas)
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Catálogo maestro de 10 pilares estratégicos</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  {summaryContext.chips.map((cause, i) => {
                    const Icon = CAUSE_ICONS[cause.name] || Info;
                    const colorClasses = CAUSE_COLORS[cause.name] || "text-slate-600 border-slate-200";
                    
                    return (
                      <Card 
                        key={i} 
                        className="border-none shadow-lg bg-white rounded-2xl overflow-hidden group hover:shadow-2xl transition-all cursor-pointer active:scale-95"
                        onClick={() => handleExploreDetails(cause.name)}
                      >
                        <div className="p-6 space-y-4">
                          <div className="flex justify-between items-start">
                            <div className={`p-2.5 rounded-xl bg-slate-50 border ${colorClasses} group-hover:bg-primary group-hover:text-white transition-colors`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <span className="text-[9px] font-black text-slate-300 group-hover:text-primary">#{i+1}</span>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-black text-slate-800 uppercase leading-tight mb-1 truncate">{cause.name}</h4>
                            <p className="text-[10px] font-bold text-primary">{cause.percentage}% del Capex</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-lg font-black text-slate-900 tracking-tighter">{formatCurrency(cause.impact)}</p>
                            <p className="text-[8px] font-black text-slate-400 uppercase">{cause.count} REGISTROS</p>
                          </div>
                          <Separator className="bg-slate-100" />
                          <p className="text-[9px] text-slate-500 leading-tight italic line-clamp-3 min-h-[36px]">
                            {CAUSE_DESCRIPTIONS[cause.name] || "Sin descripción disponible."}
                          </p>
                          <Button variant="ghost" className="w-full h-8 text-[8px] font-black uppercase gap-2 group-hover:bg-primary/5">
                            Validar Evidencia <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-900 p-12 rounded-[4rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:20px_20px] opacity-30" />
                <div className="space-y-4 relative z-10 text-center md:text-left">
                  <Badge className="bg-primary text-white border-none px-4 py-1 uppercase text-[10px] font-black tracking-[0.2em]">Pareto Global</Badge>
                  <h3 className="text-5xl font-headline font-bold tracking-tight">Directriz de Prevención Estratégica</h3>
                  <p className="text-slate-400 max-w-2xl font-medium leading-relaxed">
                    Si se ejecutan los planes de mitigación sobre los <span className="text-white font-black underline decoration-primary decoration-4 underline-offset-4">Vital Few</span> (Top 3 causas), el ahorro proyectado de variabilidad es del 22%.
                  </p>
                </div>
                <div className="flex flex-col items-center md:items-end gap-4 relative z-10">
                   <Button 
                    onClick={handleGlobalAudit} 
                    disabled={isGlobalAuditing}
                    className="bg-primary hover:bg-primary/90 text-white rounded-2xl gap-3 h-16 px-10 text-xs font-black uppercase tracking-widest shadow-2xl group transition-all"
                   >
                     {isGlobalAuditing ? <Loader2 className="h-5 w-5 animate-spin" /> : <BrainCircuit className="h-5 w-5 group-hover:scale-125 transition-transform" />}
                     Ejecutar Auditoría Global
                   </Button>
                   <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                     <Clock className="h-3 w-3" /> Último escaneo: {new Date().toLocaleDateString()}
                   </div>
                </div>
              </div>
            </div>
          ) : viewMode === 'coordinator' ? (
            <div className="space-y-8 animate-in fade-in duration-500">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <Card className="border-none shadow-xl bg-white rounded-[2rem] p-8">
                    <CardHeader className="p-0 mb-8">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">Rendimiento por Coordinación</CardTitle>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Impacto Financiero vs. Volumen de Órdenes</p>
                        </div>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[8px] font-black uppercase">KPI: EFICIENCIA</Badge>
                      </div>
                    </CardHeader>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={coordinatorData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 8, fontWeight: '900', fill: '#64748b' }} 
                            height={60} 
                            interval={0} 
                            angle={-25} 
                            textAnchor="end" 
                          />
                          <YAxis yAxisId="left" tick={{ fontSize: 10, fontWeight: 'bold' }} tickFormatter={(v) => `$${v/1000000}M`} axisLine={false} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#FF8F00', fontWeight: 'bold' }} axisLine={false} />
                          <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                          <Bar yAxisId="left" dataKey="impact" radius={[10, 10, 0, 0]} barSize={40} fill="#2962FF" />
                          <Line yAxisId="right" type="monotone" dataKey="count" stroke="#FF8F00" strokeWidth={4} dot={{ r: 4, fill: '#FF8F00' }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                 </Card>

                 <Card className="border-none shadow-xl bg-white rounded-[2rem] p-8">
                    <CardHeader className="p-0 mb-8">
                      <div className="flex justify-between items-end">
                        <div className="space-y-1">
                          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">Impacto por Plan Maestro</CardTitle>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Fuga de capital por estrategia de inversión</p>
                        </div>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[8px] font-black uppercase">KPI: PLANEACIÓN</Badge>
                      </div>
                    </CardHeader>
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={planChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 8, fontWeight: '900', fill: '#64748b' }} 
                            height={60} 
                            interval={0} 
                            angle={-25} 
                            textAnchor="end" 
                          />
                          <YAxis yAxisId="left" tick={{ fontSize: 10, fontWeight: 'bold' }} tickFormatter={(v) => `$${v/1000000}M`} axisLine={false} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#10B981', fontWeight: 'bold' }} axisLine={false} />
                          <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                          <Bar yAxisId="left" dataKey="impact" radius={[10, 10, 0, 0]} barSize={40} fill="#6366F1" />
                          <Line yAxisId="right" type="monotone" dataKey="count" stroke="#10B981" strokeWidth={4} dot={{ r: 4, fill: '#10B981' }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                 </Card>
               </div>
            </div>
          ) : viewMode === 'geography' ? (
            <div className="space-y-12 animate-in fade-in zoom-in duration-700">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                 <Card className="lg:col-span-8 border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden min-h-[700px] flex flex-col relative group">
                   <CardHeader className="bg-slate-50 border-b p-8">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <CardTitle className="text-sm font-black uppercase text-slate-800 tracking-widest flex items-center gap-3">
                            <Globe className="h-6 w-6 text-primary" /> Mapa de México (Intensidad de Impacto)
                          </CardTitle>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Navegación detallada con delimitaciones estatales</p>
                        </div>
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-primary" /><span className="text-[8px] font-black uppercase text-slate-400">Bajo</span></div>
                           <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-amber-500" /><span className="text-[8px] font-black uppercase text-slate-400">Medio</span></div>
                           <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-rose-600" /><span className="text-[8px] font-black uppercase text-slate-400">Crítico</span></div>
                        </div>
                      </div>
                   </CardHeader>

                   <CardContent className="flex-1 relative p-0 bg-white cursor-crosshair overflow-hidden">
                     <ComposableMap
                        projection="geoMercator"
                        projectionConfig={{ scale: 1200, center: [-102, 24] }}
                        className="w-full h-full"
                      >
                        <ZoomableGroup zoom={1} center={[-102, 24]} minZoom={1} maxZoom={4}>
                          <Geographies geography={GEO_URL}>
                            {({ geographies }) =>
                              geographies.map((geo) => {
                                const stateName = (geo.properties.name || geo.properties.NAME || geo.properties.estado || geo.properties.nombre)?.toUpperCase();
                                const isSelected = selectedState === stateName;
                                return (
                                  <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    onMouseEnter={() => {}}
                                    onClick={() => setSelectedState(stateName)}
                                    style={{
                                      default: { fill: isSelected ? "#E2E8F0" : "#F1F5F9", stroke: "#94A3B8", strokeWidth: 0.5, outline: "none" },
                                      hover: { fill: "#CBD5E1", stroke: "#64748B", strokeWidth: 1, outline: "none", cursor: "pointer" },
                                      pressed: { fill: "#94A3B8", stroke: "#475569", strokeWidth: 1, outline: "none" },
                                    }}
                                  />
                                );
                              })
                            }
                          </Geographies>

                          {geographyData.states.map((state) => {
                            const coords = STATE_MARKERS[state.name];
                            if (!coords) return null;
                            const intensity = state.impact / (geographyData.maxImpact || 1);
                            const circleSize = 10 + (intensity * 40 * mapScale);
                            const circleColor = intensity > 0.8 ? '#E11D48' : intensity > 0.4 ? '#F97316' : '#2962FF';
                            
                            return (
                              <Marker key={state.name} coordinates={coords as [number, number]}>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <g className="cursor-pointer transition-all duration-300 hover:scale-125" onClick={() => setSelectedState(state.name)}>
                                        <circle r={circleSize} fill={circleColor} fillOpacity={0.6} stroke="#fff" strokeWidth={2} className="animate-in fade-in zoom-in" />
                                        <circle r={circleSize * 0.4} fill={circleColor} stroke="#fff" strokeWidth={1} />
                                        {mapScale > 0.5 && state.impact > 10000000 && (
                                          <text y={circleSize + 15} textAnchor="middle" className="text-[10px] font-black uppercase fill-slate-800 pointer-events-none">{state.name.substring(0, 12)}</text>
                                        )}
                                      </g>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-900 text-white p-3 rounded-xl border-none shadow-2xl">
                                      <p className="text-[10px] font-black uppercase mb-1">{state.name}</p>
                                      <p className="text-xs font-bold">{formatCurrency(state.impact)}</p>
                                      <p className="text-[8px] font-medium text-slate-400 uppercase">{state.count} Órdenes de Cambio</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </Marker>
                            );
                          })}
                        </ZoomableGroup>
                     </ComposableMap>

                     <div className="absolute bottom-8 left-8 w-64 space-y-4 bg-white/80 backdrop-blur-xl p-6 rounded-[2.5rem] border shadow-2xl animate-in slide-in-from-bottom-4 duration-700">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Volumen de Impacto</span>
                          <span className="text-[10px] font-black text-primary">{Math.round(mapScale * 100)}%</span>
                        </div>
                        <Slider 
                          value={[mapScale]} 
                          max={2} 
                          min={0.1} 
                          step={0.1} 
                          onValueChange={(val) => setMapScale(val[0])} 
                          className="cursor-pointer"
                        />
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase">
                          <span>Analítico</span>
                          <span>Forense</span>
                        </div>
                     </div>
                   </CardContent>
                 </Card>

                 <div className="lg:col-span-4 space-y-8">
                   <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden flex flex-col h-[400px]">
                     <CardHeader className="p-8 bg-slate-900 text-white">
                        <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-3">
                          <Focus className="h-5 w-5" /> Foco Regional: {selectedState || 'Seleccione'}
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-0 flex-1">
                        <ScrollArea className="h-full">
                           <div className="p-8 space-y-4">
                              {geographyData.municipalities.get(selectedState || '')?.slice(0, 15).map((m, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-primary/20 transition-all group">
                                   <div className="space-y-0.5">
                                      <p className="text-[10px] font-black text-slate-700 uppercase group-hover:text-primary transition-colors">{m.name}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase">{m.count} registros</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-xs font-black text-slate-900">{formatCurrency(m.impact)}</p>
                                      <Progress value={(m.impact / (geographyData.maxImpact || 1)) * 100} className="h-1 mt-1.5" />
                                   </div>
                                </div>
                              ))}
                           </div>
                        </ScrollArea>
                     </CardContent>
                   </Card>
                 </div>
               </div>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in zoom-in duration-700">
              <div className="flex items-center justify-between border-b pb-8">
                <div className="space-y-2">
                  <h3 className="text-4xl font-headline font-bold text-slate-900 tracking-tight uppercase">Concentración por {aggMode === 'cause' ? 'Causa Raíz' : 'Especialidad'}</h3>
                </div>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border shadow-inner">
                  <Button 
                    variant={aggMode === 'cause' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => { setAggMode('cause'); setActiveChip(null); setSelectedBar(null); }}
                    className={`h-10 text-[10px] font-black uppercase px-6 rounded-xl transition-all ${aggMode === 'cause' ? 'bg-white text-primary shadow-md' : 'text-slate-500'}`}
                  >
                    Por Causa Raíz
                  </Button>
                  <Button 
                    variant={aggMode === 'discipline' ? 'default' : 'ghost'} 
                    size="sm" 
                    onClick={() => { setAggMode('discipline'); setActiveChip(null); setSelectedBar(null); }}
                    className={`h-10 text-[10px] font-black uppercase px-6 rounded-xl transition-all ${aggMode === 'discipline' ? 'bg-white text-primary shadow-md' : 'text-slate-500'}`}
                  >
                    Por Especialidad
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                {summaryContext.chips.slice(0, 10).map((chip, i) => (
                  <Card 
                    key={i} 
                    onClick={() => { setActiveChip(chip.name); setSelectedBar(null); }}
                    className={`p-6 cursor-pointer transition-all duration-300 rounded-[2rem] border-2 relative overflow-hidden group shadow-lg ${activeChip === chip.name ? 'border-primary bg-primary/5 scale-[1.02] ring-8 ring-primary/5 shadow-2xl' : 'border-white hover:border-slate-200 bg-white hover:shadow-xl'}`}
                  >
                    <div className="flex flex-col h-full justify-between gap-6 relative z-10">
                      <div>
                        <Badge variant="outline" className={`mb-3 border-none bg-slate-100 text-[8px] font-black uppercase px-2 py-0.5 ${activeChip === chip.name ? 'bg-primary text-white' : 'text-slate-500'}`}>Ranking #{i+1}</Badge>
                        <h4 className="text-[10px] font-black text-slate-800 uppercase leading-tight group-hover:text-primary transition-colors truncate">{chip.name}</h4>
                      </div>
                      <div className="space-y-1">
                        <p className="text-2xl font-black text-slate-900 tracking-tighter tabular-nums">{formatCurrency(chip.impact)}</p>
                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-slate-400">
                          <span>{chip.count} REG.</span>
                          <span className={activeChip === chip.name ? 'text-primary' : ''}>{chip.percentage}% del Capex</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <Card className="lg:col-span-8 border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden flex flex-col group">
                  <CardHeader className="bg-slate-50/50 border-b p-10 flex flex-row items-end justify-between">
                    <div className="space-y-2">
                      <h3 className="text-3xl font-headline font-bold text-slate-800 uppercase tracking-tighter">Explorador de {aggMode === 'cause' ? 'Disciplinas' : 'Causas'}</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest ml-16">Drill-down: {activeChip || 'Seleccione una categoría superior'}</p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-10 flex-1 min-h-[500px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={top10BarData} margin={{ top: 20, right: 30, left: 60, bottom: 60 }} onClick={handleBarClick}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 9, fontWeight: '900', fill: '#1e293b' }} 
                          height={100} 
                          interval={0} 
                          angle={-35} 
                          textAnchor="end" 
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fontWeight: 'bold', fill: '#64748b' }} 
                          tickFormatter={(v) => `$${v/1000000}M`} 
                          axisLine={false} 
                        />
                        <RechartsTooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                        <Bar dataKey="impact" radius={[12, 12, 0, 0]} barSize={50} className="cursor-pointer">
                          {top10BarData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={selectedBar?.name === entry.name ? '#2962FF' : '#E2E8F0'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="lg:col-span-4">
                  <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden flex flex-col h-[600px] border-l-4 border-l-primary">
                    <CardHeader className="bg-slate-900 text-white p-8">
                      <CardTitle className="text-xs font-black uppercase text-accent tracking-[0.2em] flex items-center gap-3">
                        <Zap className="h-5 w-5" /> Sub-causas Detectadas
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                      <ScrollArea className="h-full">
                        <div className="p-8 space-y-4">
                          {selectedBar ? (
                            groupedSubItems.map((sub, i) => (
                              <div 
                                key={i} 
                                onClick={() => {
                                  setSelectedSubBar(sub.name);
                                  fetchEvidence(selectedBar.name, sub.name, false);
                                }}
                                className={`p-5 rounded-3xl border-2 transition-all cursor-pointer ${selectedSubBar === sub.name ? 'bg-primary border-primary text-white shadow-xl scale-[1.02]' : 'bg-slate-50 border-transparent hover:border-slate-100 hover:bg-white'}`}
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <div className="space-y-1">
                                    <p className={`text-[10px] font-black uppercase leading-tight ${selectedSubBar === sub.name ? 'text-white' : 'text-slate-700'}`}>{sub.name}</p>
                                    <span className={`text-[9px] font-bold ${selectedSubBar === sub.name ? 'text-white/80' : 'text-slate-400'}`}>{sub.count} REGISTROS</span>
                                  </div>
                                  <p className={`text-sm font-black tabular-nums ${selectedSubBar === sub.name ? 'text-white' : 'text-slate-900'}`}>{formatCurrency(sub.impact)}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-20 text-center text-[10px] font-black text-slate-300 uppercase">Seleccione una barra para ver sub-causas.</div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {selectedSubBar && (
                <Card className="border-none shadow-2xl bg-white rounded-[3rem] overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b p-10">
                    <CardTitle className="text-xl font-headline font-bold text-slate-800 uppercase flex items-center gap-3">
                      <Database className="h-6 w-6 text-primary" /> Evidencia Forense: {selectedSubBar}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase pl-10">Folio PID</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Proyecto</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Narrativa</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-right pr-10">Impacto Neto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingDetail ? (
                          <TableRow><TableCell colSpan={4} className="h-40 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></TableCell></TableRow>
                        ) : evidenceData.map((order, i) => (
                          <TableRow key={i}>
                            <TableCell className="pl-10 font-bold text-xs text-primary">{order.projectId}</TableCell>
                            <TableCell className="text-[10px] font-black text-slate-600 uppercase">{order.projectName || 'N/A'}</TableCell>
                            <TableCell className="text-[11px] text-slate-700 italic line-clamp-2 max-w-[500px]">"{order.descripcion}"</TableCell>
                            <TableCell className="text-right pr-10 font-mono font-bold">{formatCurrency(order.impactoNeto)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>

        <footer className="p-12 border-t bg-white flex justify-between items-center opacity-60">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Walmart Real Estate Forensic Unit • Confidential • 2024</span>
          </div>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>SSOT Verified</span>
            <span>Protocol v4.5.0-Executive</span>
          </div>
        </footer>
      </SidebarInset>

      <Dialog open={!!globalAuditResult} onOpenChange={() => setGlobalAuditResult(null)}>
        <DialogContent className="sm:max-w-[800px] rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl bg-white text-slate-900">
          <DialogHeader className="bg-slate-900 text-white p-10">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <Badge className="bg-primary text-white border-none uppercase text-[10px] font-black tracking-widest">Reporte Forense Ejecutivo</Badge>
                <DialogTitle className="text-4xl font-headline font-bold text-white tracking-tight">Resultado de Auditoría Global</DialogTitle>
              </div>
              <ShieldAlert className="h-16 w-16 text-white/10" />
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="p-10 space-y-10">
              <div className="flex items-center justify-between bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Health Score del Presupuesto</p>
                  <h4 className="text-6xl font-black text-slate-900 tracking-tighter">{globalAuditResult?.globalHealthScore}<span className="text-xl text-slate-300 ml-2">/100</span></h4>
                </div>
                <div className="text-right space-y-2">
                  <Badge className={`uppercase text-[10px] font-black px-4 py-1 rounded-lg ${Number(globalAuditResult?.globalHealthScore) > 70 ? 'bg-emerald-500' : 'bg-rose-500'} text-white`}>
                    {Number(globalAuditResult?.globalHealthScore) > 70 ? 'GESTIÓN ÓPTIMA' : 'RIESGO DE VARIABILIDAD'}
                  </Badge>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">ANÁLISIS SEMÁNTICO COMPLETADO</p>
                </div>
              </div>

              <div className="space-y-4">
                 <h5 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-3"><Info className="h-4 w-4" /> Resumen del Auditor IA</h5>
                 <p className="text-sm text-slate-600 leading-relaxed italic font-medium bg-primary/5 p-6 rounded-3xl border border-primary/10">"{globalAuditResult?.summary}"</p>
              </div>

              <div className="space-y-6">
                <h5 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] flex items-center gap-3"><AlertTriangle className="h-4 w-4" /> Anomalías Detectadas</h5>
                <div className="grid gap-4">
                  {globalAuditResult?.anomalies.map((a, i) => (
                    <Card key={i} className="border-none shadow-md bg-white border-l-4 border-l-rose-500 rounded-2xl overflow-hidden">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <Badge variant="outline" className="text-[8px] font-black uppercase mb-1">{a.type}</Badge>
                            <h6 className="text-sm font-black text-slate-900 uppercase leading-tight">{a.finding}</h6>
                          </div>
                          <Badge className="bg-rose-100 text-rose-600 border-none text-[8px] font-black">PID: {a.projectId}</Badge>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                           <div className="space-y-1">
                              <p className="text-[9px] font-black text-slate-400 uppercase">Razonamiento Forense</p>
                              <p className="text-[11px] text-slate-600 leading-tight italic">"{a.reasoning}"</p>
                           </div>
                           <div className="space-y-1">
                              <p className="text-[9px] font-black text-emerald-600 uppercase">Acción Sugerida</p>
                              <p className="text-[11px] text-slate-800 font-bold leading-tight uppercase">{a.recommendation}</p>
                           </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-8 bg-slate-50 border-t">
            <Button onClick={() => setGlobalAuditResult(null)} className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em]">Finalizar Revisión</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
