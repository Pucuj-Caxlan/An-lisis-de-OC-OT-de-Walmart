
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

const normalizeFormatName = (name: any) => {
  if (!name) return 'FORMATO NO ESPECIFICADO';
  const n = String(name).trim().toUpperCase();
  if (n.includes('MI BODEGA') || n === 'MBA') return 'MI BODEGA AURRERA';
  if (n.includes('EXPRESS') && (n.includes('BODEGA') || n.includes('BA'))) return 'BODEGA AURRERA EXPRESS';
  if (n === 'BODEGA AURRERA' || n === 'BAE' || n === 'BODEGA' || n === 'AURRERA' || n === 'BA') return 'BODEGA AURRERA';
  if (n.includes('SAMS') || n.includes("SAM'S")) return "SAM'S CLUB";
  if (n.includes('SUPERCENTER') || n.includes('WALMART SC') || n === 'SC' || n === 'WS') return 'WALMART SUPERCENTER';
  if (n.includes('EXPRESS') || n.includes('SUPERAMA')) return 'WALMART EXPRESS';
  if (n.includes('WALMART')) return 'WALMART SUPERCENTER';
  return n;
};

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
            let disc = String(row.disciplina_normalizada || 'INDEFINIDA').trim().toUpperCase();
            let sub = String(row.subcausa_normalizada || 'SIN SUB-DISCIPLINA').trim().toUpperCase();
            let cause = String(row.causaRaiz || 'ERRORES / OMISIONES').trim().toUpperCase();

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
            batch.set(doc(db, 'orders', orderId), { ...row, id: orderId, importBatchId: batchId, classification_status: 'pending', processedAt: new Date().toISOString() });
          });
          await batch.commit();
          setProgress(Math.min(95, (i / data.length) * 100));
        }
      }

      const globalBatch = writeBatch(db);
      // Solo guardar métricas totales en global_stats para evitar error de índices
      globalBatch.set(doc(db, 'aggregates', 'global_stats'), { 
        totalImpact: totalImpactAcc, 
        lastUpdate: new Date().toISOString() 
      }, { merge: true });

      Object.entries(discMap).forEach(([name, data]) => globalBatch.set(doc(db, 'taxonomy_disciplines', name.substring(0, 100)), { ...data, id: name }));
      Object.entries(causeMap).forEach(([name, data]) => globalBatch.set(doc(db, 'taxonomy_causes', name.substring(0, 100)), { ...data, id: name }));
      await globalBatch.commit();

      toast({ title: "Universo Normalizado", description: "Taxonomía guardada con éxito." });
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
                <Upload className="h-10 w-10 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-bold uppercase">Subir Archivo de Gran Volumen</h3>
                <p className="text-sm text-slate-500 mt-2">Sincroniza el universo real (&gt;10,000 filas) sin bloqueos.</p>
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
