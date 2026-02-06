
'use server';
/**
 * @fileOverview Flujo de IA para el análisis de tendencias estratégicas y proyecciones de impacto.
 * Procesa datos agregados mensuales para generar narrativas ejecutivas.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MonthlyTrendSchema = z.object({
  month: z.string(),
  impact: z.number(),
  count: z.number(),
});

const TrendAnalysisInputSchema = z.object({
  monthlyData: z.array(MonthlyTrendSchema),
  year: z.number(),
  totalImpact: z.number(),
});
export type TrendAnalysisInput = z.infer<typeof TrendAnalysisInputSchema>;

const TrendAnalysisOutputSchema = z.object({
  narrative: z.string().describe("Resumen ejecutivo de las tendencias observadas"),
  keyDrivers: z.array(z.string()).describe("Principales factores que impulsan el costo o la frecuencia"),
  projections: z.string().describe("Comentario sobre la proyección al cierre de año"),
  recommendations: z.array(z.string()).describe("3-5 acciones estratégicas para mitigar impactos futuros"),
  sentiment: z.enum(['Optimista', 'Estable', 'Crítico']).describe("Estado general del presupuesto basado en la tendencia")
});
export type TrendAnalysisOutput = z.infer<typeof TrendAnalysisOutputSchema>;

const trendPrompt = ai.definePrompt({
  name: 'trendPrompt',
  input: {schema: TrendAnalysisInputSchema},
  output: {schema: TrendAnalysisOutputSchema},
  prompt: `Eres un Asesor Estratégico Senior para la Vicepresidencia de Construcción de Walmart. 
  Tu objetivo es analizar la evolución mensual de las Órdenes de Cambio (OC/OT) del año {{{year}}}.

  DATOS AGREGADOS:
  Impacto Total Anual: \${{{totalImpact}}}
  Desglose Mensual:
  {{#each monthlyData}}
  - {{{this.month}}}: \${{{this.impact}}} ({{{this.count}}} órdenes)
  {{/each}}
  
  TAREAS:
  1. Identifica anomalías (picos de costo) y posibles causas (ej. estacionalidad, cierre de trimestre).
  2. Determina si la tendencia es creciente o decreciente.
  3. Proyecta si el año cerrará bajo presupuesto o con sobrecostos basado en la aceleración.
  4. Da recomendaciones tácticas para los coordinadores de proyecto.

  Manten un tono profesional, directo y basado en datos financieros.`,
});

export async function analyzeStrategicTrends(input: TrendAnalysisInput): Promise<TrendAnalysisOutput> {
  const {output} = await trendPrompt(input);
  return output!;
}
