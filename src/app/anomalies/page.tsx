
"use client"

import React, { useState, useMemo, useEffect } from 'react';
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
  Search
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit } from 'firebase/firestore';
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
    return query(collection(db, 'orders'), limit(150));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const runDeepScan = async () => {
    if (!orders || orders.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "Cargue registros primero." });
      return;
    }
    
    setIsScanning(true);
    try {
      // Normalizamos los datos antes de enviarlos a la IA para asegurar consistencia entre PDF y Excel
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
      toast({ title: "Auditoría Finalizada", description: `Se detectaron ${result.anomalies.length} anomalías.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error en Escaneo", description: "No se pudo completar la auditoría IA." });
    } finally {
      setIsScanning(false);
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
          {/* Hero Section: Data Health */}
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
                   <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                     <span>Riesgo Crítico</span>
                     <span>Salud Óptima</span>
                   </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm text-slate-600 italic leading-relaxed">
                    {auditResult ? auditResult.summary : "Ejecute el escaneo para que el motor forense de Gemini analice inconsistencias semánticas, financieras y de cumplimiento en los registros cargados."}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-slate-800 text-white overflow-hidden">
              <CardHeader className="bg-slate-900/50 border-b border-white/5">
                <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Distribución de Hallazgos</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-center p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase">Riesgos Críticos</span>
                  </div>
                  <Badge className="bg-rose-500 text-white">{auditResult?.anomalies.filter(a => a.severity === 'Alta').length || 0}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-bold uppercase">Alertas Medias</span>
                  </div>
                  <Badge className="bg-amber-500 text-white">{auditResult?.anomalies.filter(a => a.severity === 'Media').length || 0}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-bold uppercase">Inconsistencias Leves</span>
                  </div>
                  <Badge className="bg-blue-500 text-white">{auditResult?.anomalies.filter(a => a.severity === 'Baja').length || 0}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Anomaly Feed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-headline font-bold text-slate-800 flex items-center gap-2">
                <BadgeAlert className="h-6 w-6 text-rose-500" /> 
                Feed de Hallazgos Forenses
              </h2>
              {auditResult && (
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                   {auditResult.anomalies.length} hallazgos detectados
                 </span>
              )}
            </div>
            
            {!auditResult ? (
              <div className="h-80 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300 bg-white/50 border-slate-200">
                <div className="bg-slate-100 p-6 rounded-full mb-4">
                  <BrainCircuit className="h-12 w-12 opacity-20 text-primary" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Sin Escaneo Activo</p>
                <p className="text-xs text-slate-400 mt-1">Haga clic en el botón superior para iniciar el análisis IA</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {auditResult.anomalies.map((anomaly, i) => (
                  <Card key={i} className="border-none shadow-sm hover:shadow-md transition-all duration-300 bg-white overflow-hidden group">
                    <div className="flex h-full">
                      <div className={`w-1.5 ${getSeverityColor(anomaly.severity)}`} />
                      <div className="flex-1 p-6">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className="text-[10px] font-black uppercase border-slate-200 bg-slate-50 text-slate-600 py-1">
                                {anomaly.type}
                              </Badge>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                                <Search className="h-3 w-3" /> PID: {anomaly.projectId}
                              </div>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-tight">{anomaly.finding}</h3>
                          </div>
                          <Badge className={`${getSeverityColor(anomaly.severity)} uppercase text-[10px] font-black h-7 px-4 shadow-sm text-white`}>
                            Severidad {anomaly.severity}
                          </Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-primary uppercase flex items-center gap-2 tracking-widest">
                              <Info className="h-3 w-3" /> Razonamiento de Auditoría
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed italic border-l-2 border-primary/20 pl-4 py-1">
                              {anomaly.reasoning}
                            </p>
                          </div>
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-2 tracking-widest">
                              <ShieldCheck className="h-3 w-3" /> Acción Preventiva Sugerida
                            </h4>
                            <p className="text-sm text-slate-800 font-bold bg-white p-3 rounded-lg border shadow-sm">
                              {anomaly.recommendation}
                            </p>
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
