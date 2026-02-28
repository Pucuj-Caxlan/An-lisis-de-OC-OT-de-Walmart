
"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Database, 
  RefreshCcw, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Filter,
  AlertTriangle,
  Search,
  Trash2,
  BarChart4,
  CheckCircle2,
  Zap,
  Target,
  DollarSign,
  Layers,
  Eye,
  Info,
  Calendar,
  FileText,
  UserCheck,
  Globe,
  Coins,
  ShieldCheck,
  ChevronDown,
  Loader2
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { 
  collection, 
  query, 
  limit, 
  doc, 
  orderBy, 
  startAfter, 
  QueryDocumentSnapshot, 
  DocumentData,
  where,
  setDoc,
  writeBatch,
  getCountFromServer,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AnalysisPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user, isAuthReady } = useUser();
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageHistory, setPageHistory] = useState<(QueryDocumentSnapshot<DocumentData> | null)[]>([null]);
  const [stats, setStats] = useState({ total: 0, withData: 0, pending: 0, totalImpact: 0 });
  
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [subDisciplineFilter, setSubDisciplineFilter] = useState<string>('all');
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [isRefreshingStats, setIsRefreshingStats] = useState(false);
  const [isBulkClassifying, setIsBulkClassifying] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const aggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(aggRef);

  const taxonomyQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_disciplines'), orderBy('count', 'desc')) : null, [db]);
  const { data: taxonomyDocs } = useCollection(taxonomyQuery);

  const ordersQuery = useMemoFirebase(() => {
    if (!db || !isAuthReady) return null;
    
    let q = collection(db, 'orders');
    let baseQuery;

    if (disciplineFilter === 'all') {
      baseQuery = query(q, orderBy('projectId', 'asc'), limit(pageSize));
    } else if (disciplineFilter === 'unclassified') {
      baseQuery = query(q, where('classification_status', '==', 'pending'), orderBy('projectId', 'asc'), limit(pageSize));
    } else {
      baseQuery = query(q, where('disciplina_normalizada', '==', disciplineFilter));
      if (subDisciplineFilter !== 'all') {
        baseQuery = query(baseQuery, where('subcausa_normalizada', '==', subDisciplineFilter));
      }
      baseQuery = query(baseQuery, orderBy('projectId', 'asc'), limit(pageSize));
    }

    const currentCursor = pageHistory[currentPage - 1];
    if (currentCursor) {
      baseQuery = query(baseQuery, startAfter(currentCursor));
    }

    return baseQuery;
  }, [db, isAuthReady, pageSize, currentPage, disciplineFilter, subDisciplineFilter, pageHistory]);

  const { data: orders, isLoading, snapshot } = useCollection(ordersQuery);

  const disciplineStructure = useMemo(() => {
    const structure: Record<string, any> = {};
    taxonomyDocs?.forEach(doc => {
      const originalName = doc.name || doc.id;
      structure[originalName] = doc;
    });
    return structure;
  }, [taxonomyDocs]);

  useEffect(() => {
    if (!mounted) return;
    const totalInDb = globalAgg?.totalOrders || 0;
    const totalWithDataInDb = globalAgg?.totalProcessed || 0;
    const globalTotalImpact = globalAgg?.totalImpact || 0;
    
    if (disciplineFilter === 'all') {
      setStats({ total: totalInDb, withData: totalWithDataInDb, pending: Math.max(0, totalInDb - totalWithDataInDb), totalImpact: globalTotalImpact });
    } else if (disciplineFilter === 'unclassified') {
      setStats({ total: Math.max(0, totalInDb - totalWithDataInDb), withData: 0, pending: Math.max(0, totalInDb - totalWithDataInDb), totalImpact: 0 });
    } else {
      const group = disciplineStructure[disciplineFilter];
      if (subDisciplineFilter === 'all') {
        setStats({ total: group?.count || 0, withData: group?.count || 0, pending: 0, totalImpact: group?.impact || 0 });
      } else {
        const subGroup = group?.subs?.[subDisciplineFilter];
        setStats({ total: subGroup?.count || 0, withData: subGroup?.count || 0, pending: 0, totalImpact: subGroup?.impact || 0 });
      }
    }
  }, [disciplineFilter, subDisciplineFilter, globalAgg, disciplineStructure, mounted]);

  const handleNextPage = () => {
    if (snapshot && snapshot.docs.length === pageSize) {
      setPageHistory(prev => {
        const newHistory = [...prev];
        newHistory[currentPage] = snapshot.docs[snapshot.docs.length - 1];
        return newHistory;
      });
      setCurrentPage(prev => prev + 1);
      setSelectedIds([]);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      setSelectedIds([]);
    }
  };

  const formatAmount = (amount: number) => {
    if (!mounted) return "0.00";
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2 }).format(amount);
  };

  // NUEVA FUNCIÓN: Sincronización Iterativa para superar el límite de 10,000
  const handleRefreshUniverseStats = async () => {
    if (!db) return;
    setIsRefreshingStats(true);
    try {
      const colRef = collection(db, 'orders');
      const totalSnapshot = await getCountFromServer(colRef);
      const totalInDbCount = totalSnapshot.data().count;

      const discMap: Record<string, any> = {};
      const causeMap: Record<string, any> = {};
      let totalCalculatedImpact = 0;
      let totalProcessedInSync = 0;
      
      let lastVisible = null;
      let hasMore = true;
      const CHUNK_SIZE = 3000; // Bloques para no saturar memoria

      while (hasMore) {
        let q = query(
          colRef, 
          where('classification_status', '!=', 'pending'), 
          orderBy('classification_status'),
          limit(CHUNK_SIZE)
        );
        
        if (lastVisible) {
          q = query(q, startAfter(lastVisible));
        }

        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          hasMore = false;
          break;
        }

        querySnapshot.forEach(d => {
          const data = d.data();
          let disc = String(data.disciplina_normalizada || 'INDEFINIDA').trim().toUpperCase();
          let sub = String(data.subcausa_normalizada || 'SIN SUB-DISCIPLINA').trim().toUpperCase();
          let cause = String(data.causa_raiz_normalizada || 'SIN DEFINIR').trim().toUpperCase();
          const impact = data.impactoNeto || 0;
          
          totalCalculatedImpact += impact;
          totalProcessedInSync++;

          if (!discMap[disc]) discMap[disc] = { impact: 0, count: 0, subs: {} };
          discMap[disc].impact += impact;
          discMap[disc].count += 1;
          if (!discMap[disc].subs[sub]) discMap[disc].subs[sub] = { impact: 0, count: 0 };
          discMap[disc].subs[sub].impact += impact;
          discMap[disc].subs[sub].count += 1;

          if (!causeMap[cause]) causeMap[cause] = { impact: 0, count: 0 };
          causeMap[cause].impact += impact;
          causeMap[cause].count += 1;
        });

        lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
        if (querySnapshot.size < CHUNK_SIZE) {
          hasMore = false;
        }
      }

      // Guardar en batches para no exceder límites de escritura
      const saveTaxonomy = async (map: Record<string, any>, coll: string) => {
        const entries = Object.entries(map);
        for (let i = 0; i < entries.length; i += 400) {
          const chunk = entries.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(([name, data]) => {
            const safeId = name.replace(/\//g, '_').substring(0, 100);
            batch.set(doc(db, coll, safeId), { ...data, id: safeId, name: name, lastUpdate: new Date().toISOString() });
          });
          await batch.commit();
        }
      };

      await saveTaxonomy(discMap, 'taxonomy_disciplines');
      await saveTaxonomy(causeMap, 'taxonomy_causes');

      // Actualizar stats globales
      await setDoc(doc(db, 'aggregates', 'global_stats'), {
        totalOrders: totalInDbCount,
        totalProcessed: totalProcessedInSync,
        totalImpact: totalCalculatedImpact,
        lastUpdate: new Date().toISOString()
      }, { merge: true });

      toast({ 
        title: "Universo Sincronizado al 100%", 
        description: `Se procesaron exitosamente ${totalProcessedInSync} de ${totalInDbCount} registros.` 
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Fallo de Sincronización", description: e.message });
    } finally {
      setIsRefreshingStats(false);
    }
  };

  // NUEVA FUNCIÓN: Clasificación masiva para alcanzar el 100% de integridad
  const handleBulkAutoClassify = async () => {
    if (!db || !user) return;
    setIsBulkClassifying(true);
    try {
      const colRef = collection(db, 'orders');
      const qPending = query(colRef, where('classification_status', '==', 'pending'), limit(50));
      
      let processed = 0;
      let hasMore = true;

      toast({ title: "Iniciando Auditoría Masiva", description: "Procesando registros pendientes en lotes de 50..." });

      while (hasMore) {
        const snapshot = await getDocs(qPending);
        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        // Procesamos este lote de 50 con la IA
        for (const d of snapshot.docs) {
          const order = d.data();
          try {
            const result = await analyzeOrderSemantically({
              descripcion: String(order.descripcion || "").substring(0, 300),
              monto: order.impactoNeto
            });

            await updateDoc(doc(db, 'orders', d.id), {
              disciplina_normalizada: result.disciplina_normalizada.toUpperCase(),
              causa_raiz_normalizada: result.causa_raiz_normalizada.toUpperCase(),
              subcausa_normalizada: result.subcausa_normalizada.toUpperCase(),
              classification_status: 'auto',
              semanticAnalysis: result,
              processedAt: new Date().toISOString()
            });
            processed++;
          } catch (aiErr) {
            console.warn("AI record skip:", d.id);
          }
        }
        
        // Si el lote fue menor a 50, terminamos
        if (snapshot.size < 50) hasMore = false;
        
        // Pausa breve para evitar saturación de rate limits
        await new Promise(r => setTimeout(r, 1000));
      }

      toast({ title: "Auditoría Completada", description: `Se clasificaron ${processed} registros adicionales.` });
      handleRefreshUniverseStats(); // Sincronizamos jerarquía al final
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error en Auditoría Masiva", description: e.message });
    } finally {
      setIsBulkClassifying(false);
    }
  };

  const handleSingleSemanticAnalysis = async (order: any) => {
    if (!db || !user) return;
    setIsAnalyzing(order.id);
    try {
      const result = await analyzeOrderSemantically({
        descripcion: String(order.descripcion || "").substring(0, 300),
        monto: order.impactoNeto
      });

      const orderRef = doc(db, 'orders', order.id);
      updateDocumentNonBlocking(orderRef, {
        disciplina_normalizada: result.disciplina_normalizada.toUpperCase(),
        causa_raiz_normalizada: result.causa_raiz_normalizada.toUpperCase(),
        subcausa_normalizada: result.subcausa_normalizada.toUpperCase(),
        classification_status: 'auto',
        semanticAnalysis: result,
        processedAt: new Date().toISOString()
      });
      
      toast({ title: "Registro Clasificado", description: result.disciplina_normalizada });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error IA", description: e.message });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'orders', id));
    toast({ title: "Registro eliminado" });
  };

  const progressPercentage = stats.total > 0 ? Math.round((stats.withData / stats.total) * 100) : 0;

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <BarChart4 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Consola de Control de Universo</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
              <Select 
                value={disciplineFilter} 
                onValueChange={(v) => { setDisciplineFilter(v); setSubDisciplineFilter('all'); setCurrentPage(1); setPageHistory([null]); }}
              >
                <SelectTrigger className="h-8 w-56 text-[10px] font-black uppercase rounded-lg border-none bg-white shadow-sm">
                  <Filter className="h-3 w-3 mr-2 text-primary" />
                  <SelectValue placeholder="Disciplina Primaria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">TODAS LAS DISCIPLINAS ({globalAgg?.totalOrders || 0})</SelectItem>
                  <SelectItem value="unclassified" className="text-rose-600 font-bold">SIN CLASIFICAR</SelectItem>
                  {Object.keys(disciplineStructure).sort().map(name => (
                    <SelectItem key={name} value={name}>{name} ({disciplineStructure[name].count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {disciplineFilter !== 'all' && disciplineFilter !== 'unclassified' && (
                <div className="flex items-center">
                  <ChevronDown className="h-3 w-3 text-slate-400 mx-1" />
                  <Select value={subDisciplineFilter} onValueChange={(v) => { setSubDisciplineFilter(v); setCurrentPage(1); setPageHistory([null]); }}>
                    <SelectTrigger className="h-8 w-56 text-[10px] font-black uppercase rounded-lg border-none bg-white shadow-sm">
                      <Layers className="h-3 w-3 mr-2 text-accent" />
                      <SelectValue placeholder="Sub-Disciplina" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">TODAS LAS SUB-DISCIPLINAS</SelectItem>
                      {Object.keys(disciplineStructure[disciplineFilter]?.subs || {}).sort().map(subName => (
                        <SelectItem key={subName} value={subName}>{subName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleBulkAutoClassify} 
                disabled={isBulkClassifying || stats.pending === 0} 
                className="h-10 border-accent/20 text-accent text-[10px] font-black uppercase rounded-xl hover:bg-accent hover:text-white"
              >
                {isBulkClassifying ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Sparkles className="h-3 w-3 mr-2" />}
                Auditar Pendientes (IA)
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshUniverseStats} 
                disabled={isRefreshingStats} 
                className="h-10 border-slate-200 text-[10px] font-black uppercase rounded-xl"
              >
                <RefreshCcw className={`h-3 w-3 mr-2 ${isRefreshingStats ? 'animate-spin' : ''}`} />
                Sincronizar Jerarquía
              </Button>
            </div>
          </div>
        </header>

        <main className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-5 border-none shadow-sm bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase">Universo Walmart</p>
                <Database className="h-4 w-4 text-primary opacity-20" />
              </div>
              <h4 className="text-3xl font-headline font-bold text-slate-800">{stats.total.toLocaleString()}</h4>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Registros del Filtro</p>
            </Card>
            <Card className="p-5 border-none shadow-sm bg-white border-l-4 border-l-emerald-500 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-emerald-600 uppercase">Integridad Técnica</p>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-20" />
              </div>
              <h4 className="text-3xl font-headline font-bold text-emerald-600">{stats.withData.toLocaleString()}</h4>
              <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Con Clasificación IA</p>
            </Card>
            <Card className="p-5 border-none shadow-sm bg-slate-900 text-white border-l-4 border-l-accent flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-accent uppercase">Impacto Neto</p>
                <DollarSign className="h-4 w-4 text-accent opacity-40" />
              </div>
              <h4 className="text-2xl font-headline font-bold text-white">${formatAmount(stats.totalImpact)}</h4>
              <p className="text-[9px] text-slate-500 mt-2 uppercase font-bold">Consolidado en MXN</p>
            </Card>
            <Card className="p-5 border-none shadow-sm bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avance Clasificación</p>
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <h4 className="text-3xl font-headline font-bold text-primary">{progressPercentage}%</h4>
                  <span className="text-[9px] text-slate-400 font-black mb-1 uppercase">Auditado</span>
                </div>
                <Progress value={progressPercentage} className="h-1.5 bg-slate-100" />
              </div>
            </Card>
          </div>

          <Card className="border-none shadow-md overflow-hidden bg-white rounded-2xl">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-12 text-center"><Checkbox /></TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Estatus Datos</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">PID / Proyecto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Disciplina & Trazabilidad</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Impacto Neto</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-center w-[120px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-32"><RefreshCcw className="h-10 w-10 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                ) : !orders || orders.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-32 text-slate-400 font-bold uppercase text-xs">No se encontraron registros.</TableCell></TableRow>
                ) : orders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-center"><Checkbox /></TableCell>
                    <TableCell>
                      <Badge className={order.classification_status === 'auto' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}>
                        {order.classification_status === 'auto' ? "AUTO IA" : "VALIDADO"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-black text-primary text-sm">{order.projectId}</span>
                        <span className="text-[9px] text-slate-400 uppercase truncate max-w-[180px] font-bold">{order.projectName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                         <span className="font-bold text-slate-700 text-xs">{order.disciplina_normalizada || "—"}</span>
                         <span className="text-[9px] text-slate-400 uppercase font-bold truncate max-w-[200px]">{order.subcausa_normalizada || "Sin sub-disciplina"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-800 text-sm">${formatAmount(order.impactoNeto || 0)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrderForDetails(order)}><Eye className="h-4 w-4 text-slate-400" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleSingleSemanticAnalysis(order)} disabled={!!isAnalyzing}>
                          {isAnalyzing === order.id ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-accent" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteRecord(order.id)}><Trash2 className="h-4 w-4 text-slate-300" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between px-6 py-4 bg-slate-50/50 border-t">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PÁGINA {currentPage} • BLOQUE: {pageSize}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1} className="text-[9px] font-black px-4 rounded-xl shadow-sm">ANTERIOR</Button>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!orders || orders.length < pageSize} className="text-[9px] font-black px-4 rounded-xl shadow-sm">SIGUIENTE</Button>
              </div>
            </div>
          </Card>
        </main>

        <Dialog open={!!selectedOrderForDetails} onOpenChange={(open) => !open && setSelectedOrderForDetails(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl p-0 border-none shadow-2xl bg-white">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-start">
              <div className="space-y-1">
                <Badge className="bg-primary text-white border-none text-[10px] font-black px-3 py-1">FOLIO: {selectedOrderForDetails?.projectId}</Badge>
                <DialogTitle className="text-2xl font-headline font-bold tracking-tight uppercase mt-2">{selectedOrderForDetails?.projectName || "SIN NOMBRE"}</DialogTitle>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-accent uppercase tracking-widest">Impacto Neto</p>
                <h3 className="text-3xl font-black text-white tracking-tighter mt-1">${formatAmount(selectedOrderForDetails?.impactoNeto || 0)}</h3>
              </div>
            </div>
            <ScrollArea className="h-[calc(90vh-160px)] p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                  <section className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-primary flex items-center gap-2"><FileText className="h-4 w-4" /> Justificación Técnica</h4>
                    <div className="bg-slate-50 p-6 rounded-2xl border italic text-slate-600 text-sm">"{selectedOrderForDetails?.descripcion || "Sin descripción."}"</div>
                  </section>
                  <section className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-primary flex items-center gap-2"><Sparkles className="h-4 w-4" /> Análisis IA Gemini</h4>
                    {selectedOrderForDetails?.semanticAnalysis && (
                      <div className="grid gap-4">
                        <div className="flex gap-4">
                          <div className="bg-emerald-50 p-4 rounded-xl flex-1"><p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Disciplina</p><p className="text-sm font-bold">{selectedOrderForDetails.disciplina_normalizada}</p></div>
                          <div className="bg-blue-50 p-4 rounded-xl flex-1"><p className="text-[9px] font-black text-blue-600 uppercase mb-1">Causa Raíz</p><p className="text-sm font-bold">{selectedOrderForDetails.causa_raiz_normalizada}</p></div>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-xl text-white">
                          <p className="text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2"><Info className="h-3 w-3 text-accent" /> Racional Técnico</p>
                          <p className="text-xs text-slate-300 leading-relaxed italic">{selectedOrderForDetails.semanticAnalysis.rationale_tecnico}</p>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
                <Card className="border-none shadow-sm bg-slate-50 p-5 space-y-4 h-fit">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2">Metadatos</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3"><Globe className="h-4 w-4 text-primary" /><div><p className="text-[8px] font-black text-slate-400 uppercase">Región</p><p className="text-[10px] font-bold uppercase">{selectedOrderForDetails?.state || 'N/A'}</p></div></div>
                    <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-primary" /><div><p className="text-[8px] font-black text-slate-400 uppercase">Fecha</p><p className="text-[10px] font-bold uppercase">{selectedOrderForDetails?.fechaSolicitud ? new Date(selectedOrderForDetails.fechaSolicitud).toLocaleDateString() : 'N/A'}</p></div></div>
                    <div className="flex items-center gap-3"><ShieldCheck className={selectedOrderForDetails?.isSigned ? "text-emerald-500" : "text-rose-500"} /><div className="text-[10px] font-bold">{selectedOrderForDetails?.isSigned ? "FIRMADO DOCUSIGN" : "SIN FIRMA"}</div></div>
                  </div>
                </Card>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </div>
  );
}
