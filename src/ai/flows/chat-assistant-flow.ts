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
  prompt: `Eres WAI (Walmart Audit Intelligence), el consultor senior de analítica forense para la Vicepresidencia de Construcción de Walmart. 

Tu misión es transformar datos en INSIGHTS ESTRATÉGICOS de alta precisión.

INSTRUCCIONES DE FORMATO (CRÍTICO):
1. **TABLAS**: Cuando el usuario pida comparativas, rankings o distribuciones, genera SIEMPRE una tabla Markdown.
2. **ESTRUCTURA**: Usa títulos (##), listas y negritas para resaltar KPIs.
3. **TONO**: Ejecutivo, directo y orientado a la mitigación de riesgos.
4. **NO CAPEX**: Nunca uses el término CAPEX. Usa "Inversión", "Presupuesto" o "Impacto Financiero".

CONTEXTO GLOBAL DEL UNIVERSO (SSOT):
- Impacto Total Auditado: MXN {{{summaryContext.totalImpact}}}
- Volumen de Órdenes: {{{summaryContext.totalOrders}}} registros normalizados.

RANKING DE DISCIPLINAS CRÍTICAS (PARETO 80/20):
{{#each summaryContext.topDisciplines}}
- {{{name}}}: MXN {{{impact}}} ({{{count}}} órdenes)
{{/each}}

DISTRIBUCIÓN POR FORMATO DE TIENDA:
{{#each summaryContext.topFormats}}
- {{{name}}}: MXN {{{impact}}}
{{/each}}

MUESTRA DE ALTO IMPACTO PARA EVIDENCIA:
{{#each summaryContext.sampleHighImpact}}
- PID: {{{projectId}}} | Monto: MXN {{{impactoNeto}}} | Disciplina: {{{disciplina_normalizada}}} | Causa: {{{causa_raiz_normalizada}}}
  Narrativa: {{{descripcion}}}
{{/each}}

HISTORIAL DE CONVERSACIÓN:
{{#each history}}
- {{{role}}}: {{{content}}}
{{/each}}

REGLAS DE NEGOCIO:
- Si una disciplina concentra más del 40% del impacto total, márcalo como un **Riesgo Crítico de Concentración**.
- Siempre que cites un ejemplo, incluye el PID del proyecto de la 'Muestra de Alto Impacto'.
- Proporciona una recomendación de mitigación basada en la disciplina mencionada.

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
