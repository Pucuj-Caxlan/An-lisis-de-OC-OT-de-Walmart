
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
  CheckCircle2, 
  Loader2,
  AlertCircle,
  X,
  Database,
  BarChart,
  ShieldCheck,
  Zap,
  Layers
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { processExcelFile, NormalizedRow } from '@/lib/excel-processor';
import { useFirestore } from '@/firebase';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

export default function UploadPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0, errors: 0, avgQuality: 0 });

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
    let qualitySum = 0;

    try {
      for (const file of selectedFiles) {
        const buffer = await file.arrayBuffer();
        const { data, errors } = processExcelFile(buffer);
        
        totalProcessed += data.length;
        totalErrors += errors.length;
        const fileQuality = data.reduce((acc, curr) => acc + curr.structuralQuality, 0) / (data.length || 1);
        qualitySum += fileQuality;

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
            avgQuality: Math.round(fileQuality),
            totalImpact: data.reduce((acc, curr) => acc + curr.impactoNeto, 0)
          },
          errors: errors.slice(0, 100)
        });

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
              importBatchId: batchId,
              dataSource: 'EXCEL_ORIGINAL'
            });
          });

          await firestoreBatch.commit();
          const currentProgress = Math.min(95, 10 + (i / data.length) * 80);
          setProgress(currentProgress);
        }

        await setDoc(batchRef, { status: 'COMPLETED' }, { merge: true });
      }

      setStats({ total: totalProcessed, errors: totalErrors, avgQuality: Math.round(qualitySum / selectedFiles.length) });
      setProgress(100);
      toast({
        title: "Normalización Exitosa",
        description: `Se han unificado ${totalProcessed} registros con un índice de calidad del ${Math.round(qualitySum / selectedFiles.length)}%.`,
      });
      setSelectedFiles([]);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error de Ingesta",
        description: "Fallo estructural en el procesamiento de archivos.",
      });
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setProgress(0);
      }, 1500);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Ingesta & Normalización Forense</h1>
          </div>
          {stats.total > 0 && (
            <div className="flex items-center gap-4 animate-in fade-in zoom-in">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 gap-1.5 py-1 px-3">
                <CheckCircle2 className="h-3 w-3" /> {stats.total} Procesados
              </Badge>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 gap-1.5 py-1 px-3">
                <ShieldCheck className="h-3 w-3" /> Calidad: {stats.avgQuality}%
              </Badge>
            </div>
          )}
        </header>

        <main className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-8">
          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-3xl">
            <CardHeader className="bg-slate-900 text-white p-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <Database className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-headline font-bold uppercase tracking-tight">Carga Estructural de Datos</CardTitle>
                  <CardDescription className="text-slate-400">Motor de homologación inteligente PDF ↔ Excel ↔ Database</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div 
                className={`border-2 border-dashed rounded-3xl p-16 text-center transition-all duration-500 cursor-pointer group ${isUploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50 hover:bg-primary/5 border-slate-200'}`}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <div className="bg-primary/10 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-inner">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Arrastre archivos .xlsx o .xls</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">El sistema detectará automáticamente el esquema y aplicará correcciones semánticas en tiempo real.</p>
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
                <div className="space-y-4 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Lote Seleccionado</h4>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{selectedFiles.length} Archivos</span>
                  </div>
                  <div className="grid gap-3">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:bg-white hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-white rounded-xl shadow-sm">
                            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">{file.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase">{(file.size / 1024).toFixed(1)} KB • Pendiente de análisis</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeFile(i)}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isUploading ? (
                <div className="space-y-6 bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-sm font-black text-primary uppercase flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Normalizando registros...
                      </span>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ejecutando mapeo de esquema y limpieza de tipos</p>
                    </div>
                    <span className="text-2xl font-headline font-bold text-primary">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2.5 bg-slate-200" />
                </div>
              ) : (
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 h-16 text-lg font-headline font-bold uppercase tracking-widest shadow-2xl shadow-primary/20 rounded-2xl group"
                  disabled={selectedFiles.length === 0}
                  onClick={startAnalysis}
                >
                  <Zap className="h-5 w-5 mr-3 text-accent fill-accent animate-pulse group-hover:scale-125 transition-transform" />
                  Iniciar Normalización Estructural
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-none shadow-sm bg-white rounded-3xl border border-slate-100 p-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-sm uppercase tracking-tight">Validación Tipada</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Detección automática de fechas ISO, conversión de moneda y limpieza de errores estructurales de Excel.</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white rounded-3xl border border-slate-100 p-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <Layers className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-sm uppercase tracking-tight">Mapeo Canónico</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Homologación de nombres de columnas contra el estándar global de Walmart para asegurar coherencia semántica.</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white rounded-3xl border border-slate-100 p-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-accent/10 rounded-xl text-accent">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-sm uppercase tracking-tight">Índice de Calidad</h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Cálculo de integridad por registro para alertar sobre información incompleta antes del análisis de la IA.</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
