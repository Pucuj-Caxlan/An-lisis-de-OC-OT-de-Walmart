
"use client"

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ShieldAlert, 
  BrainCircuit, 
  Activity,
  RefreshCcw,
  Zap,
  BadgeAlert,
  Database,
  History,
  Trash2,
  ShieldCheck,
  TrendingDown,
  LayoutDashboard
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, limit, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { detectAnomalies, AnomalyDetectionOutput } from '@/ai/flows/anomaly-detection-flow';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function AnomaliesPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isScanning, setIsScanning] = useState(false);
  const [auditResult, setAuditResult] = useState<AnomalyDetectionOutput | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cargar Metadatos Globales (SSOT) para coincidir con Dashboard VP
  const globalAggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(globalAggRef);

  // Cargar registros para auditoría (Muestra de alto impacto)
  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), orderBy('impactoNeto', 'desc'), limit(100));
  }, [db]);

  const { data: orders } = useCollection(ordersQuery);

  // Historial de auditorías
  const auditHistoryQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'audits'), orderBy('timestamp', 'desc'), limit(15));
  }, [db]);

  const { data: auditsHistory, isLoading: isLoadingAudits } = useCollection(auditHistoryQuery);

  const runDeepScan = async () => {
    if (!orders || orders.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "Sincronice el universo en la pestaña de Análisis primero." });
      return;
    }
    
    setIsScanning(true);
    try {
      // Normalización estricta basada en el esquema del Dashboard Ejecutivo
      const normalizedOrders = orders.map(o => ({
        id: o.id,
        projectId: o.projectId || "N/A",
        impactoNeto: Number(o.impactoNeto || 0),
        causaRaiz: o.causa_raiz_normalizada || o.causaRaiz || "Sin clasificar",
        isSigned: !!o.isSigned,
        appendixF: !!o.appendixF,
        descripcion: o.descripcion || "",
        semanticAnalysis: o.semanticAnalysis || null
      }));

      const result = await detectAnomalies({ orders: normalizedOrders });
      setAuditResult(result);

      if (db) {
        const auditId = `audit_${Date.now()}`;
        const auditData = {
          id: auditId,
          timestamp: new Date().toISOString(),
          globalHealthScore: result.globalHealthScore,
          summary: result.summary,
          anomaliesCount: result.anomalies.length,
          sampleSize: orders.length,
          anomalies: result.anomalies
        };

        setDoc(doc(db, 'audits', auditId), auditData)
          .catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: `audits/${auditId}`,
              operation: 'create',
              requestResourceData: auditData
            }));
          });
      }

      toast({ title: "Auditoría Forense Finalizada", description: `Se detectaron ${result.anomalies.length} desviaciones críticas.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Fallo en IA", description: error.message });
    } finally {
      setIsScanning(false);
    }
  };

  const deleteAudit = async (id: string) => {
    if (!db) return;
    deleteDoc(doc(db, 'audits', id))
      .then(() => toast({ title: "Reporte eliminado" }))
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `audits/${id}`,
          operation: 'delete'
        }));
      });
  };

  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case 'Alta': return 'bg-rose-500';
      case 'Media': return 'bg-amber-500';
      case 'Baja': return 'bg-blue-500';
      default: return 'bg-slate-400';
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
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-rose-600" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Auditoría Forense de Desviaciones</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Universo Sincronizado (SSOT)</p>
               <p className="text-xs font-black text-primary">{(globalAgg?.totalOrders || 0).toLocaleString()} Registros • {formatCurrency(globalAgg?.totalImpact || 0)}</p>
            </div>
            <Button 
              onClick={runDeepScan} 
              disabled={isScanning || !orders?.length}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2 shadow-md h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest"
            >
              {isScanning ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {isScanning ? "Auditando..." : "Iniciar Escaneo Profundo"}
            </Button>
          </div>
        </header>

        <main className="p-8 space-y-8 max-w-[1400px] mx-auto w-full">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="md:col-span-2 border-none shadow-xl bg-white rounded-[2rem] overflow-hidden">
              <CardHeader className="pb-2 pt-8 px-8">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Calidad de Gestión de Presupuesto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 p-8">
                <div className="flex items-end justify-between">
                  <div className="space-y-1">
                    <span className="text-7xl font-headline font-bold text-slate-900 tracking-tighter">
                      {auditResult ? auditResult.globalHealthScore : '--'}
                      <span className="text-2xl text-slate-300 font-medium ml-2">/100</span>
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Health Score de Muestra</p>
                  </div>
                  <div className="text-right space-y-2">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 uppercase text-[9px] font-black px-3 py-1">
                      Muestra: {orders?.length || 0} Registros Críticos
                    </Badge>
                    <div className="flex items-center gap-2 text-primary font-black uppercase text-[10px]">
                      <LayoutDashboard className="h-3.5 w-3.5" /> Sincronizado con Dashboard VP
                    </div>
                  </div>
                </div>
                
                <Progress value={auditResult?.globalHealthScore || 0} className="h-2.5 bg-slate-100" />
                
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 relative">
                  <div className="absolute -top-3 left-6 bg-white border border-slate-100 px-3 py-1 rounded-full text-[9px] font-black text-primary uppercase">Resumen Ejecutivo Gemini</div>
                  <p className="text-sm text-slate-600 italic leading-relaxed pt-2">
                    {auditResult ? auditResult.summary : "Ejecute el escaneo profundo para que el motor forense analice inconsistencias en el presupuesto de construcción."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-white rounded-[2rem] overflow-hidden flex flex-col">
              <CardHeader className="bg-slate-50/50 border-b p-6">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" /> Historial de Auditorías
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1">
                <div className="divide-y overflow-y-auto max-h-[350px] scrollbar-hide">
                  {isLoadingAudits ? (
                    <div className="p-10 text-center flex flex-col items-center gap-2">
                      <RefreshCcw className="h-6 w-6 animate-spin text-slate-200" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Cargando histórico...</p>
                    </div>
                  ) : auditsHistory?.length === 0 ? (
                    <div className="p-10 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest">Sin reportes generados.</div>
                  ) : auditsHistory?.map((audit) => (
                    <div key={audit.id} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group cursor-pointer" onClick={() => setAuditResult(audit as any)}>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{new Date(audit.timestamp).toLocaleString()}</p>
                        <div className="flex gap-3">
                          <span className="text-[9px] font-bold text-rose-500 uppercase">{audit.anomaliesCount} Hallazgos</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Score: {audit.globalHealthScore}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all" onClick={(e) => { e.stopPropagation(); deleteAudit(audit.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator className="bg-slate-200/60" />

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-headline font-bold text-slate-800 flex items-center gap-3">
                <BadgeAlert className="h-6 w-6 text-rose-500" /> 
                Reporte de Desviaciones Forenses
              </h2>
              {auditResult && (
                <Badge variant="outline" className="bg-white text-slate-500 border-slate-200 uppercase text-[9px] font-black tracking-widest px-4 py-1.5 shadow-sm">
                  {auditResult.anomalies.length} Alertas Detectadas
                </Badge>
              )}
            </div>
            
            {!auditResult ? (
              <div className="h-80 border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-slate-300 bg-white/40 border-slate-200 group hover:border-primary/20 transition-all">
                <div className="bg-slate-100 p-6 rounded-full mb-4 group-hover:bg-primary/5 transition-all">
                  <BrainCircuit className="h-12 w-12 opacity-20 text-primary" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Seleccione un reporte o inicie un escaneo de IA</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {auditResult.anomalies.map((anomaly, i) => (
                  <Card key={i} className="border-none shadow-lg bg-white rounded-[2rem] overflow-hidden group hover:shadow-xl transition-all duration-300">
                    <div className="flex">
                      <div className={`w-2 ${getSeverityColor(anomaly.severity)} transition-all group-hover:w-3`} />
                      <div className="flex-1 p-8">
                        <div className="flex items-start justify-between mb-6">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="text-[10px] font-black uppercase border-slate-200 bg-slate-50">{anomaly.type}</Badge>
                              <span className="text-[10px] font-black text-primary uppercase tracking-widest">PID: {anomaly.projectId}</span>
                            </div>
                            <h3 className="text-2xl font-headline font-bold text-slate-900 leading-tight">{anomaly.finding}</h3>
                          </div>
                          <Badge className={`${getSeverityColor(anomaly.severity)} text-white uppercase text-[9px] font-black tracking-widest px-4 py-1 rounded-lg`}>
                            Severidad {anomaly.severity}
                          </Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-8">
                          <div className="space-y-3 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                            <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                              <TrendingDown className="h-3.5 w-3.5" /> Razonamiento IA
                            </h4>
                            <p className="text-sm text-slate-600 italic leading-relaxed">{anomaly.reasoning}</p>
                          </div>
                          <div className="space-y-3 p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100/50">
                            <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                              <ShieldCheck className="h-3.5 w-3.5" /> Acción de Mitigación
                            </h4>
                            <p className="text-sm text-slate-800 font-bold leading-relaxed">{anomaly.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </main>

        <footer className="p-10 border-t border-slate-100 bg-white/50 flex justify-between items-center opacity-60">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Walmart Real Estate Forensic Unit • Confidential</span>
          </div>
          <div className="flex gap-8 text-[9px] font-black uppercase tracking-widest text-slate-400">
            <span>Audit Protocol v9.2</span>
            <span>SSOT Verified</span>
          </div>
        </footer>
      </SidebarInset>
    </div>
  );
}
