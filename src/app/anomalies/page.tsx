"use client"

import React, { useState, useMemo } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ShieldAlert, 
  Search, 
  BrainCircuit, 
  AlertTriangle, 
  ShieldCheck, 
  Activity,
  ArrowRight,
  RefreshCcw,
  Zap,
  Info,
  BadgeAlert
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

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), limit(100));
  }, [db]);

  const { data: orders, isLoading } = useCollection(ordersQuery);

  const runDeepScan = async () => {
    if (!orders || orders.length === 0) {
      toast({ variant: "destructive", title: "Sin datos", description: "Cargue registros primero." });
      return;
    }
    
    setIsScanning(true);
    try {
      const result = await detectAnomalies({ orders });
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
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight">Anomalías & Auditoría Forense</h1>
            </div>
          </div>
          <Button 
            onClick={runDeepScan} 
            disabled={isScanning || !orders || orders.length === 0}
            className="bg-rose-600 hover:bg-rose-700 gap-2 shadow-lg"
          >
            {isScanning ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Iniciar Escaneo Profundo
          </Button>
        </header>

        <main className="p-6 md:p-8 space-y-8">
          {/* Hero Section: Data Health */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Health Score de Datos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-end justify-between">
                  <span className="text-6xl font-headline font-bold text-slate-800">
                    {auditResult ? auditResult.globalHealthScore : '--'}
                    <span className="text-2xl text-slate-300">/100</span>
                  </span>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500">CONFIABILIDAD DE LA MUESTRA</p>
                    <p className="text-sm text-emerald-600 font-bold">Óptima (100 registros)</p>
                  </div>
                </div>
                <Progress value={auditResult?.globalHealthScore || 0} className="h-3" />
                <p className="text-sm text-slate-500 italic">
                  {auditResult ? auditResult.summary : "Ejecute el escaneo para evaluar la integridad semántica y financiera de las órdenes."}
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-slate-800 text-white overflow-hidden">
              <CardHeader className="bg-slate-900/50">
                <CardTitle className="text-xs font-black uppercase text-slate-400 tracking-widest">Resumen de Riesgos</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <span className="text-sm">Riesgos Críticos</span>
                  <Badge className="bg-rose-500">{auditResult?.anomalies.filter(a => a.severity === 'Alta').length || 0}</Badge>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <span className="text-sm">Alertas Medias</span>
                  <Badge className="bg-amber-500">{auditResult?.anomalies.filter(a => a.severity === 'Media').length || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Inconsistencias Leves</span>
                  <Badge className="bg-blue-500">{auditResult?.anomalies.filter(a => a.severity === 'Baja').length || 0}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Anomaly Feed */}
          <div className="space-y-4">
            <h2 className="text-xl font-headline font-bold text-slate-800 flex items-center gap-2">
              <BadgeAlert className="h-6 w-6 text-rose-500" /> 
              Hallazgos de Auditoría IA
            </h2>
            
            {!auditResult ? (
              <div className="h-64 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300 bg-white/50">
                <BrainCircuit className="h-16 w-16 opacity-10 mb-2" />
                <p className="text-sm font-bold uppercase tracking-widest">Sin Escaneo Activo</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {auditResult.anomalies.map((anomaly, i) => (
                  <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden group">
                    <div className="flex">
                      <div className={`w-2 ${getSeverityColor(anomaly.severity)}`} />
                      <div className="flex-1 p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-black uppercase border-slate-200">
                                {anomaly.type}
                              </Badge>
                              <span className="text-[10px] font-bold text-slate-400">PID: {anomaly.projectId}</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">{anomaly.finding}</h3>
                          </div>
                          <Badge className={`${getSeverityColor(anomaly.severity)} uppercase text-[10px] font-bold h-6`}>
                            Severidad {anomaly.severity}
                          </Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border">
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-primary uppercase flex items-center gap-2">
                              <Info className="h-3 w-3" /> Razonamiento Técnico
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed italic">
                              {anomaly.reasoning}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-2">
                              <ShieldCheck className="h-3 w-3" /> Recomendación Preventiva
                            </h4>
                            <p className="text-xs text-slate-800 font-medium">
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
