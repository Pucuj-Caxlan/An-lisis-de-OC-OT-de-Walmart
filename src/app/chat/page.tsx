
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
  Plus,
  Trash2,
  Clock,
  History
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, limit, orderBy, doc, where } from 'firebase/firestore';
import { chatWithAi } from '@/ai/flows/chat-assistant-flow';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Separator } from '@/components/ui/separator';

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
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Consulta de órdenes para el contexto (limitada para rendimiento)
  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'), limit(150));
  }, [db]);
  const { data: orders } = useCollection(ordersQuery);

  // Consulta de sesiones de chat del usuario con ordenamiento por fecha
  const chatSessionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    // IMPORTANTE: Esta consulta requiere que el filtro coincida con la regla de seguridad
    return query(
      collection(db, 'chatSessions'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(25)
    );
  }, [db, user]);
  const { data: sessions, isLoading: isLoadingSessions } = useCollection(chatSessionsQuery);

  // Sesión seleccionada actualmente
  const currentSession = sessions?.find(s => s.id === currentSessionId);
  const messages: Message[] = currentSession?.messages || [];

  // Scroll automático al final del chat
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleCreateNewChat = () => {
    setCurrentSessionId(null);
    setInput('');
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'chatSessions', sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
    toast({ title: "Conversación eliminada" });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !db || !user) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    let sessionId = currentSessionId;
    let currentMessages = [...messages, userMessage];

    // Lógica de persistencia inicial o actualización
    if (!sessionId) {
      sessionId = `chat_${Date.now()}`;
      const title = input.length > 35 ? input.substring(0, 35) + '...' : input;
      
      setDocumentNonBlocking(doc(db, 'chatSessions', sessionId), {
        id: sessionId,
        userId: user.uid,
        title: title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: currentMessages
      }, { merge: true });
      
      setCurrentSessionId(sessionId);
    } else {
      updateDocumentNonBlocking(doc(db, 'chatSessions', sessionId), {
        messages: currentMessages,
        updatedAt: new Date().toISOString()
      });
    }

    const userInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatWithAi({
        message: userInput,
        history: messages.map(m => ({ role: m.role, content: m.content })),
        ordersContext: orders || [],
      });

      const aiMessage: Message = {
        role: 'model',
        content: response.response,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...currentMessages, aiMessage];
      
      updateDocumentNonBlocking(doc(db, 'chatSessions', sessionId), {
        messages: finalMessages,
        updatedAt: new Date().toISOString()
      });

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
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-2 px-3 py-1">
              <RefreshCcw className="h-3 w-3" /> Contexto: {orders?.length || 0} Registros
            </Badge>
          </div>
        </header>

        <main className="flex h-[calc(100vh-4rem)] overflow-hidden">
          {/* Historial Lateral */}
          <div className="w-80 border-r bg-white flex flex-col hidden lg:flex shrink-0">
            <div className="p-4">
              <Button onClick={handleCreateNewChat} className="w-full gap-2 bg-primary hover:bg-primary/90 shadow-md">
                <Plus className="h-4 w-4" /> Nueva Conversación
              </Button>
            </div>
            <Separator />
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-2 mb-2">Historial Persistente</h3>
                {isLoadingSessions ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-200" /></div>
                ) : sessions?.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-8 italic px-4">No tienes conversaciones guardadas.</p>
                ) : sessions?.map((session) => (
                  <div 
                    key={session.id} 
                    onClick={() => setCurrentSessionId(session.id)}
                    className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${currentSessionId === session.id ? 'bg-primary/5 border-primary/20' : 'border-transparent hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className={`h-4 w-4 mt-1 ${currentSessionId === session.id ? 'text-primary' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${currentSessionId === session.id ? 'text-primary' : 'text-slate-700'}`}>
                          {session.title || 'Análisis de OC/OT'}
                        </p>
                        <p className="text-[9px] text-slate-400 flex items-center gap-1 mt-1 font-medium">
                          <Clock className="h-2 w-2" /> {new Date(session.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"
                        onClick={(e) => handleDeleteSession(session.id, e)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Área de Chat */}
          <div className="flex-1 flex flex-col bg-slate-50/50 relative overflow-hidden">
            <ScrollArea className="flex-1" ref={scrollRef}>
              <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
                    <div className="bg-primary/10 p-8 rounded-full">
                      <Bot className="h-20 w-20 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-headline font-bold text-slate-800 tracking-tight uppercase">Auditoría Inteligente de Construcción</h2>
                      <p className="text-slate-500 max-w-md mx-auto text-sm">El asistente tiene acceso a {orders?.length || 0} registros activos. Pregunta sobre discrepancias, montos acumulados o riesgos de firmas.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                      {[
                        "¿Cuál es el impacto neto total de este año?",
                        "¿Qué especialidades tienen más desviaciones?",
                        "Analiza el riesgo de firmas en montos altos.",
                        "Resumen de anomalías financieras detectadas."
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
                        <div className="whitespace-pre-wrap">{m.content}</div>
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
                        <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic">WAI Analizando Datos...</span>
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
                    placeholder="Consulta al Asistente de Auditoría..." 
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
                <div className="flex justify-between items-center mt-3 px-2">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                    Seguridad: Sesión cifrada y persistente en Firestore
                  </p>
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tight text-slate-400 border-slate-200 bg-white">
                    Gemini 2.5 Flash
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
