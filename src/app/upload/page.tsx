
"use client"

import React, { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Upload, 
  X
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { processExcelFile, CANONICAL_SCHEMA } from '@/lib/excel-processor';
import { useFirestore } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { correlateHeaders } from '@/ai/flows/header-correlation-flow';
import * as XLSX from 'xlsx';

export default function UploadPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const startAnalysis = async () => {
    if (selectedFiles.length === 0 || !db) return;
    setIsUploading(true);
    setProgress(5);
    let totalImpactAcc = 0;
    const discMap: Record<string, any> = {};
    const causeMap: Record<string, any> = {};

    try {
      for (const file of selectedFiles) {
        const reader = new FileReader();
        const headerSample = await new Promise<string[]>((resolve) => {
          reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', sheetRows: 1 });
            const headers = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 })[0] as string[];
            resolve(headers.map(h => String(h)));
          };
          reader.readAsArrayBuffer(file);
        });
        await correlateHeaders({ headers: headerSample, canonicalSchema: CANONICAL_SCHEMA });

        const buffer = await file.arrayBuffer();
        const { data } = processExcelFile(buffer);
        const batchId = crypto.randomUUID();
        const chunkSize = 400;
        
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach((row) => {
            const impact = row.impactoNeto || 0;
            totalImpactAcc += impact;
            
            // NORMALIZACIÓN ESTRICTA: Crucial para el Dashboard VP
            let disc = String(row.disciplina_normalizada || 'PENDIENTE').trim().toUpperCase();
            let sub = String(row.subcausa_normalizada || 'SIN SUB-DISCIPLINA').trim().toUpperCase();
            let cause = String(row.causaRaiz || 'ERRORES / OMISIONES').trim().toUpperCase();
            let format = String(row.format || 'SIN FORMATO').trim().toUpperCase();

            if (!discMap[disc]) discMap[disc] = { impact: 0, count: 0, subs: {} };
            discMap[disc].impact += impact;
            discMap[disc].count += 1;
            if (!discMap[disc].subs[sub]) discMap[disc].subs[sub] = { impact: 0, count: 0 };
            discMap[disc].subs[sub].impact += impact;
            discMap[disc].subs[sub].count += 1;

            if (!causeMap[cause]) causeMap[cause] = { impact: 0, count: 0 };
            causeMap[cause].impact += impact;
            causeMap[cause].count += 1;

            const orderId = `${batchId}_${row.rowNumber}`;
            batch.set(doc(db, 'orders', orderId), { 
              ...row, 
              id: orderId, 
              importBatchId: batchId, 
              classification_status: 'pending', 
              processedAt: new Date().toISOString(),
              disciplina_normalizada: disc,
              subcausa_normalizada: sub,
              causa_raiz_normalizada: cause,
              format: format
            });
          });
          await batch.commit();
          setProgress(Math.min(95, (i / data.length) * 100));
        }
      }

      const globalBatch = writeBatch(db);
      globalBatch.set(doc(db, 'aggregates', 'global_stats'), { 
        totalImpact: totalImpactAcc, 
        lastUpdate: new Date().toISOString() 
      }, { merge: true });

      Object.entries(discMap).forEach(([name, data]) => {
        const safeId = name.replace(/[\/\s\.]+/g, '_').substring(0, 100);
        globalBatch.set(doc(db, 'taxonomy_disciplines', safeId), { ...data, id: safeId, name: name });
      });
      
      Object.entries(causeMap).forEach(([name, data]) => {
        const safeId = name.replace(/[\/\s\.]+/g, '_').substring(0, 100);
        globalBatch.set(doc(db, 'taxonomy_causes', safeId), { ...data, id: safeId, name: name });
      });
      
      await globalBatch.commit();

      toast({ title: "Universo Normalizado", description: "Taxonomía guardada con éxito para análisis VP." });
      setSelectedFiles([]);
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Error Ingesta", description: e.message }); 
    } finally { 
      setIsUploading(false); setProgress(0); 
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-2"><SidebarTrigger /><h1 className="text-xl font-headline font-bold text-slate-800 uppercase">Carga Masiva</h1></div>
        </header>
        <main className="p-8 max-w-5xl mx-auto w-full space-y-8">
          <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-8"><CardTitle className="text-2xl font-headline font-bold">Motor de Ingesta Escalable</CardTitle></CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer hover:bg-primary/5 border-slate-200" onClick={() => document.getElementById('file-upload')?.click()}>
                <div className="bg-primary/10 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 uppercase">Subir Archivo de Gran Volumen</h3>
                <div className="text-sm text-slate-500 mt-2">Sincroniza el universo real (&gt;10,000 filas) con estructura de árbol para Dashboard VP.</div>
                <Input id="file-upload" type="file" className="hidden" multiple accept=".xlsx,.xls" onChange={handleFileChange} />
              </div>
              {selectedFiles.length > 0 && <div className="grid gap-3">{selectedFiles.map((file, i) => <div key={i} className="flex justify-between p-4 bg-slate-50 border rounded-2xl"><span className="text-sm font-bold">{file.name}</span><Button variant="ghost" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}><X className="h-5 w-5" /></Button></div>)}</div>}
              {isUploading ? (
                <div className="space-y-6 bg-slate-50 p-8 rounded-3xl">
                  <div className="flex justify-between"><span className="text-sm font-black text-primary">SINCRONIZANDO TAXONOMÍA...</span><span className="text-2xl font-bold text-primary">{Math.round(progress)}%</span></div>
                  <Progress value={progress} className="h-2.5" />
                </div>
              ) : <Button className="w-full h-16 text-lg font-bold uppercase tracking-widest rounded-2xl" disabled={selectedFiles.length === 0} onClick={startAnalysis}>Iniciar Normalización</Button>}
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
