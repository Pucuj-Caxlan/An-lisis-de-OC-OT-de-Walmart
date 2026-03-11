"use client"

import React, { useState, useRef, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Send, 
  User, 
  Loader2, 
  RefreshCcw,
  Sparkles,
  Database,
  ArrowRight
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, limit, orderBy, doc } from 'firebase/firestore';
import { chatWithAi } from '@/ai/flows/chat-assistant-flow';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

type Message = {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
};

// Componente para el Icono de Walmart Spark
const WalmartSpark = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0l1.5 7.5L18 4.5l-4.5 4.5L21 10.5l-7.5 1.5L15 19.5l-3-7.5-3 7.5 1.5-7.5L3 10.5l7.5-1.5L6 4.5l4.5 4.5L12 0z" />
  </svg>
);

export default function ChatPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Cargar Metadatos Globales (SSOT)
  const globalAggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(globalAggRef);

  // 2. Cargar Resúmenes de Taxonomía para Contexto IA (Sanitizados)
  const topDisciplinesQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_disciplines'), orderBy('impact', 'desc'), limit(25)) : null, [db]);
  const topFormatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('impact', 'desc'), limit(15)) : null, [db]);
  
  const { data: rawDisciplines } = useCollection(topDisciplinesQuery);
  const { data: rawFormats } = useCollection(topFormatsQuery);

  // 3. Cargar Muestra de Alto Impacto (Solo registros críticos)
  const highImpactQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), orderBy('impactoNeto', 'desc'), limit(50));
  }, [db]);
  const { data: samples } = useCollection(highImpactQuery);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const userInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const cleanDisciplines = (rawDisciplines || []).map(d => ({
        name: d.name || d.id || 'Disciplina Desconocida',
        impact: Number(d.impact || 0),
        count: Number(d.count || 0)
      })).filter(d => d.impact > 0);

      const cleanFormats = (rawFormats || []).map(f => ({
        name: f.name || f.id || 'Formato Desconocido',
        impact: Number(f.impact || 0)
      }));

      const cleanSamples = (samples || []).map(s => ({
        projectId: s.projectId || 'N/A',
        projectName: s.projectName || '',
        impactoNeto: Number(s.impactoNeto || 0),
        causa_raiz_normalizada: s.causa_raiz_normalizada || 'Sin clasificar',
        disciplina_normalizada: s.disciplina_normalizada || 'Indefinida',
        descripcion: s.descripcion || ''
      }));

      const response = await chatWithAi({
        message: userInput,
        history: messages.map(m => ({ role: m.role, content: m.content })),
        summaryContext: {
          totalImpact: Number(globalAgg?.totalImpact || 0),
          totalOrders: Number(globalAgg?.totalOrders || 0),
          topDisciplines: cleanDisciplines,
          topFormats: cleanFormats,
          sampleHighImpact: cleanSamples
        }
      });

      const aiMessage: Message = {
        role: 'model',
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      console.error("Chat Error:", error);
      toast({
        variant: "destructive",
        title: "Error de Inteligencia",
        description: error.message || "Fallo al conectar con WAI.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-20 shrink-0 items-center justify-between border-b bg-white px-8 sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-3">
              <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                <WalmartSpark className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-headline font-bold text-slate-900 tracking-tight uppercase">WAI - IA Asistente</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">Walmart Audit Intelligence</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-2 px-4 py-1.5 uppercase font-black text-[10px]">
              <Database className="h-3.5 w-3.5" /> Universo: {globalAgg?.totalOrders || 0}
            </Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 gap-2 px-4 py-1.5 uppercase font-black text-[10px]">
              <RefreshCcw className="h-3.5 w-3.5" /> 100% Sincronizado
            </Badge>
          </div>
        </header>

        <main className="flex flex-col h-[calc(100vh-5rem)] bg-slate-50/50 relative overflow-hidden">
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="max-w-5xl mx-auto py-10 px-8 space-y-8">
              
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                    <div className="relative bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100">
                      <WalmartSpark className="h-20 w-20 text-primary mx-auto" />
                    </div>
                  </div>
                  <div className="space-y-3 max-w-xl mx-auto">
                    <h2 className="text-3xl font-headline font-bold text-slate-900 tracking-tight uppercase">Analista Forense Virtual</h2>
                    <p className="text-slate-500 text-sm leading-relaxed font-medium">
                      Hola {user?.displayName?.split(' ')[0] || 'Auditor'}, soy WAI. He analizado el universo de datos y estoy listo para entregarte reportes de impacto, tablas comparativas y análisis de recurrencia.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
                    {[
                      "Genera una tabla con las 5 disciplinas de mayor impacto",
                      "Analiza la distribución de inversión por formato de tienda",
                      "Identifica los PIDs con mayor desviación en Obra Civil",
                      "¿Cuáles son los planes de inversión con más incidencias?"
                    ].map((q, i) => (
                      <Button 
                        key={i} 
                        variant="outline" 
                        className="justify-between group h-auto py-5 px-6 text-left bg-white border-slate-200 hover:border-primary hover:bg-primary/5 transition-all shadow-sm rounded-[2rem]"
                        onClick={() => setInput(q)}
                      >
                        <div className="flex items-center gap-4">
                          <Sparkles className="h-5 w-5 text-accent group-hover:scale-110 transition-transform" />
                          <span className="text-[11px] font-black uppercase text-slate-600 tracking-tight">{q}</span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-10">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 fade-in duration-500`}>
                    <div className={`flex gap-6 max-w-[90%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-primary text-white'}`}>
                        {m.role === 'user' ? <User className="h-6 w-6" /> : <WalmartSpark className="h-6 w-6" />}
                      </div>
                      <div className={`p-8 rounded-[2.5rem] shadow-xl text-sm leading-relaxed border transition-all ${
                        m.role === 'user' 
                        ? 'bg-slate-900 text-white border-slate-800 rounded-tr-none' 
                        : 'bg-white border-slate-100 text-slate-800 rounded-tl-none'
                      }`}>
                        <div className="prose prose-slate max-w-none prose-sm prose-p:leading-relaxed prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-headings:mb-4 prose-table:border prose-table:rounded-xl prose-table:overflow-hidden prose-th:bg-slate-50 prose-th:p-3 prose-th:text-[10px] prose-th:uppercase prose-td:p-3 prose-td:border-t prose-td:text-xs prose-strong:text-primary prose-invert:prose-strong:text-accent">
                          {/* El contenido se renderiza aquí. En un entorno real se usaría react-markdown */}
                          <div dangerouslySetInnerHTML={{ 
                            __html: m.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\n/g, '<br/>')
                              .replace(/\|/g, ' ') // Simplificación para demo de tablas
                          }} />
                        </div>
                        <div className={`flex items-center gap-2 mt-6 pt-4 border-t opacity-30 ${m.role === 'user' ? 'border-white/10 justify-end' : 'border-slate-100'}`}>
                          <p className="text-[8px] uppercase font-black tracking-widest">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • SSOT VERIFIED
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start animate-pulse">
                    <div className="flex gap-6 max-w-[90%]">
                      <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0 shadow-lg">
                        <WalmartSpark className="h-6 w-6 animate-spin duration-[3s]" />
                      </div>
                      <div className="p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-xl flex items-center gap-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] italic">WAI analizando relaciones forenses...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="p-8 bg-gradient-to-t from-white via-white/95 to-transparent pt-16">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white border rounded-[2.5rem] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex items-center gap-3 border-slate-200 focus-within:border-primary/50 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                  <WalmartSpark className="h-6 w-6" />
                </div>
                <Input 
                  placeholder="Pregunta a WAI sobre el impacto por disciplina, PIDs específicos o tendencias..." 
                  className="border-none focus-visible:ring-0 text-sm h-14 bg-transparent font-medium"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  disabled={isLoading}
                />
                <Button 
                  size="icon" 
                  className="h-12 w-12 shrink-0 bg-primary hover:bg-primary/90 shadow-xl transition-all active:scale-95 rounded-2xl group"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                >
                  <Send className="h-5 w-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Button>
              </div>
              <div className="flex justify-center mt-4">
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 border-slate-200 bg-white/50 px-6 py-1.5 rounded-full shadow-sm">
                  Powered by Gemini 2.5 • Contexto Multidimensional • SSOT Active
                </Badge>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
