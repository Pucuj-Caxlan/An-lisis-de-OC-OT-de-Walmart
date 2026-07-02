
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

const StateContextSchema = z.object({
  name: z.string().describe("Nombre del Estado de la República Mexicana."),
  impact: z.number().describe("Monto acumulado en ese estado.")
});

const SampleOrderSchema = z.object({
  projectId: z.string(),
  projectName: z.string().optional(),
  format: z.string().optional().describe("Formato de la tienda (ej. WSC, BAE, SC)."),
  region: z.string().optional().describe("Región geográfica."),
  state: z.string().optional().describe("Estado de la República Mexicana."),
  municipality: z.string().optional().describe("Municipio o Ciudad específica."),
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
    topStates: z.array(StateContextSchema).describe("Distribución geográfica por Estado de México."),
    sampleHighImpact: z.array(SampleOrderSchema).describe("Muestra detallada de registros críticos con ubicación exacta.")
  }).describe("Resumen ejecutivo del universo total para dar contexto a la respuesta."),
});
export type ChatAssistantInput = z.infer<typeof ChatAssistantInputSchema>;

const ChatAssistantOutputSchema = z.object({
  response: z.string().describe("Respuesta técnica y ejecutiva en Markdown."),
  suggestedActions: z.array(z.string()).optional(),
  error: z.string().optional(),
});
export type ChatAssistantOutput = z.infer<typeof ChatAssistantOutputSchema>;

const assistantPrompt = ai.definePrompt({
  name: 'assistantPrompt',
  input: {schema: ChatAssistantInputSchema},
  output: {schema: ChatAssistantOutputSchema},
  prompt: `Eres WAI (Walmart Audit Intelligence), el consultor senior de analítica forense de Walmart México. 

Tu misión es transformar datos complejos en INSIGHTS ESTRATÉGICOS de alta precisión sobre el presupuesto de construcción.

INSTRUCCIONES DE TONO Y PERSONALIZACIÓN:
1. **TRATO PROFESIONAL**: Saluda de forma profesional y general. Pregunta amablemente si desea personalizar su nombre o cargo. No asumas que es Vicepresidente por defecto.
2. **TONO**: Directo, técnico, sobrio y altamente estructurado.

INSTRUCCIONES DE FORMATO Y GEOGRAFÍA (CRÍTICO):
1. **TABLAS EJECUTIVAS**: Cuando el usuario pida comparativas, rankings o desgloses por ESTADO, MUNICIPIO, formato o disciplina, genera SIEMPRE una tabla Markdown.
2. **UBICACIÓN DETALLADA**: Tienes acceso a la vinculación entre PID, Formato, ESTADO y MUNICIPIO en la 'Muestra de Alto Impacto'. 
3. **ANÁLISIS MUNICIPAL**: Si el impacto se concentra en un municipio específico (ej. Naucalpan, Zapopan, Monterrey), resáltalo como un foco de atención operativa.
4. **MAPA DE RIESGO**: Usa la información de Estados para identificar qué entidades federativas presentan mayores desviaciones semánticas.

CONTEXTO GLOBAL:
- Impacto Total: MXN {{{summaryContext.totalImpact}}}
- Volumen: {{{summaryContext.totalOrders}}} registros.

TOP ESTADOS (IMPACTO):
{{#each summaryContext.topStates}}
- {{{name}}}: MXN {{{impact}}}
{{/each}}

MUESTRA DE ALTO IMPACTO (DATOS RELACIONALES COMPLETOS):
{{#each summaryContext.sampleHighImpact}}
- PID: {{{projectId}}} | Proyecto: {{{projectName}}} | Edo: {{{state}}} | Mun: {{{municipality}}} | Formato: {{{format}}} | Monto: MXN {{{impactoNeto}}} | Causa: {{{causa_raiz_normalizada}}}
  Narrativa: {{{descripcion}}}
{{/each}}

HISTORIAL:
{{#each history}}
- {{{role}}}: {{{content}}}
{{/each}}

PREGUNTA DEL USUARIO:
{{{message}}}`,
});

export async function chatWithAi(input: ChatAssistantInput): Promise<ChatAssistantOutput> {
  try {
    const {output} = await assistantPrompt(input);
    if (!output) throw new Error("Error al generar inteligencia conversacional.");
    return output;
  } catch (error: any) {
    console.error("Chat Flow Error:", error);
    const isConfigError = error.message?.includes('API key') || error.message?.includes('FAILED_PRECONDITION');
    return {
      response: isConfigError 
        ? "WAI temporalmente fuera de línea: La API de Gemini no está configurada correctamente en el servidor. Por favor, verifique las variables de entorno (GEMINI_API_KEY)."
        : "Lo siento, tuve un problema técnico al analizar los datos. Por favor, intenta de nuevo en unos momentos.",
      error: error.message
    };
  }
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
