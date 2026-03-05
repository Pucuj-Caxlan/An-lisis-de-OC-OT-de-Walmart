
"use client"

import React, { useState, useRef, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Send, 
  BrainCircuit, 
  User, 
  Bot, 
  Loader2, 
  RefreshCcw,
  Sparkles,
  Database
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

  // 2. Cargar Resúmenes de Taxonomía para Contexto IA
  const topDisciplinesQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_disciplines'), orderBy('impact', 'desc'), limit(20)) : null, [db]);
  const topFormatsQuery = useMemoFirebase(() => db ? query(collection(db, 'taxonomy_formats'), orderBy('impact', 'desc'), limit(10)) : null, [db]);
  
  const { data: disciplines } = useCollection(topDisciplinesQuery);
  const { data: formats } = useCollection(topFormatsQuery);

  // 3. Cargar Muestra de Alto Impacto (Solo registros críticos para no saturar payload)
  const highImpactQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), orderBy('impactoNeto', 'desc'), limit(40));
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
      const response = await chatWithAi({
        message: userInput,
        history: messages.map(m => ({ role: m.role, content: m.content })),
        summaryContext: {
          totalImpact: globalAgg?.totalImpact || 0,
          totalOrders: globalAgg?.totalOrders || 0,
          topDisciplines: disciplines || [],
          topFormats: formats || [],
          sampleHighImpact: samples || []
        }
      });

      const aiMessage: Message = {
        role: 'model',
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de Motor IA",
        description: error.message || "Fallo en la comunicación con Gemini.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    toast({ title: "Chat reiniciado", description: "El contexto de la conversación se ha limpiado." });
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50/30">
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">WAI - IA Asistente</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-2 px-3 py-1 uppercase font-black">
              <Database className="h-3 w-3" /> Base Global: {globalAgg?.totalOrders || 0}
            </Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 gap-2 px-3 py-1 uppercase font-black">
              <RefreshCcw className="h-3 w-3" /> Contexto IA: Optimizado (Sumarizado)
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-400 hover:text-rose-500">
              Reiniciar
            </Button>
          </div>
        </header>

        <main className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50/50 relative overflow-hidden">
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
                  <div className="bg-primary/10 p-8 rounded-full">
                    <Bot className="h-20 w-20 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-headline font-bold text-slate-800 tracking-tight uppercase">Auditoría Inteligente de Construcción</h2>
                    <p className="text-slate-500 max-w-md mx-auto text-sm">WAI ha analizado el universo de {globalAgg?.totalOrders || 0} registros. Haz consultas sobre impactos económicos, disciplinas críticas o casos de alto valor.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                    {[
                      "Resumen del impacto económico total",
                      "¿Cuáles son las 3 disciplinas con mayor impacto?",
                      "Identifica riesgos en registros de alto monto",
                      "Analiza la distribución por formato"
                    ].map((q, i) => (
                      <Button 
                        key={i} 
                        variant="outline" 
                        className="justify-start gap-3 h-auto py-4 px-5 text-left bg-white border-slate-200 hover:border-primary hover:bg-primary/5 transition-all shadow-sm group"
                        onClick={() => setInput(q)}
                      >
                        <Sparkles className="h-4 w-4 text-accent group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-slate-600">{q}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-4 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${m.role === 'user' ? 'bg-slate-800 text-white' : 'bg-primary text-white'}`}>
                      {m.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                    </div>
                    <div className={`p-5 rounded-2xl shadow-sm text-sm leading-relaxed ${m.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                      <div className="whitespace-pre-wrap prose prose-sm max-w-none">{m.content}</div>
                      <p className={`text-[8px] mt-2 opacity-50 uppercase font-black tracking-widest ${m.role === 'user' ? 'text-right' : ''}`}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-4 max-w-[85%]">
                    <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">WAI procesando inteligencia forense...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-6 bg-gradient-to-t from-white to-transparent pt-10">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white border rounded-2xl p-2 shadow-2xl flex items-center gap-2">
                <Input 
                  placeholder="Consulta a WAI sobre el universo total de datos..." 
                  className="border-none focus-visible:ring-0 text-sm h-12 bg-transparent font-medium"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  disabled={isLoading}
                />
                <Button 
                  size="icon" 
                  className="h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 shadow-md transition-all active:scale-95"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-center mt-3 px-2">
                <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tight text-slate-400 border-slate-200 bg-white">
                  Contexto Multidimensional • IA Optimizada para Gran Volumen
                </Badge>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
