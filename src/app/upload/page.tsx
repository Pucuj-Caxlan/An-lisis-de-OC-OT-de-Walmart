"use client"

import React, { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  Loader2,
  AlertCircle,
  X
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

export default function UploadPage() {
  const { toast } = useToast();
  const [files, setFiles] = useState<{name: string, size: string, type: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => ({
        name: f.name,
        size: (f.size / 1024).toFixed(2) + ' KB',
        type: f.name.endsWith('.pdf') ? 'pdf' : 'excel'
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setProgress(0);

    // Simulate upload and normalization process
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 400);

    setTimeout(() => {
      setIsUploading(false);
      setProgress(0);
      setFiles([]);
      toast({
        title: "Ingesta Exitosa",
        description: "Los datos han sido normalizados y guardados en Firebase correctamente.",
      });
    }, 4500);
  };

  return (
    <div className="flex min-h-screen w-full bg-background/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white px-6">
          <SidebarTrigger />
          <h1 className="text-xl font-headline font-bold text-slate-800">Ingesta y Normalización</h1>
        </header>

        <main className="p-6 md:p-8 max-w-4xl mx-auto w-full">
          <Card className="border-none shadow-sm mb-8">
            <CardHeader>
              <CardTitle className="text-xl font-headline">Carga de Documentos OC/OT</CardTitle>
              <CardDescription>
                Sube archivos Excel (.xlsx) o reportes PDF. Nuestro sistema normalizará automáticamente los campos 
                para el esquema unificado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 cursor-pointer group"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <div className="bg-primary/10 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Suelte archivos aquí</h3>
                <p className="text-sm text-muted-foreground mt-2">o haga clic para seleccionar archivos desde su ordenador</p>
                <Input 
                  id="file-upload" 
                  type="file" 
                  className="hidden" 
                  multiple 
                  accept=".pdf,.xlsx,.xls" 
                  onChange={handleFileChange}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Archivos Seleccionados</h4>
                  <div className="grid gap-2">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                          {file.type === 'excel' ? (
                            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <FileText className="h-5 w-5 text-rose-600" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground">{file.size}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
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
                      Procesando y normalizando datos...
                    </span>
                    <span className="text-primary font-bold">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              ) : (
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 py-6 text-lg font-headline font-bold"
                  disabled={files.length === 0}
                  onClick={startAnalysis}
                >
                  Iniciar Análisis de Datos
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-none shadow-sm bg-primary text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <CheckCircle2 className="h-5 w-5" /> Normalización Automática
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm opacity-90">
                Nuestro motor de IA identifica automáticamente campos como: Formato, País, Año, Plan, Área y Montos, 
                mapeándolos al esquema unificado de Walmart para reportes transversales.
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-accent text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <AlertCircle className="h-5 w-5" /> Reglas de Validación
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm opacity-90">
                Se aplican filtros de validación para detectar errores de formato en el origen y discrepancias numéricas 
                antes de guardar los registros en el almacén de datos.
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}