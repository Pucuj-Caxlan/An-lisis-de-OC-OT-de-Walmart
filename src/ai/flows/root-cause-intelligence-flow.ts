
'use server';
/**
 * @fileOverview Motor de Inteligencia de Causa Raíz (Root Cause Intelligence - RCI).
 * 
 * Analiza clusters de órdenes para identificar por qué se repiten los problemas
 * y propone planes de mitigación accionables con evidencia forense.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RecommendedActionSchema = z.object({
  action: z.string().describe("Acción correctiva o preventiva concreta."),
  owner: z.string().describe("Rol responsable (ej. Diseño, PMO, MEP)."),
  priority: z.enum(['Alta', 'Media', 'Baja']),
});

const RootCauseIntelligenceInputSchema = z.object({
  causeId: z.string().describe("Nombre de la causa raíz a analizar (ej. Ingeniería Eléctrica)."),
  orders: z.array(z.object({
    id: z.string(),
    projectId: z.string(),
    impactoNeto: z.number(),
    descripcion: z.string(),
    subCausa: z.string().optional(),
    tipoError: z.string().optional(),
    proveedor: z.string().optional(),
    etapa: z.string().optional()
  })).describe("Lote de registros asociados a esta causa."),
});
export type RootCauseIntelligenceInput = z.infer<typeof RootCauseIntelligenceInputSchema>;

const RootCauseIntelligenceOutputSchema = z.object({
  driversDetected: z.array(z.string()).describe("Patrones sistémicos detectados (ej. Falla recurrente en etapa de diseño)."),
  recurrenceReasoning: z.string().describe("Narrativa técnica de por qué este problema es recurrente."),
  recommendedActions: z.array(RecommendedActionSchema),
  expectedReductionPct: z.number().describe("Porcentaje estimado de reducción de impacto si se aplican las soluciones."),
  confidence: z.number().describe("Nivel de confianza de la IA (0-1)."),
  supportingEvidence: z.array(z.string()).describe("IDs de proyectos o registros que sirven como evidencia clave.")
});
export type RootCauseIntelligenceOutput = z.infer<typeof RootCauseIntelligenceOutputSchema>;

const intelligencePrompt = ai.definePrompt({
  name: 'intelligencePrompt',
  input: {schema: RootCauseIntelligenceInputSchema},
  output: {schema: RootCauseIntelligenceOutputSchema},
  prompt: `Eres un Consultor Estratégico Senior y Auditor Forense experto en Lean Construction. 
Tu misión es analizar por qué la causa raíz "{{{causeId}}}" se está repitiendo y proponer soluciones definitivas.

DATOS DE REGISTROS (CLUSTER):
{{#each orders}}
- PID: {{{projectId}}} | Monto: \${{{impactoNeto}}} | Subcausa: {{{subCausa}}} | Error: {{{tipoError}}} | Prov: {{{proveedor}}}
  Desc: {{{descripcion}}}
{{/each}}

TAREAS:
1. ANÁLISIS SISTÉMICO: Busca hilos conductores. ¿Es el mismo proveedor? ¿Es siempre en la etapa de construcción (lo que sugiere falla de diseño)? ¿Es siempre la misma subcausa técnica?
2. RAZONAMIENTO DE RECURRENCIA: Explica la "verdad incómoda". Ej: "Se repite porque el área de Compras ignora los planos de UVIE en la licitación".
3. PLAN DE ACCIÓN: Propone 3 a 5 acciones de alto retorno. Asigna un responsable (Diseño, GC, MEP, Compras, etc.).
4. EVIDENCIA: Cita los PIDs específicos donde el patrón es más evidente.

Sé técnico, directo y orientado a resultados financieros.`,
});

export async function generateRootCauseIntelligence(input: RootCauseIntelligenceInput): Promise<RootCauseIntelligenceOutput> {
  const {output} = await intelligencePrompt(input);
  if (!output) throw new Error("Fallo al generar inteligencia de causa raíz.");
  return output;
}

const rootCauseIntelligenceFlow = ai.defineFlow(
  {
    name: 'rootCauseIntelligenceFlow',
    inputSchema: RootCauseIntelligenceInputSchema,
    outputSchema: RootCauseIntelligenceOutputSchema,
  },
  async input => {
    return generateRootCauseIntelligence(input);
  }
);
