
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

// Función de normalización institucional para coherencia en agregados
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
    let totalProcessedInSession = 0;
    let totalImpactAcc = 0;
    
    // Jerarquía de Agregación: Disciplina > Sub-Disciplina
    const disciplineMap: Record<string, { impact: number, count: number, subs: Record<string, { impact: number, count: number }> }> = {};
    const causeMap: Record<string, { impact: number, count: number }> = {};
    const formatMap: Record<string, { impact: number, count: number }> = {};

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
            
            // Agregación local para metadatos jerárquicos
            let disc = String(row.disciplina_normalizada || 'Indefinida').trim().toUpperCase();
            let subDisc = String(row.subcausa_normalizada || 'Sin sub-disciplina').trim().toUpperCase();
            const cause = row.causaRaiz || 'Errores / Omisiones';
            const fmt = normalizeFormatName(row.format || row.type);
            
            // Limpiar claves para evitar errores de índice en Firestore
            if (disc.length > 50) disc = disc.substring(0, 50);
            if (subDisc.length > 50) subDisc = subDisc.substring(0, 50);

            // 1. Disciplina y Sub-Disciplina (Protección contra explosión de campos)
            if (!disciplineMap[disc]) disciplineMap[disc] = { impact: 0, count: 0, subs: {} };
            
            // Límite de seguridad: Solo agregamos si no hay demasiadas sub-claves únicas
            if (Object.keys(disciplineMap[disc].subs).length < 100 || disciplineMap[disc].subs[subDisc]) {
              disciplineMap[disc].impact += impact;
              disciplineMap[disc].count += 1;
              
              if (!disciplineMap[disc].subs[subDisc]) disciplineMap[disc].subs[subDisc] = { impact: 0, count: 0 };
              disciplineMap[disc].subs[subDisc].impact += impact;
              disciplineMap[disc].subs[subDisc].count += 1;
            }

            // 2. Causa Raíz
            if (!causeMap[cause]) causeMap[cause] = { impact: 0, count: 0 };
            causeMap[cause].impact += impact;
            causeMap[cause].count += 1;

            // 3. Formato
            if (!formatMap[fmt]) formatMap[fmt] = { impact: 0, count: 0 };
            formatMap[fmt].impact += impact;
            formatMap[fmt].count += 1;

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
          totalProcessedInSession += chunk.length;
          setProgress(Math.min(95, (totalProcessedInSession / data.length) * 100));
        }
      }

      // 4. Materializar Agregados Globales vía Server Aggregation
      const globalSnapshot = await getCountFromServer(collection(db, 'orders'));
      const finalTotalCount = globalSnapshot.data().count;

      await setDoc(doc(db, 'aggregates', 'global_stats'), {
        totalOrders: finalTotalCount,
        totalImpact: totalImpactAcc,
        disciplines: disciplineMap,
        rootCauses: causeMap,
        formats: formatMap,
        lastUpdate: new Date().toISOString()
      }, { merge: true });

      setStats({ total: totalProcessedInSession });
      setProgress(100);
      toast({ title: "Universo Normalizado", description: `Se han cargado ${totalProcessedInSession} registros bajo un esquema de seguridad de índices.` });
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
                  <CardTitle className="text-2xl font-headline font-bold uppercase">Motor de Ingesta Jerárquico</CardTitle>
                  <CardDescription className="text-slate-400">Normaliza Disciplinas y Sub-Disciplinas para análisis 80/20 granular.</CardDescription>
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
                <p className="text-sm text-slate-500 mt-2">Sincroniza el universo real (&gt;10,000 filas) con estructura de árbol.</p>
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
                      {isCorrelating ? "Mapeando Jerarquía con IA..." : "Sincronizando Árbol de Disciplinas..."}
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
