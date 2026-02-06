
"use client"

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  X,
  Database,
  BarChart
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { processExcelFile, NormalizedRow } from '@/lib/excel-processor';
import { useFirestore } from '@/firebase';
import { doc, setDoc, writeBatch, collection } from 'firebase/firestore';

export default function UploadPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, errors: 0 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (selectedFiles.length === 0 || !db) return;
    
    setIsUploading(true);
    setProgress(5);
    let totalProcessed = 0;
    let totalErrors = 0;

    try {
      for (const file of selectedFiles) {
        const buffer = await file.arrayBuffer();
        const { data, errors } = processExcelFile(buffer);
        
        totalProcessed += data.length;
        totalErrors += errors.length;

        // 1. Create Import Batch record
        const batchId = crypto.randomUUID();
        const batchRef = doc(db, 'importBatches', batchId);
        
        await setDoc(batchRef, {
          id: batchId,
          fileName: file.name,
          importDate: new Date().toISOString(),
          status: 'PROCESSING',
          stats: {
            totalRows: data.length + errors.length,
            processedRows: data.length,
            errorCount: errors.length,
            totalImpact: data.reduce((acc, curr) => acc + curr.impactoNeto, 0)
          },
          errors: errors.slice(0, 100) // Log first 100 errors
        });

        // 2. Write Orders in chunks to Firestore
        const chunkSize = 100;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const firestoreBatch = writeBatch(db);
          
          chunk.forEach((row) => {
            const orderId = `${batchId}_${row.sheetName}_${row.rowNumber}`;
            const orderRef = doc(db, 'orders', orderId);
            firestoreBatch.set(orderRef, {
              ...row,
              id: orderId,
              importBatchId: batchId
            });
          });

          await firestoreBatch.commit();
          const currentProgress = Math.min(95, 10 + (i / data.length) * 80);
          setProgress(currentProgress);
        }

        await setDoc(batchRef, { status: 'COMPLETED' }, { merge: true });
      }

      setProgress(100);
      toast({
        title: "Ingesta Finalizada",
        description: `Se procesaron ${totalProcessed} registros con éxito. ${totalErrors} errores encontrados.`,
      });
      setSelectedFiles([]);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error de Ingesta",
        description: "Ocurrió un error al procesar los archivos o guardar en Firebase.",
      });
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setProgress(0);
      }, 1000);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white px-6">
          <SidebarTrigger />
          <h1 className="text-xl font-headline font-bold text-slate-800">Ingesta & Normalización (Etapa 2)</h1>
        </header>

        <main className="p-6 md:p-8 max-w-4xl mx-auto w-full">
          <Card className="border-none shadow-sm mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center gap-2">
                <Database className="h-6 w-6 text-primary" />
                Carga Masiva OC/OT
              </CardTitle>
              <CardDescription>
                Estructuras soportadas: CAM, BAE, B2, S3. El sistema autodetectará las cabeceras y aplicará el esquema canónico.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 cursor-pointer group"
                onClick={() => !isUploading && document.getElementById('file-upload')?.click()}
              >
                <div className="bg-primary/10 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Arrastre sus archivos .xlsx</h3>
                <p className="text-sm text-muted-foreground mt-2">Detección automática de hojas y limpieza de datos integrada</p>
                <Input 
                  id="file-upload" 
                  type="file" 
                  className="hidden" 
                  multiple 
                  accept=".xlsx,.xls" 
                  onChange={handleFileChange}
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Lote de Importación</h4>
                  <div className="grid gap-2">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          disabled={isUploading}
                          className="h-8 w-8 text-slate-400 hover:text-rose-600"
                          onClick={() => removeFile(i)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isUploading ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Normalizando y guardando en Firebase...
                    </span>
                    <span className="text-primary font-bold">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ) : (
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 py-6 text-lg font-headline font-bold shadow-lg"
                  disabled={selectedFiles.length === 0}
                  onClick={startAnalysis}
                >
                  Procesar & Unificar Datos
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-none shadow-sm bg-slate-800 text-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-bold text-sm">Validación</h3>
                </div>
                <p className="text-xs opacity-70">Limpieza de #VALUE!, conversión de moneda y normalización de fechas ISO.</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-primary text-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart className="h-5 w-5 text-white" />
                  <h3 className="font-bold text-sm">KPIs Base</h3>
                </div>
                <p className="text-xs opacity-70">Cálculo automático de Impacto Neto (Aditiva - Deductiva) por registro.</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-accent text-white">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="h-5 w-5 text-white" />
                  <h3 className="font-bold text-sm">Trazabilidad</h3>
                </div>
                <p className="text-xs opacity-70">Registro detallado de errores por fila para auditoría de archivos fuente.</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
