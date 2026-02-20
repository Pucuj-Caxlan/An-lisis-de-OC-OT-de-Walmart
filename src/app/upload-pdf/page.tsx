
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
  Clock,
  History
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
        descripcion: extracted.extractedData.descriptionSection?.description || ""
      });

      // Homologación de campos para compatibilidad total
      const homogenizedData = {
        ...extracted.extractedData,
        projectId: extracted.extractedData.projectInfo?.projectId || "N/A",
        projectName: extracted.extractedData.projectInfo?.projectName || "N/A",
        format: extracted.extractedData.projectInfo?.format || "Otros",
        impactoNeto: (extracted.extractedData as any).financialImpact?.netImpact || 0,
        causaRaiz: extracted.extractedData.projectInfo?.rootCauseDeclared || "Sin definir",
        descripcion: extracted.extractedData.descriptionSection?.description || "",
        fechaSolicitud: extracted.extractedData.dates?.requestDate || extracted.extractedData.header?.requestDate || new Date().toISOString(),
        fechaDeteccion: extracted.extractedData.dates?.detectionDate || "",
        fechaAprobacion: extracted.extractedData.dates?.approvalDate || "",
        fechaEjecucion: extracted.extractedData.dates?.executionDate || "",
        fechaCierre: extracted.extractedData.dates?.closingDate || "",
        pdfEvidenceFragments: extracted.extractedData.evidenceFragments || [],
        isSigned: extracted.extractedData.isSigned || false,
        // Metadatos de IA
        semanticAnalysis: semantic,
        standardizedDescription: semantic.standardizedDescription || "",
        processedAt: new Date().toISOString()
      };

      setResults({ ...extracted, extractedData: homogenizedData as any });

      // 3. Lógica de Vinculación
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
            lastUpdatedFromPdf: new Date().toISOString(),
            dataSource: 'PDF_ENRICHED'
          });
          setMatchStatus('MATCHED');
        } else {
          const newId = `pdf_${projectId}_${Date.now()}`;
          setDocumentNonBlocking(doc(db, 'orders', newId), {
            ...homogenizedData,
            id: newId,
            createdFromPdf: true,
            dataSource: 'PDF_ORIGINAL'
          }, { merge: true });
          setMatchStatus('NEW');
        }
      }
      
      toast({ title: "Documento Normalizado", description: "Se han homologado las fechas y evidencia del PDF." });

    } catch (error: any) {
      console.error(error);
      toast({ 
        variant: "destructive", 
        title: "Error de Ingesta", 
        description: error.message || "Fallo técnico al normalizar el documento." 
      });
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
                  className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer group border-slate-200 hover:border-primary/50 hover:bg-primary/5`}
                  onClick={() => !isProcessing && document.getElementById('pdf-upload')?.click()}
                >
                  <Upload className="h-10 w-10 text-primary mx-auto mb-3" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargar PDF</p>
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
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5">
                  <Card className="border-none shadow-sm overflow-hidden border-t-4 border-t-primary bg-white">
                    <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-xl font-headline">{(results.extractedData.header as any)?.type || "Orden"}</CardTitle>
                          <Badge variant={results.extractedData.isSigned ? "default" : "destructive"} className="gap-1 uppercase text-[10px]">
                            <Signature className="h-3 w-3" /> {results.extractedData.isSigned ? "Firmado" : "Sin Firma"}
                          </Badge>
                        </div>
                        <CardDescription>
                          PID: <span className="font-bold text-slate-900">{results.extractedData.projectId}</span> | 
                          Orden: <span className="font-bold text-slate-900">{(results.extractedData.header as any)?.orderNumber}</span>
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={`h-8 px-4 uppercase font-black text-[10px] ${matchStatus === 'MATCHED' ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-primary border-primary/30'}`}>
                        {matchStatus === 'MATCHED' ? 'Sincronizado' : 'Nuevo Registro'}
                      </Badge>
                    </CardHeader>
                    
                    <CardContent className="pt-8 space-y-8">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Detección</p>
                          <p className="text-xs font-bold text-slate-600">{(results.extractedData as any).fechaDeteccion || "—"}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Solicitud</p>
                          <p className="text-xs font-bold text-primary">{(results.extractedData as any).fechaSolicitud || "—"}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Aprobación</p>
                          <p className="text-xs font-bold text-slate-600">{(results.extractedData as any).fechaAprobacion || "—"}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Ejecución</p>
                          <p className="text-xs font-bold text-slate-600">{(results.extractedData as any).fechaEjecucion || "—"}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Monto Neto</p>
                          <p className="text-xs font-bold text-primary">{formatCurrency((results.extractedData as any).impactoNeto || 0)}</p>
                        </div>
                      </div>

                      <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                        <h4 className="text-xs font-black uppercase text-primary mb-4 flex items-center gap-2 tracking-widest">
                          <History className="h-5 w-5" /> Evidencia Documental (PDF Fragments)
                        </h4>
                        <div className="grid gap-3">
                          {(results.extractedData as any).pdfEvidenceFragments?.map((frag: any, i: number) => (
                            <div key={i} className="bg-white p-4 rounded-xl border border-primary/5 text-xs">
                              <div className="flex justify-between mb-2">
                                <Badge variant="outline" className="text-[8px] uppercase font-bold text-primary/60 border-primary/10">Sección: {frag.section}</Badge>
                                <span className="text-[8px] font-black text-slate-400 uppercase">Pág. {frag.page}</span>
                              </div>
                              <p className="text-slate-700 italic font-medium">"{frag.text}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="h-[500px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-muted-foreground bg-white/50 space-y-4">
                  <div className="bg-slate-100 p-6 rounded-full">
                    <FileText className="h-16 w-16 opacity-20" />
                  </div>
                  <div className="text-center max-w-sm px-6">
                    <p className="text-lg font-bold text-slate-400 uppercase tracking-tighter">Normalización PDF & Trazabilidad Temporal</p>
                    <p className="text-xs mt-1">Sube un formato oficial para reconstruir la línea de tiempo y extraer fragmentos de evidencia textual de forma automática.</p>
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
