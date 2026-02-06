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
  Search,
  BrainCircuit,
  Link as LinkIcon,
  ShieldCheck,
  ShieldAlert,
  Info
} from 'lucide-react';
import { extractPdfData, ExtractPdfDataOutput } from '@/ai/flows/extract-pdf-data-flow';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

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
    setMatchStatus('PENDING');

    try {
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const extracted = await extractPdfData({ pdfDataUri: dataUri });
      setResults(extracted);

      // --- LOGICA DE MATCH ---
      const { projectId, orderNumber } = extracted.extractedData;
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef, 
        where('projectId', '==', projectId),
        where('orderNumber', '==', orderNumber)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'orders', existingDoc.id), {
          ...extracted.extractedData,
          pdfUrl: 'simulated_url',
          createdFromPdf: false,
          lastUpdatedFromPdf: new Date().toISOString()
        });
        setMatchStatus('MATCHED');
        toast({ title: "Documento Vinculado", description: "Se actualizó un registro de Excel existente." });
      } else {
        const newId = `pdf_${projectId}_${Date.now()}`;
        await setDoc(doc(db, 'orders', newId), {
          ...extracted.extractedData,
          id: newId,
          pdfUrl: 'simulated_url',
          createdFromPdf: true,
          importBatchId: 'PDF_INGEST'
        });
        setMatchStatus('NEW');
        toast({ title: "Nuevo Registro Creado", description: "No se encontró coincidencia en Excel, se generó un nuevo registro." });
      }

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar el PDF." });
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
          <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Auditoría Digital de Documentos</h1>
        </header>

        <main className="p-6 md:p-8 max-w-6xl mx-auto w-full">
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="md:col-span-1 border-none shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Ingesta PDF</CardTitle>
                <CardDescription>Cargue el formato oficial de OT/OC</CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                  onClick={() => !isProcessing && document.getElementById('pdf-upload')?.click()}
                >
                  <Upload className="h-8 w-8 text-primary mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-600">SELECCIONAR ARCHIVO</p>
                  <Input 
                    id="pdf-upload" 
                    type="file" 
                    className="hidden" 
                    accept=".pdf" 
                    onChange={handleFileUpload}
                  />
                </div>
                {isProcessing && (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        Ocr Semántico...
                      </span>
                    </div>
                    <Progress value={75} className="h-1" />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-3 space-y-6">
              {results ? (
                <>
                  <Card className="border-none shadow-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b pb-4">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          Extracción Exitosa
                        </CardTitle>
                        <CardDescription>
                          PID: <span className="font-bold text-slate-800">{results.extractedData.projectId}</span> | 
                          Orden: <span className="font-bold text-slate-800">{results.extractedData.orderNumber}</span>
                        </CardDescription>
                      </div>
                      <Badge variant={matchStatus === 'MATCHED' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                        {matchStatus === 'MATCHED' ? 'Vinculado a Excel' : 'Registro Nuevo'}
                      </Badge>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg border">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Impacto Neto</p>
                          <p className="text-sm font-bold text-primary">{formatCurrency(results.extractedData.impactAmount)}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Monto Acumulado</p>
                          <p className="text-sm font-bold text-slate-700">{formatCurrency(results.extractedData.accumulatedAmount || 0)}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Apéndice F</p>
                          <div className="flex items-center gap-1">
                            {results.extractedData.appendixF ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-rose-500" />}
                            <span className="text-xs font-bold">{results.extractedData.appendixF ? 'INCLUIDO' : 'NO INCLUIDO'}</span>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Red Flags</p>
                          <div className="flex items-center gap-1">
                            {results.extractedData.redFlagsVerified ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                            <span className="text-xs font-bold">{results.extractedData.redFlagsVerified ? 'VERIFICADO' : 'PENDIENTE'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                          <h4 className="text-xs font-black uppercase text-primary mb-3 flex items-center gap-2">
                            <BrainCircuit className="h-4 w-4" /> Descripción Estandarizada Walmart
                          </h4>
                          <p className="text-sm text-slate-700 leading-relaxed italic">
                            {results.extractedData.standardizedDescription}
                          </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                              <Info className="h-4 w-4" /> Detalles del Proyecto
                            </h4>
                            <div className="text-xs space-y-2 bg-slate-50 p-3 rounded-lg border">
                              <p><span className="text-muted-foreground">Nombre:</span> {results.extractedData.projectName}</p>
                              <p><span className="text-muted-foreground">Formato:</span> {results.extractedData.format}</p>
                              <p><span className="text-muted-foreground">Etapa:</span> {results.extractedData.projectStage}</p>
                              <p><span className="text-muted-foreground">Causa Raíz:</span> {results.extractedData.causaRaiz}</p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-500" /> Control de Calidad (QC)
                            </h4>
                            <div className="space-y-2">
                              {results.extractedData.qcAnalysis.map((qc, i) => (
                                <div key={i} className="flex items-start gap-3 p-2 bg-white border rounded-lg shadow-sm">
                                  <Badge variant={qc.severity === 'High' ? 'destructive' : 'secondary'} className="text-[8px] h-4">
                                    {qc.severity}
                                  </Badge>
                                  <div className="text-[11px]">
                                    <p className="font-bold text-slate-800">{qc.flag}</p>
                                    <p className="text-muted-foreground leading-tight">{qc.message}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="h-[500px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground bg-white/50">
                  <FileText className="h-16 w-16 opacity-10 mb-4" />
                  <p className="text-sm font-medium">Cargue un PDF para ver el desglose semántico</p>
                  <p className="text-[10px] mt-1">Soporta formatos oficiales de Desarrollo Inmobiliario</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
