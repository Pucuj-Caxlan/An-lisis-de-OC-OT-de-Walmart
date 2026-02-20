
"use client"

import React, { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  BrainCircuit,
  ShieldCheck,
  ShieldAlert,
  Signature,
  History,
  AlertCircle,
  Database,
  FileSearch,
  Zap,
  Lock,
  ListOrdered
} from 'lucide-react';
import { extractPdfData } from '@/ai/flows/extract-pdf-data-flow';
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function UploadPdfPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [matchStatus, setMatchStatus] = useState<'MATCHED' | 'NEW' | 'PENDING'>('PENDING');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN', 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(val);
  };

  const calculateCompleteness = (data: any) => {
    const criticalFields = [
      data.projectInfo?.projectId,
      data.financialImpact?.netImpact,
      data.header?.orderNumber,
      data.envelopeId,
      data.technicalJustification?.description
    ];
    const filled = criticalFields.filter(f => f !== undefined && f !== null && f !== "").length;
    return Math.round((filled / criticalFields.length) * 100);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db) return;

    setIsProcessing(true);
    setResults(null);
    setMatchStatus('PENDING');

    try {
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // 1. Extracción Integral (7 Páginas)
      const extracted = await extractPdfData({ pdfDataUri: dataUri });
      if (!extracted?.extractedData) throw new Error("No se pudo extraer información integral del documento.");

      // 2. Análisis Semántico con Contexto Extendido
      const semantic = await analyzeOrderSemantically({
        descripcion: extracted.extractedData.technicalJustification?.description || "",
        contexto: {
          justificacionDetallada: extracted.extractedData.technicalJustification?.detailedReasoning
        } as any
      });

      const completeness = calculateCompleteness(extracted.extractedData);

      // Homologación de Datos Walmart
      const homogenizedData = {
        ...extracted.extractedData,
        id: `pdf_${extracted.extractedData.projectInfo?.projectId}_${extracted.extractedData.header?.orderNumber}`.replace(/\s+/g, '_'),
        projectId: extracted.extractedData.projectInfo?.projectId || "N/A",
        projectName: extracted.extractedData.projectInfo?.projectName || "N/A",
        impactoNeto: extracted.extractedData.financialImpact?.netImpact || 0,
        montoAcumulado: extracted.extractedData.financialImpact?.accumulatedAmount || 0,
        causaRaiz: extracted.extractedData.projectInfo?.rootCauseDeclared || "Sin definir",
        descripcion: extracted.extractedData.technicalJustification?.description || "",
        fechaSolicitud: extracted.extractedData.header?.requestDate || new Date().toISOString(),
        isSigned: extracted.extractedData.governance?.isSigned || false,
        envelopeId: extracted.extractedData.envelopeId,
        orderNumber: extracted.extractedData.header?.orderNumber,
        issuingArea: extracted.extractedData.header?.issuingArea,
        projectStage: extracted.extractedData.header?.projectStage,
        executionType: extracted.extractedData.projectInfo?.executionType,
        redFlags: extracted.extractedData.governance?.redFlagsDetected || [],
        technicalJustification: extracted.extractedData.technicalJustification,
        historicalLog: extracted.extractedData.historicalLog || [],
        dataSource: 'PDF_ENRICHED',
        ingestionCompleteness: completeness,
        semanticAnalysis: semantic,
        processedAt: new Date().toISOString(),
        classification_status: 'auto',
        needs_review: semantic.needs_review || !extracted.extractedData.governance?.isSigned
      };

      setResults({ ...extracted, extractedData: homogenizedData });

      // Vinculación Inteligente
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('projectId', '==', homogenizedData.projectId), where('orderNumber', '==', homogenizedData.orderNumber));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        updateDocumentNonBlocking(doc(db, 'orders', existingDoc.id), homogenizedData);
        setMatchStatus('MATCHED');
      } else {
        setDocumentNonBlocking(doc(db, 'orders', homogenizedData.id), homogenizedData, { merge: true });
        setMatchStatus('NEW');
      }
      
      toast({ title: "Auditoría de Ingesta Completa", description: "Expediente forense generado con éxito." });

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Ingesta", description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white px-6">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <Lock className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Gobernanza & Ingesta Institucional</h1>
          </div>
        </header>

        <main className="p-6 md:p-8 max-w-7xl mx-auto w-full">
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="md:col-span-1 border-none shadow-xl h-fit bg-white rounded-3xl overflow-hidden">
              <CardHeader className="bg-slate-900 text-white">
                <CardTitle className="text-lg flex items-center gap-2"><Upload className="h-5 w-5 text-accent" /> Ingesta Forense</CardTitle>
                <CardDescription className="text-slate-400 text-xs">Sube el formato oficial de 7 páginas</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer group ${isProcessing ? 'opacity-50' : 'hover:border-primary/50 hover:bg-primary/5 border-slate-200 shadow-inner'}`}
                  onClick={() => !isProcessing && document.getElementById('pdf-upload')?.click()}
                >
                  <div className="bg-primary/5 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargar PDF Oficial</p>
                  <Input id="pdf-upload" type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                </div>
                
                {isProcessing && (
                  <div className="space-y-4 animate-in fade-in bg-slate-50 p-4 rounded-2xl border border-dashed">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-primary">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Analizando anatomy...
                      </span>
                    </div>
                    <Progress value={75} className="h-1" />
                    <p className="text-[9px] text-slate-400 italic">Extrayendo bitácora histórica y firmas DocuSign...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-3 space-y-6">
              {results?.extractedData ? (
                <div className="space-y-6 animate-in slide-in-from-bottom-5">
                  {/* Forensic Key Indicators */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card className="p-4 border-none shadow-md bg-white rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${results.extractedData.isSigned ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white shadow-lg shadow-rose-200'}`}>
                          <Signature className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Estatus DocuSign</p>
                          <p className="text-xs font-bold">{results.extractedData.isSigned ? 'VALIDADO' : 'SIN FIRMA'}</p>
                        </div>
                      </div>
                      {!results.extractedData.isSigned && <AlertTriangle className="h-4 w-4 text-rose-500 animate-pulse" />}
                    </Card>

                    <Card className="p-4 border-none shadow-md bg-white rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-900 text-white rounded-xl">
                          <History className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Bitácora Histórica</p>
                          <p className="text-xs font-bold">{results.extractedData.historicalLog?.length || 0} Registros Previos</p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 border-none shadow-md bg-white rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-xl">
                          <Zap className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Confianza Ingesta</p>
                          <p className="text-xs font-bold">{results.extractedData.ingestionCompleteness}% Integridad</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Envelope Metadata */}
                  <Card className="p-4 border-none bg-slate-900 text-white rounded-2xl flex items-center gap-4">
                    <Lock className="h-5 w-5 text-accent" />
                    <div className="space-y-0.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">DocuSign Envelope ID</p>
                      <p className="text-xs font-mono font-bold tracking-tight">{results.extractedData.envelopeId || "N/A"}</p>
                    </div>
                  </Card>

                  {/* Main Result */}
                  <Card className="border-none shadow-xl overflow-hidden bg-white rounded-3xl">
                    <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between p-6">
                      <div className="space-y-1">
                         <div className="flex items-center gap-2">
                           <Badge className="bg-primary uppercase text-[8px] font-black">OT #{results.extractedData.orderNumber}</Badge>
                           <CardTitle className="text-xl font-headline font-bold uppercase">{results.extractedData.projectId}</CardTitle>
                         </div>
                         <CardDescription className="font-medium text-slate-500">{results.extractedData.projectName}</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Impacto Neto Auditado</p>
                        <p className="text-2xl font-headline font-bold text-primary">{formatCurrency(results.extractedData.impactoNeto)}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                       <div className="grid md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                              <BrainCircuit className="h-4 w-4" /> Justificación de Auditoría
                            </h4>
                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-2 opacity-5"><Zap className="h-12 w-12" /></div>
                              <p className="text-xs font-bold text-slate-800 mb-2 uppercase">{results.extractedData.semanticAnalysis?.disciplina_normalizada}</p>
                              <p className="text-[11px] text-slate-600 leading-relaxed italic">"{results.extractedData.technicalJustification?.detailedReasoning || results.extractedData.descripcion}"</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                              <ListOrdered className="h-4 w-4" /> Alertas de Control (Red Flags)
                            </h4>
                            <div className="space-y-2">
                              {results.extractedData.redFlags?.length > 0 ? (
                                results.extractedData.redFlags.map((flag: string, i: number) => (
                                  <div key={i} className="flex gap-3 items-center bg-rose-50 p-3 rounded-xl border border-rose-100">
                                    <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                                    <span className="text-[10px] font-bold text-rose-900">{flag}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center gap-3">
                                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                  <span className="text-[10px] font-bold text-emerald-800">Sin banderas de riesgo detectadas en el formato.</span>
                                </div>
                              )}
                            </div>
                          </div>
                       </div>

                       {/* Historical Log Preview */}
                       {results.extractedData.historicalLog?.length > 0 && (
                         <div className="space-y-4 pt-4">
                            <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex items-center gap-2">
                              <Database className="h-4 w-4" /> Trazabilidad Acumulada (Bitácora)
                            </h4>
                            <div className="grid md:grid-cols-3 gap-3">
                               {results.extractedData.historicalLog.slice(0, 3).map((entry: any, i: number) => (
                                 <div key={i} className="bg-white border-2 border-slate-100 p-3 rounded-xl flex justify-between items-center shadow-sm">
                                    <div className="space-y-0.5">
                                      <p className="text-[9px] font-black text-slate-400 uppercase">OT {entry.orderNumber}</p>
                                      <p className="text-[10px] font-bold text-slate-700">{entry.rootCause}</p>
                                    </div>
                                    <span className="text-[10px] font-black text-primary">{formatCurrency(entry.amount)}</span>
                                 </div>
                               ))}
                            </div>
                         </div>
                       )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="h-[500px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300 bg-white/50 border-slate-200 shadow-inner">
                  <ShieldAlert className="h-16 w-16 opacity-10 mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Esperando expediente institucional...</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
