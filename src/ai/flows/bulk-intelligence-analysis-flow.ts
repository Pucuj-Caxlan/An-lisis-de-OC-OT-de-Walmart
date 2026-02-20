
'use server';
/**
 * @fileOverview Motor de Inteligencia Consolidada para Análisis Masivo de OC/OT.
 * 
 * Analiza un conjunto seleccionado de registros para encontrar patrones, 
 * similitudes y discrepancias, facilitando la auditoría estratégica de grupos.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BulkIntelligenceInputSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    impactoNeto: z.number(),
    disciplina_normalizada: z.string().optional(),
    causa_raiz_normalizada: z.string().optional(),
    descripcion: z.string(),
    isSigned: z.boolean().optional(),
    fechaSolicitud: z.string().optional()
  })).describe("Lote de órdenes seleccionadas para análisis comparativo"),
});
export type BulkIntelligenceInput = z.infer<typeof BulkIntelligenceInputSchema>;

const BulkIntelligenceOutputSchema = z.object({
  executiveSummary: z.string().describe("Resumen de alto nivel del lote analizado."),
  totalImpactFormatted: z.string(),
  commonPatterns: z.array(z.string()).describe("Lista de patrones recurrentes detectados."),
  recurrenceAnalysis: z.string().describe("Razonamiento técnico sobre por qué se repiten estas incidencias."),
  anomaliesDetected: z.array(z.object({
    orderIds: z.array(z.string()),
    issue: z.string(),
    description: z.string()
  })).describe("Discrepancias o divergencias encontradas entre registros similares."),
  disciplineImpact: z.array(z.object({
    name: z.string(),
    impact: z.number(),
    percentage: z.number()
  })),
  recommendations: z.array(z.string()).describe("Acciones sugeridas para este grupo de registros."),
  isEligibleForBulkAudit: z.boolean().describe("Indica si el lote es lo suficientemente consistente para validación masiva."),
  confidenceScore: z.number()
});
export type BulkIntelligenceOutput = z.infer<typeof BulkIntelligenceOutputSchema>;

const bulkIntelligencePrompt = ai.definePrompt({
  name: 'bulkIntelligencePrompt',
  input: {schema: BulkIntelligenceInputSchema},
  output: {schema: BulkIntelligenceOutputSchema},
  prompt: `Eres un Arquitecto de Inteligencia Forense Senior de Walmart. 
Tu misión es analizar un LOTE de Órdenes de Cambio (OC/OT) seleccionadas por un auditor para encontrar patrones sistémicos y riesgos de grupo.

DATOS DEL LOTE SELECCIONADO:
{{#each orders}}
- PID: {{{projectId}}} | Monto: MXN {{{impactoNeto}}} | Disciplina: {{{disciplina_normalizada}}} | Causa: {{{causa_raiz_normalizada}}} | Firmado: {{#if isSigned}} SÍ {{else}} NO {{/if}}
  Desc: {{{descripcion}}}
{{/each}}

TAREAS DE ANÁLISIS ESTRATÉGICO:
1. IDENTIFICACIÓN DE PATRONES: ¿Hay una disciplina dominante? ¿Se repite el mismo problema en distintos proyectos?
2. ANÁLISIS DE RECURRENCIA: Explica el "Driver" común. ¿Es falla de diseño, omisión de proveedor o falta de homologación?
3. DETECCIÓN DE ANOMALÍAS: Busca registros "fuera de lugar". Ej: Una orden de HVAC de \$1M cuando las demás son de \$100k, o registros similares con clasificaciones opuestas.
4. GOBERNANZA: Determina si el grupo es consistente. Si lo es, recomienda 'isEligibleForBulkAudit' como true. Si hay muchas discrepancias, recomienda revisión individual.

Sé ejecutivo, técnico y enfocado en la reducción de variabilidad presupuestaria.`,
});

export async function analyzeBulkOrders(input: BulkIntelligenceInput): Promise<BulkIntelligenceOutput> {
  const {output} = await bulkIntelligencePrompt(input);
  if (!output) throw new Error("Fallo al generar inteligencia masiva.");
  return output;
}

const bulkIntelligenceAnalysisFlow = ai.defineFlow(
  {
    name: 'bulkIntelligenceAnalysisFlow',
    inputSchema: BulkIntelligenceInputSchema,
    outputSchema: BulkIntelligenceOutputSchema,
  },
  async input => {
    return analyzeBulkOrders(input);
  }
);
