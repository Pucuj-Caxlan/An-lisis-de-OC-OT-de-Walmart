
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

const DisciplineContextSchema = z.object({
  name: z.string().describe("Nombre de la disciplina técnica."),
  impact: z.number().describe("Monto total de impacto económico."),
  count: z.number().describe("Número de registros asociados.")
});

const FormatContextSchema = z.object({
  name: z.string().describe("Nombre del formato de tienda."),
  impact: z.number().describe("Impacto económico en ese formato.")
});

const SampleOrderSchema = z.object({
  projectId: z.string(),
  projectName: z.string().optional(),
  impactoNeto: z.number(),
  causa_raiz_normalizada: z.string().optional(),
  disciplina_normalizada: z.string().optional(),
  descripcion: z.string()
});

const ChatAssistantInputSchema = z.object({
  message: z.string().describe("Mensaje o pregunta del usuario."),
  history: z.array(ChatMessageSchema).optional(),
  summaryContext: z.object({
    totalImpact: z.number().describe("Impacto económico total de la base de datos."),
    totalOrders: z.number().describe("Volumen total de órdenes auditadas."),
    topDisciplines: z.array(DisciplineContextSchema).describe("Ranking de las disciplinas con mayor impacto."),
    topFormats: z.array(FormatContextSchema).describe("Distribución del impacto por formato de tienda."),
    sampleHighImpact: z.array(SampleOrderSchema).describe("Muestra detallada de registros críticos para ejemplificar.")
  }).describe("Resumen ejecutivo del universo total para dar contexto a la respuesta."),
});
export type ChatAssistantInput = z.infer<typeof ChatAssistantInputSchema>;

const ChatAssistantOutputSchema = z.object({
  response: z.string().describe("Respuesta técnica y ejecutiva en Markdown."),
  suggestedActions: z.array(z.string()).optional(),
});
export type ChatAssistantOutput = z.infer<typeof ChatAssistantOutputSchema>;

const assistantPrompt = ai.definePrompt({
  name: 'assistantPrompt',
  input: {schema: ChatAssistantInputSchema},
  output: {schema: ChatAssistantOutputSchema},
  prompt: `Eres WAI (Walmart Audit Intelligence), el consultor senior de analítica forense para la Vicepresidencia de Construcción de Walmart International. 

Tu misión es transformar datos en INSIGHTS ESTRATÉGICOS. No eres un simple chatbot, eres un auditor que busca desviaciones, patrones de ineficiencia y oportunidades de ahorro.

CONTEXTO GLOBAL DEL UNIVERSO (SSOT):
- Impacto Total: MXN {{{summaryContext.totalImpact}}}
- Volumen de Órdenes: {{{summaryContext.totalOrders}}} registros auditados.

RANKING DE DISCIPLINAS CRÍTICAS (PARETO 80/20):
{{#each summaryContext.topDisciplines}}
- {{{name}}}: MXN {{{impact}}} ({{{count}}} órdenes)
{{/each}}

DISTRIBUCIÓN POR FORMATO DE TIENDA:
{{#each summaryContext.topFormats}}
- {{{name}}}: MXN {{{impact}}}
{{/each}}

MUESTRA DE ALTO IMPACTO (EVIDENCIA ESPECÍFICA):
{{#each summaryContext.sampleHighImpact}}
- PID: {{{projectId}}} | Monto: MXN {{{impactoNeto}}} | Disciplina: {{{disciplina_normalizada}}} | Causa: {{{causa_raiz_normalizada}}}
  Narrativa: {{{descripcion}}}
{{/each}}

HISTORIAL DE CONVERSACIÓN:
{{#each history}}
- {{{role}}}: {{{content}}}
{{/each}}

INSTRUCCIONES DE RESPUESTA:
1. PRECISIÓN TÉCNICA: Identifica SIEMPRE las disciplinas por su nombre. Nunca digas que la información no está disponible si aparece en el listado de 'TOP DISCIPLINAS'.
2. LEY DE PARETO: Si detectas que las 3 primeras disciplinas concentran más del 50% del impacto, menciónalo explícitamente como un riesgo de concentración.
3. EVIDENCIA: Cuando hables de una disciplina, usa un ejemplo de la 'Muestra de Alto Impacto' citando el PID y el monto para dar credibilidad forense.
4. TONO EJECUTIVO: Usa un lenguaje sobrio, profesional y orientado a resultados. Utiliza tablas Markdown para comparar cifras si es necesario.
5. NO INVENTES: Si el usuario pregunta algo fuera del contexto proporcionado, indica que los datos actuales no cubren esa dimensión.

PREGUNTA DEL USUARIO:
{{{message}}}`,
});

export async function chatWithAi(input: ChatAssistantInput): Promise<ChatAssistantOutput> {
  const {output} = await assistantPrompt(input);
  if (!output) throw new Error("Error al generar inteligencia conversacional.");
  return output;
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
