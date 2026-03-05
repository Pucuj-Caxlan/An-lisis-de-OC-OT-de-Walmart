
'use server';
/**
 * @fileOverview Asistente Inteligente Conversacional optimizado para Grandes Volúmenes.
 * 
 * Este flujo utiliza resúmenes ejecutivos y muestras de alto impacto para 
 * analizar el universo de datos sin exceder los límites de tokens.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const ChatAssistantInputSchema = z.object({
  message: z.string().describe("Mensaje del usuario."),
  history: z.array(ChatMessageSchema).optional(),
  summaryContext: z.object({
    totalImpact: z.number(),
    totalOrders: z.number(),
    topDisciplines: z.array(z.any()),
    topFormats: z.array(z.any()),
    sampleHighImpact: z.array(z.any()).describe("Muestra de los registros con mayor impacto económico.")
  }).describe("Resumen ejecutivo del universo total."),
});
export type ChatAssistantInput = z.infer<typeof ChatAssistantInputSchema>;

const ChatAssistantOutputSchema = z.object({
  response: z.string().describe("Respuesta en Markdown."),
  suggestedActions: z.array(z.string()).optional(),
});
export type ChatAssistantOutput = z.infer<typeof ChatAssistantOutputSchema>;

const assistantPrompt = ai.definePrompt({
  name: 'assistantPrompt',
  input: {schema: ChatAssistantInputSchema},
  output: {schema: ChatAssistantOutputSchema},
  prompt: `Eres WAI (Walmart Audit Intelligence), el experto forense para la Vicepresidencia de Construcción. 
Tu misión es analizar desviaciones de costos y cumplimiento basándote en los datos proporcionados.

ESTADO GLOBAL DEL UNIVERSO:
- Impacto Total: MXN {{{summaryContext.totalImpact}}}
- Volumen de Órdenes: {{{summaryContext.totalOrders}}} registros auditados.

TOP DISCIPLINAS (PARETO):
{{#each summaryContext.topDisciplines}}
- {{{name}}}: MXN {{{impact}}} ({{{count}}} órdenes)
{{/each}}

DISTRIBUCIÓN POR FORMATO:
{{#each summaryContext.topFormats}}
- {{{name}}}: MXN {{{impact}}}
{{/each}}

MUESTRA DE ALTO IMPACTO (DETALLE ESPECÍFICO):
{{#each summaryContext.sampleHighImpact}}
- PID: {{{projectId}}} | Monto: MXN {{{impactoNeto}}} | Causa: {{{causa_raiz_normalizada}}} | Disciplina: {{{disciplina_normalizada}}}
  Desc: {{{descripcion}}}
{{/each}}

HISTORIAL:
{{#each history}}
- {{{role}}}: {{{content}}}
{{/each}}

PREGUNTA DEL USUARIO:
{{{message}}}

INSTRUCCIONES:
1. Responde de forma EJECUTIVA y técnica.
2. Usa el contexto global para responder sobre totales y el contexto de muestra para dar ejemplos de PIDs específicos.
3. Si detectas que pocas disciplinas concentran mucho gasto, menciona la Ley de Pareto.
4. Usa tablas Markdown si ayuda a la claridad financiera.`,
});

export async function chatWithAi(input: ChatAssistantInput): Promise<ChatAssistantOutput> {
  const {output} = await assistantPrompt(input);
  return output!;
}

const chatAssistantFlow = ai.defineFlow(
  {
    name: 'chatAssistantFlow',
    inputSchema: ChatAssistantInputSchema,
    outputSchema: ChatAssistantOutputSchema,
  },
  async input => {
    return chatWithAi(input);
  }
);
