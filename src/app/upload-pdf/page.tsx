
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
  Info,
  Users,
  Signature,
  Clock
} from 'lucide-react';
import { extractPdfData, ExtractPdfDataOutput } from '@/ai/flows/extract-pdf-data-flow';
import { analyzeOrderSemantically } from '@/ai/flows/semantic-analysis-flow';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function UploadPdfPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ExtractPdfDataOutput | null>(null);
  const [matchStatus, setMatchStatus] = useState<'MATCHED' | 'NEW' | 'PENDING' | 'RETRY'>('PENDING');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN', 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(val);
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

      // 1. Extracción Exhaustiva con IA
      const extracted = await extractPdfData({ pdfDataUri: dataUri });
      if (!extracted?.extractedData) throw new Error("No se pudo extraer información del documento.");

      // 2. Análisis Semántico de Auditoría
      const semantic = await analyzeOrderSemantically({
        projectId: extracted.extractedData.projectInfo?.projectId,
        projectName: extracted.extractedData.projectInfo?.projectName,
        format: extracted.extractedData.projectInfo?.format,
        descripcion: extracted.extractedData.descriptionSection.description || "",
        causaDeclarada: extracted.extractedData.projectInfo.rootCauseDeclared || "",
        montoTotal: extracted.extractedData.financialImpact.netImpact || 0,
        contextoExtendido: extracted.extractedData,
        isSigned: extracted.extractedData.isSigned
      });

      // Homologación de campos para compatibilidad total con Excel y Dashboard
      const homogenizedData = {
        ...extracted.extractedData,
        projectId: extracted.extractedData.projectInfo?.projectId || "",
        projectName: extracted.extractedData.projectInfo?.projectName || "",
        format: extracted.extractedData.projectInfo?.format || "Otros",
        impactoNeto: extracted.extractedData.financialImpact?.netImpact || 0,
        causaRaiz: extracted.extractedData.projectInfo?.rootCauseDeclared || "",
        descripcion: extracted.extractedData.descriptionSection?.description || "",
        fechaSolicitud: extracted.extractedData.header?.requestDate || new Date().toISOString(),
        isSigned: extracted.extractedData.isSigned || false,
        // Metadatos de IA
        semanticAnalysis: semantic,
        standardizedDescription: semantic.standardizedDescription,
        processedAt: new Date().toISOString()
      };

      setResults({ ...extracted, extractedData: homogenizedData as any });

      // 3. Lógica de Vinculación (PID + Número de Orden)
      const projectId = extracted.extractedData.projectInfo?.projectId;
      const orderNumber = extracted.extractedData.header?.orderNumber;
      
      if (projectId && orderNumber) {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('projectId', '==', projectId), where('orderNumber', '==', orderNumber));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const existingDoc = querySnapshot.docs[0];
          updateDocumentNonBlocking(doc(db, 'orders', existingDoc.id), {
            ...homogenizedData,
            pdfUrl: 'simulated_storage_path',
            lastUpdatedFromPdf: new Date().toISOString(),
            dataSource: 'PDF_ENRICHED'
          });
          setMatchStatus('MATCHED');
        } else {
          const newId = `pdf_${projectId}_${Date.now()}`;
          setDocumentNonBlocking(doc(db, 'orders', newId), {
            ...homogenizedData,
            id: newId,
            pdfUrl: 'simulated_storage_path',
            createdFromPdf: true,
            dataSource: 'PDF_ORIGINAL'
          }, { merge: true });
          setMatchStatus('NEW');
        }
      }
      
      toast({ title: "Documento Normalizado", description: "Se han homologado los campos del PDF con la base de datos central." });

    } catch (error: any) {
      const isQuotaError = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
      if (isQuotaError) {
        setMatchStatus('RETRY');
        toast({ 
          variant: "destructive", 
          title: "Límite de IA alcanzado", 
          description: "La cuota gratuita de Gemini se ha agotado. Espere unos segundos e intente de nuevo." 
        });
      } else {
        toast({ 
          variant: "destructive", 
          title: "Error de Ingesta", 
          description: error.message || "Fallo técnico al normalizar el documento." 
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white px-6">
          <SidebarTrigger />
          <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Normalización & Ingesta PDF</h1>
        </header>

        <main className="p-6 md:p-8 max-w-7xl mx-auto w-full">
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="md:col-span-1 border-none shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Carga Individual</CardTitle>
                <CardDescription>Formatos firmados (OC/OT)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer group ${matchStatus === 'RETRY' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-primary/50 hover:bg-primary/5'}`}
                  onClick={() => !isProcessing && document.getElementById('pdf-upload')?.click()}
                >
                  {matchStatus === 'RETRY' ? (
                    <Clock className="h-10 w-10 text-amber-500 mx-auto mb-3 animate-pulse" />
                  ) : (
                    <Upload className="h-10 w-10 text-primary mx-auto mb-3" />
                  )}
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    {matchStatus === 'RETRY' ? 'Esperar Cuota' : 'Cargar PDF'}
                  </p>
                  <Input id="pdf-upload" type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                </div>
                
                {isProcessing && (
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-primary">
                      <span className="flex items-center gap-2 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" /> Homologando Datos...
                      </span>
                    </div>
                    <Progress value={75} className="h-1.5" />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-3 space-y-6">
              {results?.extractedData ? (
                <Card className="border-none shadow-sm overflow-hidden border-t-4 border-t-primary bg-white">
                  <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl font-headline">{results.extractedData.header?.type || "Orden"}</CardTitle>
                        <Badge variant={results.extractedData.isSigned ? "default" : "destructive"} className="gap-1 uppercase text-[10px]">
                          <Signature className="h-3 w-3" /> {results.extractedData.isSigned ? "Firmado" : "Sin Firma"}
                        </Badge>
                      </div>
                      <CardDescription>
                        PID: <span className="font-bold text-slate-900">{results.extractedData.projectId}</span> | 
                        Orden: <span className="font-bold text-slate-900">{results.extractedData.header?.orderNumber}</span>
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={`h-8 px-4 uppercase font-black text-[10px] ${matchStatus === 'MATCHED' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-primary border-primary/30'}`}>
                      {matchStatus === 'MATCHED' ? 'Sincronizado' : 'Nuevo Registro'}
                    </Badge>
                  </CardHeader>
                  
                  <CardContent className="pt-8 space-y-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Impacto Homologado</p>
                        <p className="text-lg font-bold text-primary">{formatCurrency(results.extractedData.impactoNeto)}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Monto Acumulado</p>
                        <p className="text-lg font-bold text-slate-800">{formatCurrency(results.extractedData.financialImpact?.accumulatedAmount || 0)}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Anticorrupción</p>
                        <div className="flex items-center gap-2">
                          {results.extractedData.antiCorruption?.appendixF ? <ShieldCheck className="h-5 w-5 text-emerald-500" /> : <ShieldAlert className="h-5 w-5 text-rose-500" />}
                          <span className="text-xs font-bold uppercase">{results.extractedData.antiCorruption?.appendixF ? 'Apéndice F OK' : 'Pendiente'}</span>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Verificación Firma</p>
                        <div className="flex items-center gap-2">
                          {results.extractedData.isSigned ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                          <span className="text-xs font-bold uppercase">{results.extractedData.isSigned ? 'Validada' : 'No Detectada'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                      <h4 className="text-xs font-black uppercase text-primary mb-4 flex items-center gap-2 tracking-widest">
                        <BrainCircuit className="h-5 w-5" /> Análisis Semántico Forense
                      </h4>
                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                          <p className="text-sm text-slate-700 leading-relaxed italic border-l-4 border-primary/30 pl-4">
                            "{results.extractedData.standardizedDescription || "Descripción no disponible"}"
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold">
                              Causa Raíz Real: {results.extractedData.semanticAnalysis?.causaRaizReal}
                            </Badge>
                            <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] uppercase font-bold">
                              Especialidad: {results.extractedData.semanticAnalysis?.especialidadImpactada}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {results.extractedData.semanticAnalysis?.auditAlerts?.map((alert: any, i: number) => (
                            <div key={i} className={`flex gap-3 p-3 rounded-xl border ${alert.severity === 'High' ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'}`}>
                              <AlertTriangle className={`h-4 w-4 shrink-0 ${alert.severity === 'High' ? 'text-rose-500' : 'text-amber-500'}`} />
                              <div className="text-[10px]">
                                <p className="font-bold text-slate-800">{alert.type}</p>
                                <p className="text-slate-600 leading-tight">{alert.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-[500px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-muted-foreground bg-white/50 space-y-4">
                  <div className="bg-slate-100 p-6 rounded-full">
                    <FileText className="h-16 w-16 opacity-20" />
                  </div>
                  <div className="text-center max-w-sm px-6">
                    <p className="text-lg font-bold text-slate-400 uppercase tracking-tighter">Normalización PDF en tiempo real</p>
                    <p className="text-xs mt-1">Sube un formato oficial (OC/OT) para homologar automáticamente sus campos financieros y de auditoría con el Dashboard VP.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
