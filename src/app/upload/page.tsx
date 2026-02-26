
"use client"

import React, { useState } from 'react';
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
  X,
  Zap,
  BrainCircuit,
  SearchCode
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { processExcelFile, CANONICAL_SCHEMA } from '@/lib/excel-processor';
import { useFirestore } from '@/firebase';
import { doc, writeBatch, setDoc, getCountFromServer, collection } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { correlateHeaders } from '@/ai/flows/header-correlation-flow';
import * as XLSX from 'xlsx';

export default function UploadPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCorrelating, setIsCorrelating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ total: 0 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const startAnalysis = async () => {
    if (selectedFiles.length === 0 || !db) return;
    
    setIsUploading(true);
    setProgress(5);
    let totalProcessed = 0;
    let totalImpactAcc = 0;
    const disciplineMap: Record<string, { impact: number, count: number }> = {};
    const causeMap: Record<string, { impact: number, count: number }> = {};

    try {
      for (const file of selectedFiles) {
        setIsCorrelating(true);
        const reader = new FileReader();
        const headerSample = await new Promise<string[]>((resolve) => {
          reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', sheetRows: 1 });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const headers = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0] as string[];
            resolve(headers.map(h => String(h)));
          };
          reader.readAsArrayBuffer(file);
        });

        await correlateHeaders({ headers: headerSample, canonicalSchema: CANONICAL_SCHEMA });
        setIsCorrelating(false);

        const buffer = await file.arrayBuffer();
        const { data } = processExcelFile(buffer);
        
        const batchId = crypto.randomUUID();
        const chunkSize = 400; // Optimizado para Firestore
        
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const firestoreBatch = writeBatch(db);
          
          chunk.forEach((row) => {
            const impact = row.impactoNeto || 0;
            totalImpactAcc += impact;
            
            // Agregación local para metadatos
            const disc = row.disciplina_normalizada || 'Indefinida';
            const cause = row.causaRaiz || 'Errores / Omisiones';
            
            if (!disciplineMap[disc]) disciplineMap[disc] = { impact: 0, count: 0 };
            disciplineMap[disc].impact += impact;
            disciplineMap[disc].count += 1;

            if (!causeMap[cause]) causeMap[cause] = { impact: 0, count: 0 };
            causeMap[cause].impact += impact;
            causeMap[cause].count += 1;

            const orderId = `${batchId}_${row.rowNumber}`;
            const orderRef = doc(db, 'orders', orderId);
            firestoreBatch.set(orderRef, {
              ...row,
              id: orderId,
              importBatchId: batchId,
              classification_status: 'pending',
              processedAt: new Date().toISOString()
            });
          });

          await firestoreBatch.commit();
          totalProcessed += chunk.length;
          setProgress(Math.min(95, (totalProcessed / data.length) * 100));
        }
      }

      // Materializar Agregados Globales (Single Source of Truth)
      const globalSnapshot = await getCountFromServer(collection(db, 'orders'));
      const finalTotalCount = globalSnapshot.data().count;

      await setDoc(doc(db, 'aggregates', 'global_stats'), {
        totalOrders: finalTotalCount,
        totalImpact: totalImpactAcc,
        disciplines: disciplineMap,
        rootCauses: causeMap,
        lastUpdate: new Date().toISOString()
      }, { merge: true });

      setStats({ total: totalProcessed });
      setProgress(100);
      toast({ title: "Universo Normalizado", description: `Se han cargado ${totalProcessed} registros.` });
      setSelectedFiles([]);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Ingesta", description: error.message });
    } finally {
      setTimeout(() => { setIsUploading(false); setProgress(0); }, 1000);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800 uppercase tracking-tight">Carga de Bitácoras Masivas</h1>
          </div>
          {stats.total > 0 && (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 gap-1.5 py-1 px-3">
              <CheckCircle2 className="h-3 w-3" /> {stats.total} Homologados
            </Badge>
          )}
        </header>

        <main className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-8">
          <Card className="border-none shadow-xl bg-white overflow-hidden rounded-3xl">
            <CardHeader className="bg-slate-900 text-white p-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-2xl">
                  <SearchCode className="h-8 w-8 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-headline font-bold uppercase">Motor de Ingesta Institucional</CardTitle>
                  <CardDescription className="text-slate-400">Normaliza el universo completo de 11,150+ registros sin truncamiento</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div 
                className={`border-2 border-dashed rounded-3xl p-16 text-center transition-all cursor-pointer group ${isUploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50 hover:bg-primary/5 border-slate-200'}`}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <div className="bg-primary/10 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 uppercase">Subir Archivo de Gran Volumen</h3>
                <p className="text-sm text-slate-500 mt-2">Compatible con archivos de más de 10,000 filas.</p>
                <Input id="file-upload" type="file" className="hidden" multiple accept=".xlsx,.xls" onChange={handleFileChange} />
              </div>

              {selectedFiles.length > 0 && (
                <div className="grid gap-3">
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                      <div className="flex items-center gap-4">
                        <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                        <span className="text-sm font-bold text-slate-700">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}><X className="h-5 w-5" /></Button>
                    </div>
                  ))}
                </div>
              )}

              {isUploading ? (
                <div className="space-y-6 bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-primary uppercase flex items-center gap-2">
                      {isCorrelating ? <BrainCircuit className="h-4 w-4 animate-pulse" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                      {isCorrelating ? "Mapeando Esquema con IA..." : "Sincronizando Universo Total..."}
                    </span>
                    <span className="text-2xl font-headline font-bold text-primary">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2.5 bg-slate-200" />
                </div>
              ) : (
                <Button 
                  className="w-full bg-primary h-16 text-lg font-headline font-bold uppercase tracking-widest rounded-2xl shadow-xl"
                  disabled={selectedFiles.length === 0}
                  onClick={startAnalysis}
                >
                  <Zap className="h-5 w-5 mr-3 text-accent fill-accent" />
                  Iniciar Normalización Estructural
                </Button>
              )}
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
