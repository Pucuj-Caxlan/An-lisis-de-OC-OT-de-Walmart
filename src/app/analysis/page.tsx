"use client"

import React, { useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  BrainCircuit, 
  Table as TableIcon, 
  Filter, 
  RefreshCcw,
  Sparkles,
  Info
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { MOCK_OC_DATA, OCData } from '@/lib/mock-data';
import { generateOcOtDetailedDescription } from '@/ai/flows/generate-oc-ot-detailed-description';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AnalysisPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [aiDescriptions, setAiDescriptions] = useState<Record<string, string>>({});

  const filteredData = MOCK_OC_DATA.filter(item => 
    item.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.format.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.cause.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenAI = async (item: OCData) => {
    setIsGenerating(item.id);
    try {
      const result = await generateOcOtDetailedDescription({
        format: item.format,
        country: item.country,
        year: item.year,
        plan: item.plan,
        area: item.area,
        details: item.details
      });
      setAiDescriptions(prev => ({ ...prev, [item.id]: result.description }));
      toast({
        title: "Descripción Generada",
        description: "La IA ha procesado los puntos de datos exitosamente.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo generar la descripción en este momento.",
      });
    } finally {
      setIsGenerating(null);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background/50">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-headline font-bold text-slate-800">Análisis Causa Raíz</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por OC, formato o causa..."
                className="pl-9 w-[300px] h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="h-4 w-4 mr-2" /> Filtros
            </Button>
          </div>
        </header>

        <main className="p-6 md:p-8">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-headline">Registro Maestro de OC/OT</CardTitle>
                  <CardDescription>Visualización de datos unificados y herramientas de IA</CardDescription>
                </div>
                <div className="flex gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div> Completado
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div> Pendiente
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">OC / Número</TableHead>
                    <TableHead className="font-bold">Formato / País</TableHead>
                    <TableHead className="font-bold">Área</TableHead>
                    <TableHead className="font-bold">Causa Identificada</TableHead>
                    <TableHead className="font-bold text-right">Impacto Económico</TableHead>
                    <TableHead className="font-bold text-center">IA Asistente</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id} className="hover:bg-primary/5 transition-colors group">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-primary">{item.orderNumber}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{item.plan}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{item.format}</span>
                          <span className="text-xs text-muted-foreground">{item.country}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal text-[10px]">{item.area}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm" title={item.cause}>
                          {item.cause}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-700">
                        ${item.impactAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {aiDescriptions[item.id] ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 group">
                                <Sparkles className="h-4 w-4 mr-1 text-primary animate-pulse" />
                                <span className="text-xs">Ver IA</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <BrainCircuit className="h-5 w-5 text-primary" />
                                  Descripción Estandarizada por IA
                                </DialogTitle>
                                <DialogDescription>
                                  Análisis profundo basado en los documentos cargados.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="bg-slate-50 p-4 rounded-lg border border-primary/20 text-sm italic text-slate-700 leading-relaxed shadow-inner">
                                "{aiDescriptions[item.id]}"
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-2">
                                <span>Basado en PO: {item.orderNumber}</span>
                                <span>Gemini 2.5 Flash</span>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleGenAI(item)}
                            disabled={isGenerating === item.id}
                            className="text-slate-400 hover:text-primary"
                          >
                            {isGenerating === item.id ? (
                              <RefreshCcw className="h-4 w-4 animate-spin" />
                            ) : (
                              <BrainCircuit className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Info className="h-4 w-4 text-slate-300" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredData.length === 0 && (
                <div className="py-20 text-center text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-4 opacity-20" />
                  <p>No se encontraron resultados para "{searchTerm}"</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-headline text-slate-500 uppercase tracking-wider">Recurrencia de Causa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-headline text-primary">Logística <span className="text-sm font-normal text-muted-foreground">(52%)</span></div>
                <p className="text-xs text-muted-foreground mt-1">Causa raíz más común detectada por IA</p>
              </CardContent>
            </Card>
            
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-headline text-slate-500 uppercase tracking-wider">Eficiencia de Resolución</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-headline text-primary">84%</div>
                <p className="text-xs text-muted-foreground mt-1">Tiempo promedio de cierre: 4.2 días</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white border-l-4 border-l-accent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-headline text-slate-500 uppercase tracking-wider">Ahorro Proyectado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-headline text-accent">$45,200</div>
                <p className="text-xs text-muted-foreground mt-1">Por mitigación de errores recurrentes</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}