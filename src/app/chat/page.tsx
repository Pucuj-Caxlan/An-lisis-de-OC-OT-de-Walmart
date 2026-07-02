
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
  ArrowRight,
  AlertCircle,
  Plus,
  Wrench,
  Mic,
  ChevronDown,
  MapPin
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
  isError?: boolean;
};

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

  const globalAggRef = useMemoFirebase(() => db ? doc(db, 'aggregates', 'global_stats') : null, [db]);
  const { data: globalAgg } = useDoc(globalAggRef);

  const topDisciplinesQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_disciplines'), orderBy('impact', 'desc'), limit(20)) : null, [db]);
  const topFormatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('impact', 'desc'), limit(10)) : null, [db]);
  const topStatesQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_states'), orderBy('impact', 'desc'), limit(15)) : null, [db]);
  
  const { data: rawDisciplines } = useCollection(topDisciplinesQuery);
  const { data: rawFormats } = useCollection(topFormatsQuery);
  const { data: rawStates } = useCollection(topStatesQuery);

  const highImpactQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), orderBy('impactoNeto', 'desc'), limit(60));
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

      const cleanStates = (rawStates || []).map(s => ({
        name: s.name || s.id || 'Estado Desconocido',
        impact: Number(s.impact || 0)
      }));

      const cleanSamples = (samples || []).map(s => ({
        projectId: s.projectId || 'N/A',
        projectName: s.projectName || '',
        format: s.format_normalized || s.format || 'OTRO',
        region: s.region_normalized || s.region || 'CENTRO',
        state: s.state_normalized || s.state || 'CIUDAD DE MÉXICO',
        municipality: s.municipality_normalized || s.municipio || 'SIN MUNICIPIO',
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
          topStates: cleanStates,
          sampleHighImpact: cleanSamples
        }
      });

      const aiMessage: Message = {
        role: 'model',
        content: response.response,
        timestamp: new Date().toISOString(),
        isError: !!response.error
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      console.error("Chat Error:", error);
      toast({
        variant: "destructive",
        title: "Error de Inteligencia",
        description: "Fallo crítico en el motor WAI. Por favor, reintente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">WAI - IA Asistente</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] px-3 flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> Info Geográfica Activa
            </Badge>
            <div className="h-8 w-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-500">
              {user?.displayName?.[0] || 'U'}
            </div>
          </div>
        </header>

        <main className="flex flex-col h-[calc(100vh-3.5rem)] relative bg-white">
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="max-w-4xl mx-auto py-12 px-6 space-y-12">
              
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-10 animate-in fade-in duration-700">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <WalmartSpark className="h-12 w-12 text-primary" />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-4xl font-headline font-bold text-slate-900 tracking-tight">Hola, ¿cómo puedo ayudarte hoy?</h2>
                    <p className="text-slate-500 text-lg max-w-lg mx-auto">Soy WAI, analizando el impacto de las órdenes de cambio por Estado y Municipio en México.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                    {[
                      "Genera una tabla de impacto por Estado",
                      "¿Cuáles son los 5 municipios con más desviaciones?",
                      "Análisis de ineficiencias en Nuevo León y Jalisco",
                      "Desglose de adicionales en Naucalpan y Querétaro"
                    ].map((q, i) => (
                      <Button 
                        key={i} 
                        variant="outline" 
                        className="h-auto py-4 px-6 text-left justify-start bg-slate-50 border-slate-200 hover:bg-slate-100 rounded-2xl group transition-all"
                        onClick={() => setInput(q)}
                      >
                        <Sparkles className="h-4 w-4 mr-3 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium text-slate-700">{q}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-12">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-6 ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-500`}>
                    <div className={`flex gap-4 max-w-[90%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 border ${m.role === 'user' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                        {m.role === 'user' ? <User className="h-5 w-5 text-white" /> : <WalmartSpark className="h-6 w-6 text-primary" />}
                      </div>
                      <div className={`space-y-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {m.role === 'model' && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-bold text-slate-900 uppercase tracking-widest">WAI Inteligencia Geográfica</span>
                          </div>
                        )}
                        <div className={`text-base leading-relaxed ${m.role === 'user' ? 'bg-slate-100 px-6 py-3 rounded-3xl text-slate-800' : 'text-slate-800'}`}>
                          <div className="prose prose-slate max-w-none prose-p:mb-4 prose-strong:text-slate-900 prose-headings:text-slate-900 prose-headings:font-bold prose-headings:mt-8
                            prose-table:w-full prose-table:border-collapse prose-table:my-6
                            prose-thead:border-b-2 prose-thead:border-slate-200
                            prose-th:py-3 prose-th:px-4 prose-th:text-left prose-th:text-xs prose-th:uppercase prose-th:tracking-wider prose-th:text-slate-500
                            prose-td:py-4 prose-td:px-4 prose-td:border-b prose-td:border-slate-100 prose-td:text-sm prose-td:text-slate-700">
                            <div dangerouslySetInnerHTML={{ 
                              __html: m.content
                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                .replace(/### (.*?)\n/g, '<h3 class="text-xl font-bold mb-4">$1</h3>')
                                .replace(/## (.*?)\n/g, '<h2 class="text-2xl font-bold mb-6">$1</h2>')
                                .replace(/\n/g, '<br/>')
                                .replace(/\|/g, ' ') 
                            }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-4 animate-in fade-in duration-300">
                    <div className="h-10 w-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                      <WalmartSpark className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex space-x-1">
                        <div className="h-1.5 w-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="h-1.5 w-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="h-1.5 w-1.5 bg-slate-300 rounded-full animate-bounce" />
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">WAI analizando municipios...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="p-6 bg-white border-t border-slate-100">
            <div className="max-w-3xl mx-auto relative">
              <div className="bg-slate-100 rounded-[2rem] p-2 flex items-end gap-2 border border-transparent focus-within:border-primary/20 transition-all shadow-sm">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-500 shrink-0">
                  <Plus className="h-5 w-5" />
                </Button>
                <div className="flex-1 flex flex-col min-h-[44px] justify-center px-2">
                  <textarea
                    rows={1}
                    placeholder="Pregúntale a WAI sobre Estados, Municipios o PIDs..."
                    className="w-full bg-transparent border-none focus:ring-0 text-sm py-3 resize-none max-h-40 font-medium placeholder:text-slate-400"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                </div>
                <div className="flex gap-1 pb-1 pr-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-500">
                    <Wrench className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-500">
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md disabled:bg-slate-200 transition-all"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-center text-slate-400 mt-3 font-medium uppercase tracking-widest">
                WAI procesa datos geográficos de toda la República Mexicana.
              </p>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
