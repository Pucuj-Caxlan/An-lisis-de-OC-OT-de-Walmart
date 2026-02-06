
'use server';
/**
 * @fileOverview Asistente Inteligente Conversacional para Auditoría de Construcción.
 * 
 * Este flujo permite interactuar con los datos de las órdenes de cambio (OC/OT)
 * de forma natural, proporcionando análisis, resúmenes y recomendaciones.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
});

const ChatAssistantInputSchema = z.object({
  message: z.string().describe("Mensaje del usuario o pregunta sobre los datos."),
  history: z.array(ChatMessageSchema).optional().describe("Historial de la conversación."),
  ordersContext: z.array(z.any()).describe("Contexto de las órdenes actuales para análisis."),
});
export type ChatAssistantInput = z.infer<typeof ChatAssistantInputSchema>;

const ChatAssistantOutputSchema = z.object({
  response: z.string().describe("Respuesta del asistente en formato Markdown."),
  suggestedActions: z.array(z.string()).optional().describe("Acciones o preguntas sugeridas."),
});
export type ChatAssistantOutput = z.infer<typeof ChatAssistantOutputSchema>;

const assistantPrompt = ai.definePrompt({
  name: 'assistantPrompt',
  input: {schema: ChatAssistantInputSchema},
  output: {schema: ChatAssistantOutputSchema},
  prompt: `Eres el Asistente de Inteligencia Inmobiliaria de Walmart (WAI - Walmart Audit Intelligence). 
Tu misión es ayudar a la Vicepresidencia de Construcción a entender las desviaciones de costos y asegurar el cumplimiento.

DATOS DISPONIBLES (CONOCIMIENTO ACTUAL):
{{#each ordersContext}}
- PID: {{{projectId}}} | Proyecto: {{{projectName}}} | Monto: MXN {{{impactoNeto}}} | Causa Real: {{{semanticAnalysis.causaRaizReal}}} | Firmado: {{#if isSigned}} SÍ {{else}} NO {{/if}}
  Descripción: {{{standardizedDescription}}}
{{/each}}

HISTORIAL DE CONVERSACIÓN:
{{#each history}}
- {{{role}}}: {{{content}}}
{{/each}}

PREGUNTA DEL USUARIO:
{{{message}}}

INSTRUCCIONES:
1. Sé ejecutivo, preciso y basado 100% en los datos proporcionados.
2. Si te preguntan por montos, suma los impactos netos relevantes.
3. Si detectas riesgos (como falta de firmas en montos altos), menciónalos como alertas.
4. Usa Markdown para dar formato (negritas, tablas, listas).
5. Sugiere 2 o 3 preguntas de seguimiento que ayuden a profundizar en la auditoría.`,
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
