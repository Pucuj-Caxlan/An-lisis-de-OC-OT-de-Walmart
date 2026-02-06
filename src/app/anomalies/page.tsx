
"use client"

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ShieldAlert, 
  BrainCircuit, 
  AlertTriangle, 
  ShieldCheck, 
  Activity,
  RefreshCcw,
  Zap,
  Info,
  BadgeAlert,
  Database,
  Search,
  History,
  Trash2
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit, doc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { detectAnomalies, AnomalyDetectionOutput } from '@/ai/flows/anomaly-detection-flow';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

export default function AnomaliesPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isScanning, setIsScanning] = useState(false);
  const [auditResult, setAuditResult] = useState<AnomalyDetectionOutput | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), limit(100));
  }, [db]);

  const { data: orders } = useCollection(ordersQuery);

  const auditHistoryQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'audits'), orderBy('timestamp', 'desc'), limit(10));
  }, [db]);

  const { data: auditsHistory, isLoading: isLoadingAudits } = useCollection(auditHistoryQuery);

  const runDeepScan = async () => {
    if (!orders || orders.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "Cargue registros primero." });
      return;
    }
    
    setIsScanning(true);
    try {
      const normalizedOrders = orders.map(o => ({
        id: o.id,
        projectId: o.projectId || o.projectInfo?.projectId || "N/A",
        impactoNeto: o.impactoNeto || o.financialImpact?.netImpact || 0,
        causaRaiz: o.semanticAnalysis?.causaRaizReal || o.causaRaiz || o.projectInfo?.rootCauseDeclared || "Sin definir",
        isSigned: o.isSigned ?? false,
        appendixF: o.antiCorruption?.appendixF ?? o.appendixF ?? false,
        descripcion: o.descripcion || o.descriptionSection?.description || o.standardizedDescription || "",
        semanticAnalysis: o.semanticAnalysis || null
      }));

      const result = await detectAnomalies({ orders: normalizedOrders });
      setAuditResult(result);

      // Guardar histórico
      if (db) {
        const auditId = `audit_${Date.now()}`;
        await setDoc(doc(db, 'audits', auditId), {
          id: auditId,
          timestamp: new Date().toISOString(),
          globalHealthScore: result.globalHealthScore,
          summary: result.summary,
          anomaliesCount: result.anomalies.length,
          sampleSize: orders.length,
          anomalies: result.anomalies
        });
      }

      toast({ title: "Auditoría Finalizada", description: `Se detectaron ${result.anomalies.length} anomalías.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error en Escaneo", description: error.message || "No se pudo completar la auditoría IA." });
    } finally {
      setIsScanning(false);
    }
  };

  const deleteAudit = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'audits', id));
      toast({ title: "Reporte eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const getSeverityColor = (sev: string) => {
    switch(sev) {
      case 'Alta': return 'bg-rose-500';
      case 'Media': return 'bg-amber-500';
      case 'Baja': return 'bg-blue-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-rose-600" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">Anomalías & Auditoría Forense</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-500 px-3 py-1 gap-2">
              <Database className="h-3 w-3" /> {orders?.length || 0} Registros en Base
            </Badge>
            <Button 
              onClick={runDeepScan} 
              disabled={isScanning || !orders || orders.length === 0}
              className="bg-rose-600 hover:bg-rose-700 gap-2 shadow-lg h-10 px-6"
            >
              {isScanning ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {isScanning ? "Analizando..." : "Iniciar Escaneo Profundo"}
            </Button>
          </div>
        </header>

        <main className="p-6 md:p-8 space-y-8">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Health Score de Datos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-end justify-between">
                  <span className="text-6xl font-headline font-bold text-slate-800">
                    {auditResult ? auditResult.globalHealthScore : '--'}
                    <span className="text-2xl text-slate-300">/100</span>
                  </span>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Estado de la Muestra</p>
                    <p className="text-sm text-emerald-600 font-bold uppercase tracking-tight">
                      {orders?.length || 0} Órdenes Cargadas
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                   <Progress value={auditResult?.globalHealthScore || 0} className="h-2.5 bg-slate-100" />
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-600 italic leading-relaxed">
                    {auditResult ? auditResult.summary : "Ejecute el escaneo para que el motor forense de Gemini analice inconsistencias semánticas, financieras y de cumplimiento."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <History className="h-4 w-4" /> Últimas Auditorías
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-[250px] overflow-y-auto">
                  {isLoadingAudits ? (
                    <div className="p-4 text-center text-xs text-slate-400 animate-pulse">Cargando historial...</div>
                  ) : auditsHistory?.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">Sin historial aún.</div>
                  ) : auditsHistory?.map((audit) => (
                    <div key={audit.id} className="p-3 hover:bg-slate-50 flex items-center justify-between group cursor-pointer" onClick={() => setAuditResult(audit as any)}>
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-slate-800">{new Date(audit.timestamp).toLocaleString()}</p>
                        <p className="text-[9px] text-slate-400 uppercase">{audit.anomaliesCount} hallazgos | Score: {audit.globalHealthScore}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-rose-300" onClick={(e) => { e.stopPropagation(); deleteAudit(audit.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          <div className="space-y-4">
            <h2 className="text-xl font-headline font-bold text-slate-800 flex items-center gap-2">
              <BadgeAlert className="h-6 w-6 text-rose-500" /> 
              Feed de Hallazgos Forenses
            </h2>
            
            {!auditResult ? (
              <div className="h-60 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300 bg-white/50 border-slate-200">
                <BrainCircuit className="h-10 w-10 opacity-20 text-primary mb-2" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Seleccione un reporte o inicie escaneo</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {auditResult.anomalies.map((anomaly, i) => (
                  <Card key={i} className="border-none shadow-sm bg-white overflow-hidden">
                    <div className="flex">
                      <div className={`w-1.5 ${getSeverityColor(anomaly.severity)}`} />
                      <div className="flex-1 p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase">{anomaly.type}</Badge>
                              <span className="text-[10px] font-bold text-slate-400">PID: {anomaly.projectId}</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 leading-tight">{anomaly.finding}</h3>
                          </div>
                          <Badge className={`${getSeverityColor(anomaly.severity)} uppercase text-[9px] text-white`}>
                            {anomaly.severity}
                          </Badge>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black text-primary uppercase">Razonamiento</h4>
                            <p className="text-xs text-slate-600 italic">{anomaly.reasoning}</p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-[9px] font-black text-rose-500 uppercase">Acción Sugerida</h4>
                            <p className="text-xs text-slate-800 font-bold">{anomaly.recommendation}</p>
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
      </SidebarInset>
    </div>
  );
}
