
'use server';
/**
 * @fileOverview Flujo de IA para el análisis de tendencias estratégicas y proyecciones de impacto.
 * Procesa datos agregados mensuales y resúmenes de causas raíz para generar narrativas y planes de acción inteligentes.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MonthlyTrendSchema = z.object({
  month: z.string(),
  impact: z.number(),
  count: z.number(),
});

const RootCauseSummarySchema = z.object({
  cause: z.string(),
  impact: z.number(),
  count: z.number(),
});

const TrendAnalysisInputSchema = z.object({
  monthlyData: z.array(MonthlyTrendSchema),
  year: z.number(),
  totalImpact: z.number(),
  rootCauseSummary: z.array(RootCauseSummarySchema).optional().describe("Resumen de las causas raíz más impactantes para contextualizar los planes de acción"),
});
export type TrendAnalysisInput = z.infer<typeof TrendAnalysisInputSchema>;

const ActionPlanItemSchema = z.object({
  title: z.string().describe("Título del plan de acción estratégico"),
  steps: z.array(z.string()).describe("Lista de pasos concretos a seguir"),
  expectedImpact: z.string().describe("Impacto financiero u operativo esperado de este plan")
});

const TrendAnalysisOutputSchema = z.object({
  narrative: z.string().describe("Resumen ejecutivo de las tendencias observadas"),
  keyDrivers: z.array(z.string()).describe("Principales factores que impulsan el costo o la frecuencia"),
  projections: z.string().describe("Comentario sobre la proyección al cierre de año"),
  recommendations: z.array(z.string()).describe("Acciones estratégicas rápidas"),
  actionPlan: z.array(ActionPlanItemSchema).describe("Hojas de ruta inteligentes y concretas basadas en las causas raíz"),
  sentiment: z.enum(['Optimista', 'Estable', 'Crítico']).describe("Estado general del presupuesto basado en la tendencia")
});
export type TrendAnalysisOutput = z.infer<typeof TrendAnalysisOutputSchema>;

const trendPrompt = ai.definePrompt({
  name: 'trendPrompt',
  input: {schema: TrendAnalysisInputSchema},
  output: {schema: TrendAnalysisOutputSchema},
  prompt: `Eres un Asesor Estratégico Senior para la Vicepresidencia de Construcción de Walmart especializado en Control de Cambios. 
  Tu objetivo es analizar la evolución mensual de las Órdenes de Cambio (OC/OT) del año {{{year}}} y generar PLANES DE ACCIÓN INTELIGENTES.

  DATOS AGREGADOS ANUALES:
  Impacto Total Anual: \${{{totalImpact}}}
  
  DESGLOSE MENSUAL:
  {{#each monthlyData}}
  - {{{this.month}}}: \${{{this.impact}}} ({{{this.count}}} órdenes)
  {{/each}}
  
  RESUMEN DE CAUSAS RAÍZ DETECTADAS (BASADO EN AUDITORÍA SEMÁNTICA):
  {{#each rootCauseSummary}}
  - {{{this.cause}}}: Impacto de \${{{this.impact}}} en {{{this.count}}} incidentes.
  {{/each}}
  
  TAREAS DE ANÁLISIS:
  1. Identifica anomalías y picos de costo. Determina si la tendencia es creciente.
  2. ANALIZA LAS CAUSAS RAÍZ: Identifica la causa más costosa y genera un Plan de Acción Inteligente para mitigarla.
  3. Los planes de acción deben ser "Inteligentes": con pasos técnicos reales (ej. mejorar fase de diseño, negociar contratos, etc.) y un impacto esperado.
  4. Define el sentimiento general del presupuesto basado en la aceleración mensual.

  INSTRUCCIONES DE SALIDA:
  - Mantén un tono profesional, directo y basado en datos financieros Walmart.
  - Proyecta si el año cerrará con sobrecostos.`,
});

export async function analyzeStrategicTrends(input: TrendAnalysisInput): Promise<TrendAnalysisOutput> {
  const {output} = await trendPrompt(input);
  return output!;
}
