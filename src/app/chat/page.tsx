
"use client"

import React, { useState, useRef, useEffect } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Card, CardContent } from '@/components/ui/card';
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
  Search,
  MessageSquare,
  BarChart3,
  ShieldAlert
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, limit } from 'firebase/firestore';
import { chatWithAi, ChatMessageSchema } from '@/ai/flows/chat-assistant-flow';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

type Message = {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
};

export default function ChatPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), limit(200));
  }, [db]);

  const { data: orders } = useCollection(ordersQuery);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithAi({
        message: input,
        history: messages.map(m => ({ role: m.role, content: m.content })),
        ordersContext: orders || [],
      });

      const aiMessage: Message = {
        role: 'model',
        content: response.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error de Asistente",
        description: error.message || "No se pudo obtener respuesta de la IA.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = (q: string) => {
    setInput(q);
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
              <h1 className="text-xl font-headline font-bold text-slate-800 tracking-tight uppercase">IA Asistente - WAI</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-2 px-3 py-1">
              <RefreshCcw className="h-3 w-3" /> Contexto: {orders?.length || 0} Registros
            </Badge>
          </div>
        </header>

        <main className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6">
          <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full gap-4">
            <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
              <div className="space-y-6 py-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-6 mt-12">
                    <div className="bg-primary/10 p-6 rounded-full">
                      <Bot className="h-16 w-16 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-headline font-bold text-slate-800">¿Cómo puedo ayudarte con la auditoría hoy?</h2>
                      <p className="text-slate-500 max-w-md mx-auto">Tengo acceso a todos los registros de OC/OT cargados. Puedo analizar montos, buscar anomalías o sugerir soluciones.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                      {[
                        "¿Cuál es el impacto neto total de este año?",
                        "Muéstrame órdenes con riesgo de firmas.",
                        "¿Qué especialidad tiene más desviaciones?",
                        "Analiza las causas raíz de Bodega Aurrera."
                      ].map((q, i) => (
                        <Button 
                          key={i} 
                          variant="outline" 
                          className="justify-start gap-2 h-auto py-3 px-4 text-left border-slate-200 hover:border-primary hover:bg-primary/5 transition-all"
                          onClick={() => handleQuickQuestion(q)}
                        >
                          <Sparkles className="h-4 w-4 text-accent shrink-0" />
                          <span className="text-xs font-medium text-slate-600">{q}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-slate-800 text-white' : 'bg-primary text-white'}`}>
                        {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>
                      <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${m.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-white border text-slate-700 rounded-tl-none'}`}>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 max-w-[85%]">
                      <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="p-4 rounded-2xl bg-white border shadow-sm flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs text-slate-400 font-medium italic">WAI está analizando los registros...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="bg-white border rounded-2xl p-2 shadow-lg flex items-center gap-2 mb-2">
              <Input 
                placeholder="Pregúntame sobre montos, proyectos o auditorías..." 
                className="border-none focus-visible:ring-0 text-sm h-12"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <Button 
                size="icon" 
                className="h-10 w-10 shrink-0 bg-primary hover:bg-primary/90"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-center text-slate-400 font-medium pb-2 uppercase tracking-widest">
              WAI utiliza Gemini 2.5 para analizar datos de auditoría en tiempo real.
            </p>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
