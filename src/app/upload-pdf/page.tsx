
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

    try {
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const extracted = await extractPdfData({ pdfDataUri: dataUri });
      if (!extracted?.extractedData) throw new Error("No se pudo extraer información integral del documento.");

      const semantic = await analyzeOrderSemantically({
        descripcion: extracted.extractedData.technicalJustification?.description || "",
        contexto: {
          justificacionDetallada: extracted.extractedData.technicalJustification?.detailedReasoning
        } as any
      });

      const completeness = calculateCompleteness(extracted.extractedData);

      // Sanitizamos el ID para evitar errores de ruta en Firestore
      const safeId = `pdf_${extracted.extractedData.projectInfo?.projectId}_${extracted.extractedData.header?.orderNumber}`.replace(/[\/\s]+/g, '_');

      const homogenizedData = {
        ...extracted.extractedData,
        id: safeId,
        projectId: extracted.extractedData.projectInfo?.projectId || "N/A",
        projectName: extracted.extractedData.projectInfo?.projectName || "N/A",
        impactoNeto: extracted.extractedData.financialImpact?.netImpact || 0,
        causaRaiz: extracted.extractedData.projectInfo?.rootCauseDeclared || "Sin definir",
        descripcion: extracted.extractedData.technicalJustification?.description || "",
        fechaSolicitud: extracted.extractedData.header?.requestDate || new Date().toISOString(),
        isSigned: extracted.extractedData.governance?.isSigned || false,
        semanticAnalysis: semantic,
        processedAt: new Date().toISOString(),
        classification_status: 'auto'
      };

      setResults({ ...extracted, extractedData: homogenizedData });

      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, where('projectId', '==', homogenizedData.projectId), where('orderNumber', '==', homogenizedData.orderNumber));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        updateDocumentNonBlocking(doc(db, 'orders', querySnapshot.docs[0].id), homogenizedData);
      } else {
        setDocumentNonBlocking(doc(db, 'orders', homogenizedData.id), homogenizedData, { merge: true });
      }
      
      toast({ title: "Expediente Generado", description: "Auditado con éxito." });

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
                <CardDescription className="text-slate-400 text-xs">Sube el formato oficial</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div 
                  className="border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer group hover:border-primary/50 hover:bg-primary/5 border-slate-200"
                  onClick={() => !isProcessing && document.getElementById('pdf-upload')?.click()}
                >
                  <FileText className="h-8 w-8 text-primary mx-auto mb-4" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargar PDF Oficial</p>
                  <Input id="pdf-upload" type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                </div>
              </CardContent>
            </Card>

            <div className="md:col-span-3">
              {results?.extractedData ? (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card className="p-4 border-none shadow-md bg-white rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${results.extractedData.isSigned ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                          <Signature className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Estatus DocuSign</p>
                          <p className="text-xs font-bold">{results.extractedData.isSigned ? 'VALIDADO' : 'SIN FIRMA'}</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <Card className="border-none shadow-xl overflow-hidden bg-white rounded-3xl">
                    <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between p-6">
                      <div>
                        <Badge className="bg-primary uppercase text-[8px] font-black">OT #{results.extractedData.orderNumber}</Badge>
                        <CardTitle className="text-xl font-headline font-bold uppercase mt-1">{results.extractedData.projectId}</CardTitle>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase">Impacto Neto</p>
                        <p className="text-2xl font-headline font-bold text-primary">{formatCurrency(results.extractedData.impactoNeto)}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                       <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                          <p className="text-xs font-bold text-slate-800 mb-2 uppercase">{results.extractedData.semanticAnalysis?.disciplina_normalizada}</p>
                          <p className="text-[11px] text-slate-600 italic">"{results.extractedData.descripcion}"</p>
                       </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="h-[500px] border-2 border-dashed rounded-3xl flex flex-col items-center justify-center text-slate-300 bg-white/50 border-slate-200">
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
