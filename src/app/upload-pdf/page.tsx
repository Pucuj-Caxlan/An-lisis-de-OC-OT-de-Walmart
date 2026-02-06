
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
  History,
  Users,
  Signature
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
  const [matchStatus, setMatchStatus] = useState<'MATCHED' | 'NEW' | 'PENDING'>('PENDING');

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

    try {
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // 1. Extracción Exhaustiva
      const extracted = await extractPdfData({ pdfDataUri: dataUri });
      if (!extracted?.extractedData) throw new Error("Error en extracción OCR.");

      // 2. Análisis Semántico con contexto completo
      const semantic = await analyzeOrderSemantically({
        descripcion: extracted.extractedData.descriptionSection.description || "",
        causaDeclarada: extracted.extractedData.projectInfo.rootCauseDeclared || "",
        montoTotal: extracted.extractedData.financialImpact.netImpact || 0,
        contextoExtendido: extracted.extractedData,
        isSigned: extracted.extractedData.isSigned
      });

      const fullData = {
        ...extracted.extractedData,
        semanticAnalysis: semantic,
        standardizedDescription: semantic.standardizedDescription
      };

      setResults({ ...extracted, extractedData: fullData as any });

      // 3. Lógica de Match & Registro
      const projectId = extracted.extractedData.projectInfo?.projectId;
      const orderNumber = extracted.extractedData.header?.orderNumber;
      
      if (!projectId || !orderNumber) throw new Error("Información crítica faltante en el PDF (PID o No. Orden).");
      
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('projectId', '==', projectId), where('orderNumber', '==', orderNumber));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        updateDocumentNonBlocking(doc(db, 'orders', existingDoc.id), {
          ...fullData,
          projectId: projectId,
          orderNumber: orderNumber,
          pdfUrl: 'simulated_url',
          lastUpdatedFromPdf: new Date().toISOString()
        });
        setMatchStatus('MATCHED');
      } else {
        const newId = `pdf_${projectId}_${Date.now()}`;
        setDocumentNonBlocking(doc(db, 'orders', newId), {
          ...fullData,
          id: newId,
          projectId: projectId,
          orderNumber: orderNumber,
          pdfUrl: 'simulated_url',
          createdFromPdf: true,
          importBatchId: 'PDF_INGEST'
        }, { merge: true });
        setMatchStatus('NEW');
      }
      
      toast({ title: "Documento Procesado", description: "Datos extraídos y analizados semánticamente." });

    } catch (error: any) {
      toast({ variant: "destructive", title: "Error en procesamiento", description: error.message || "Fallo técnico en IA." });
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
          <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Auditoría Semántica de Documentos</h1>
        </header>

        <main className="p-6 md:p-8 max-w-7xl mx-auto w-full">
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="md:col-span-1 border-none shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Ingesta PDF</CardTitle>
                <CardDescription>Formatos oficiales firmados DocuSign</CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                  onClick={() => !isProcessing && document.getElementById('pdf-upload')?.click()}
                >
                  <Upload className="h-10 w-10 text-primary mx-auto mb-3" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargar Formato</p>
                  <Input id="pdf-upload" type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                </div>
                {isProcessing && (
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-primary">
                      <span className="flex items-center gap-2 animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" /> Procesando Semántica...
                      </span>
                    </div>
                    <Progress value={85} className="h-1.5" />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-3 space-y-6">
              {results?.extractedData ? (
                <>
                  <Card className="border-none shadow-sm overflow-hidden border-t-4 border-t-primary">
                    <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-xl font-headline">{results.extractedData.header.type}</CardTitle>
                          <Badge variant={results.extractedData.isSigned ? "default" : "destructive"} className="gap-1 uppercase text-[10px]">
                            <Signature className="h-3 w-3" /> {results.extractedData.isSigned ? "Firmado" : "Sin Firma"}
                          </Badge>
                        </div>
                        <CardDescription>
                          PID: <span className="font-bold text-slate-900">{results.extractedData.projectInfo.projectId}</span> | 
                          Orden: <span className="font-bold text-slate-900">{results.extractedData.header.orderNumber}</span>
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="h-8 px-4 text-primary border-primary/30 uppercase font-black text-[10px]">
                        {matchStatus === 'MATCHED' ? 'Vinculado a Excel' : 'Registro Único PDF'}
                      </Badge>
                    </CardHeader>
                    
                    <CardContent className="pt-8 space-y-8">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Impacto Neto</p>
                          <p className="text-lg font-bold text-primary">{formatCurrency(results.extractedData.financialImpact.netImpact)}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Acumulado</p>
                          <p className="text-lg font-bold text-slate-800">{formatCurrency(results.extractedData.financialImpact.accumulatedAmount)}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Apéndice F</p>
                          <div className="flex items-center gap-2">
                            {results.extractedData.antiCorruption.appendixF ? <ShieldCheck className="h-5 w-5 text-emerald-500" /> : <ShieldAlert className="h-5 w-5 text-rose-500" />}
                            <span className="text-xs font-bold">{results.extractedData.antiCorruption.appendixF ? 'INCLUIDO' : 'NO INCLUIDO'}</span>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Red Flags</p>
                          <div className="flex items-center gap-2">
                            {results.extractedData.antiCorruption.redFlagsChecked ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                            <span className="text-xs font-bold">{results.extractedData.antiCorruption.redFlagsChecked ? 'VERIFICADO' : 'PENDIENTE'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                        <h4 className="text-xs font-black uppercase text-primary mb-4 flex items-center gap-2 tracking-widest">
                          <BrainCircuit className="h-5 w-5" /> Análisis IA de Causa Raíz
                        </h4>
                        <div className="grid md:grid-cols-3 gap-6">
                          <div className="md:col-span-2 space-y-4">
                            <p className="text-sm text-slate-700 leading-relaxed italic">
                              "{results.extractedData.standardizedDescription}"
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold">
                                Causa Real: {results.extractedData.semanticAnalysis?.causaRaizReal}
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

                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Info className="h-4 w-4" /> Datos de Proyecto
                          </h4>
                          <div className="border rounded-xl overflow-hidden">
                            <Table className="text-[11px]">
                              <TableBody>
                                <TableRow className="bg-slate-50/50"><TableCell className="font-bold">Nombre</TableCell><TableCell>{results.extractedData.projectInfo.projectName}</TableCell></TableRow>
                                <TableRow><TableCell className="font-bold">Formato / Proto</TableCell><TableCell>{results.extractedData.projectInfo.format} / {results.extractedData.projectInfo.proto}</TableCell></TableRow>
                                <TableRow className="bg-slate-50/50"><TableCell className="font-bold">Área Solicitante</TableCell><TableCell>{results.extractedData.projectInfo.requestingArea}</TableCell></TableRow>
                                <TableRow><TableCell className="font-bold">Causa Declarada</TableCell><TableCell>{results.extractedData.projectInfo.rootCauseDeclared}</TableCell></TableRow>
                                <TableRow className="bg-slate-50/50"><TableCell className="font-bold">Planos a Modificar</TableCell><TableCell>{results.extractedData.descriptionSection.modifications || "N/A"}</TableCell></TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Users className="h-4 w-4" /> Asociados a Cargo
                          </h4>
                          <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                            <Table className="text-[10px]">
                              <TableHeader className="bg-slate-50">
                                <TableRow>
                                  <TableHead>Área</TableHead>
                                  <TableHead>Nombre</TableHead>
                                  <TableHead className="text-center">Firma</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {results.extractedData.associates.map((associate: any, i: number) => (
                                  <TableRow key={i} className="hover:bg-slate-50/50">
                                    <TableCell className="font-bold">{associate.area}</TableCell>
                                    <TableCell>{associate.name}</TableCell>
                                    <TableCell className="text-center">
                                      {associate.hasSignature ? <Badge className="bg-emerald-500 text-[8px] h-4">VALIDADA</Badge> : <Badge variant="outline" className="text-[8px] h-4">VACÍO</Badge>}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="h-[600px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-muted-foreground bg-white/50 space-y-4">
                  <div className="bg-slate-100 p-6 rounded-full">
                    <FileText className="h-20 w-20 opacity-20" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-400">Esperando Formato Oficial</p>
                    <p className="text-xs mt-1">Soporta PDFs firmados de Desarrollo Inmobiliario Walmart</p>
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
