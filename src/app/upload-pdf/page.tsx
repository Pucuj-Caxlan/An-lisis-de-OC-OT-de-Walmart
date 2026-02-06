
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
  Link as LinkIcon
} from 'lucide-react';
import { extractPdfData, ExtractPdfDataOutput } from '@/ai/flows/extract-pdf-data-flow';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

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
        // Vinculación con registro existente
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
        // Crear registro nuevo
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
          <h1 className="text-xl font-headline font-bold text-slate-800">Ingesta de PDFs Inteligente</h1>
        </header>

        <main className="p-6 md:p-8 max-w-5xl mx-auto w-full">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1 border-none shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Subir Documento</CardTitle>
                <CardDescription>Formatos OC/OT estándar de Walmart</CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                  onClick={() => !isProcessing && document.getElementById('pdf-upload')?.click()}
                >
                  <Upload className="h-8 w-8 text-primary mx-auto mb-3" />
                  <p className="text-xs font-medium text-slate-600">Click para seleccionar PDF</p>
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
                        Analizando con Gemini 2.5...
                      </span>
                    </div>
                    <Progress value={65} className="h-1" />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="md:col-span-2 space-y-6">
              {results ? (
                <>
                  <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 border-b pb-4">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          Resultados de Extracción
                        </CardTitle>
                        <CardDescription>Precisión detectada: {(results.confidence * 100).toFixed(0)}%</CardDescription>
                      </div>
                      <Badge variant={matchStatus === 'MATCHED' ? 'default' : 'secondary'}>
                        {matchStatus === 'MATCHED' ? (
                          <div className="flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Vinculado a Excel</div>
                        ) : (
                          "Nuevo Registro"
                        )}
                      </Badge>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Proyecto / PID</p>
                          <p className="text-sm font-bold text-slate-800">{results.extractedData.projectName} ({results.extractedData.projectId})</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Impacto Neto</p>
                          <p className="text-sm font-bold text-primary">{formatCurrency(results.extractedData.impactAmount)}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-2">
                            <BrainCircuit className="h-4 w-4 text-primary" />
                            Descripción Estandarizada por IA
                          </h4>
                          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg text-sm text-slate-700 italic leading-relaxed">
                            {results.extractedData.standardizedDescription}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Análisis de Calidad (QC)
                          </h4>
                          <div className="space-y-2">
                            {results.extractedData.qcAnalysis.map((qc, i) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-white border rounded-lg">
                                <Badge variant={qc.severity === 'High' ? 'destructive' : 'secondary'} className="mt-0.5 text-[8px]">
                                  {qc.severity}
                                </Badge>
                                <div className="text-xs">
                                  <p className="font-bold text-slate-800">{qc.flag}</p>
                                  <p className="text-muted-foreground">{qc.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="h-[400px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-muted-foreground">
                  <FileText className="h-12 w-12 opacity-10 mb-4" />
                  <p className="text-sm">Suba un PDF para comenzar el análisis inteligente</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
