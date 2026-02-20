
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
  Zap
} from 'lucide-react';
import { extractPdfData, ExtractPdfDataOutput } from '@/ai/flows/extract-pdf-data-flow';
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
  const [results, setResults] = useState<ExtractPdfDataOutput | null>(null);
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
      data.projectInfo?.projectName,
      data.financialImpact?.netImpact,
      data.dates?.requestDate,
      data.descriptionSection?.description
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

      // 1. Extracción con IA
      const extracted = await extractPdfData({ pdfDataUri: dataUri });
      if (!extracted?.extractedData) throw new Error("No se pudo extraer información del documento.");

      // 2. Análisis Semántico
      const semantic = await analyzeOrderSemantically({
        descripcion: extracted.extractedData.descriptionSection?.description || ""
      });

      const completeness = calculateCompleteness(extracted.extractedData);

      // Homologación
      const homogenizedData = {
        ...extracted.extractedData,
        projectId: extracted.extractedData.projectInfo?.projectId || "N/A",
        projectName: extracted.extractedData.projectInfo?.projectName || "N/A",
        impactoNeto: extracted.extractedData.financialImpact?.netImpact || 0,
        causaRaiz: extracted.extractedData.projectInfo?.rootCauseDeclared || "Sin definir",
        descripcion: extracted.extractedData.descriptionSection?.description || "",
        fechaSolicitud: extracted.extractedData.dates?.requestDate || extracted.extractedData.header?.requestDate || new Date().toISOString(),
        isSigned: extracted.extractedData.isSigned || false,
        pdfEvidenceFragments: extracted.extractedData.evidenceFragments || [],
        dataSource: 'PDF_ORIGINAL',
        ingestionCompleteness: completeness,
        semanticAnalysis: semantic,
        processedAt: new Date().toISOString(),
        processingLog: {
          modelVersion: extracted.metadata.modelVersion,
          missingFields: extracted.metadata.missingFields,
          extractionConfidence: extracted.metadata.extractionConfidence
        }
      };

      setResults({ ...extracted, extractedData: homogenizedData as any });

      // 3. Vinculación
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
            dataSource: 'PDF_ENRICHED'
          });
          setMatchStatus('MATCHED');
        } else {
          const newId = `pdf_${projectId}_${Date.now()}`;
          setDocumentNonBlocking(doc(db, 'orders', newId), {
            ...homogenizedData,
            id: newId
          }, { merge: true });
          setMatchStatus('NEW');
        }
      }
      
      toast({ title: "Ingesta Finalizada", description: "Documento procesado y auditado con éxito." });

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
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Normalización & Auditoría de PDF</h1>
          </div>
        </header>

        <main className="p-6 md:p-8 max-w-7xl mx-auto w-full">
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="md:col-span-1 border-none shadow-sm h-fit bg-white">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Ingesta Forense</CardTitle>
                <CardDescription>Formatos oficiales OC/OT</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer group ${isProcessing ? 'opacity-50' : 'hover:border-primary/50 hover:bg-primary/5 border-slate-200'}`}
                  onClick={() => !isProcessing && document.getElementById('pdf-upload')?.click()}
                >
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3 group-hover:text-primary transition-colors" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seleccionar PDF</p>
                  <Input id="pdf-upload" type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                </div>
                
                {isProcessing && (
                  <div className="space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-primary">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Auditando PDF...
                      </span>
                    </div>
                    <Progress value={65} className="h-1" />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-3 space-y-6">
              {results?.extractedData ? (
                <div className="space-y-6 animate-in slide-in-from-bottom-5">
                  {/* Status Bar */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card className="p-4 border-none shadow-sm bg-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${results.extractedData.isSigned ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          <Signature className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Estatus de Firma</p>
                          <p className="text-xs font-bold">{results.extractedData.isSigned ? 'DOCUMENTO FIRMADO' : 'COPIA NO FIRMADA'}</p>
                        </div>
                      </div>
                      {!results.extractedData.isSigned && <AlertTriangle className="h-4 w-4 text-rose-500 animate-pulse" />}
                    </Card>

                    <Card className="p-4 border-none shadow-sm bg-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-lg">
                          <Zap className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Completitud Ingesta</p>
                          <p className="text-xs font-bold">{(results.extractedData as any).ingestionCompleteness}% de Datos</p>
                        </div>
                      </div>
                      <Progress value={(results.extractedData as any).ingestionCompleteness} className="h-1.5 w-16" />
                    </Card>

                    <Card className="p-4 border-none shadow-sm bg-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                          <History className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Origen del Dato</p>
                          <p className="text-xs font-bold">{matchStatus === 'MATCHED' ? 'SINC_EXISTENTE' : 'NUEVO_REGISTRO'}</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Main Result */}
                  <Card className="border-none shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
                      <div className="space-y-1">
                         <div className="flex items-center gap-2">
                           <Badge className="bg-primary uppercase text-[8px]">{(results.extractedData.header as any)?.type || "OT"}</Badge>
                           <CardTitle className="text-lg font-headline">{results.extractedData.projectId}</CardTitle>
                         </div>
                         <CardDescription>{results.extractedData.projectName}</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Monto Forense</p>
                        <p className="text-xl font-headline font-bold text-primary">{formatCurrency((results.extractedData as any).impactoNeto)}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                       {/* Alertas */}
                       {((results.extractedData as any).ingestionCompleteness < 80 || !results.extractedData.isSigned) && (
                         <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
                            <div className="space-y-1">
                               <p className="text-xs font-bold text-rose-900 uppercase">Alerta de Integridad Documental</p>
                               <ul className="text-[10px] text-rose-700 list-disc pl-4 space-y-0.5">
                                 {!results.extractedData.isSigned && <li>El documento carece de firmas visibles. Validación formal pendiente.</li>}
                                 {(results.extractedData as any).ingestionCompleteness < 80 && <li>La ingesta de datos críticos está por debajo del umbral recomendado (80%).</li>}
                                 {(results.extractedData as any).processingLog?.missingFields?.length > 0 && <li>Campos no detectados: {(results.extractedData as any).processingLog.missingFields.join(', ')}</li>}
                               </ul>
                            </div>
                         </div>
                       )}

                       <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                              <BrainCircuit className="h-4 w-4 text-primary" /> Análisis Semántico IA
                            </h4>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <p className="text-xs font-bold text-slate-800 mb-1">{(results.extractedData as any).semanticAnalysis?.disciplina_normalizada}</p>
                              <p className="text-[10px] text-slate-500 italic">"{(results.extractedData as any).standardizedDescription}"</p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                              <FileSearch className="h-4 w-4 text-primary" /> Evidencia Documental
                            </h4>
                            <div className="space-y-2">
                              {(results.extractedData as any).pdfEvidenceFragments?.slice(0, 2).map((frag: any, i: number) => (
                                <div key={i} className="text-[10px] bg-primary/5 p-3 rounded-lg border border-primary/10 italic">
                                  "{frag.text}" <span className="text-[8px] font-bold text-slate-400">— Pág. {frag.page}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                       </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="h-[400px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300 bg-white/50 border-slate-200">
                  <ShieldAlert className="h-12 w-12 opacity-10 mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Sin documento procesado</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
