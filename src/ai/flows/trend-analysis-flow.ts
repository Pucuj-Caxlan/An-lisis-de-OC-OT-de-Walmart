'use server';
/**
 * @fileOverview Flujo de IA para el análisis de tendencias estratégicas y proyecciones de impacto multi-anual.
 * Procesa datos agregados de múltiples años para generar narrativas transversales y planes de acción estratégicos.
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
  percentage: z.number().optional(),
});

const TrendAnalysisInputSchema = z.object({
  monthlyData: z.array(MonthlyTrendSchema),
  years: z.array(z.number()).describe("Rango de años analizados para detectar patrones transversales"),
  totalImpact: z.number(),
  rootCauseSummary: z.array(RootCauseSummarySchema).describe("Resumen de las causas raíz más impactantes para contextualizar los planes de acción"),
  paretoTop80: z.array(z.string()).optional().describe("Causas que representan el 80% del impacto financiero"),
});
export type TrendAnalysisInput = z.infer<typeof TrendAnalysisInputSchema>;

const ActionPlanItemSchema = z.object({
  title: z.string().describe("Título del plan de acción estratégico"),
  steps: z.array(z.string()).describe("Lista de pasos concretos a seguir"),
  expectedImpact: z.string().describe("Impacto financiero u operativo esperado de este plan")
});

const TrendAnalysisOutputSchema = z.object({
  narrative: z.string().describe("Resumen ejecutivo de las tendencias observadas en el rango de años"),
  keyDrivers: z.array(z.string()).describe("Principales factores históricos que impulsan el costo o la frecuencia"),
  projections: z.string().describe("Comentario sobre la proyección y salud financiera a largo plazo"),
  recommendations: z.array(z.string()).describe("Acciones estratégicas prioritarias"),
  actionPlan: z.array(ActionPlanItemSchema).describe("Hojas de ruta inteligentes y concretas basadas en las causas raíz recurrentes"),
  sentiment: z.enum(['Optimista', 'Estable', 'Crítico']).describe("Estado general del presupuesto basado en la tendencia multi-anual"),
  estimatedReduction: z.string().describe("Monto o porcentaje estimado de ahorro si se ejecutan los planes")
});
export type TrendAnalysisOutput = z.infer<typeof TrendAnalysisOutputSchema>;

const trendPrompt = ai.definePrompt({
  name: 'trendPrompt',
  input: {schema: TrendAnalysisInputSchema},
  output: {schema: TrendAnalysisOutputSchema},
  prompt: `Eres un Asesor Estratégico Senior de Walmart especializado en Control de Cambios e Inteligencia Forense. 
  Tu objetivo es realizar un análisis estratégico transversal basado en la ley de Pareto (80/20) para el periodo: {{#each years}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.

  CONTEXTO DE DATOS CONSOLIDADOS:
  Impacto Total en el Periodo: MXN {{{totalImpact}}}
  
  RESUMEN DE CAUSAS RAÍZ (ORDENADAS POR IMPACTO):
  {{#each rootCauseSummary}}
  - {{{this.cause}}}: Impacto de \${{{this.impact}}} ({{{this.count}}} órdenes). Reprsenta el {{{this.percentage}}}% del total.
  {{/each}}

  ANÁLISIS PARETO (TOP 80%):
  Las causas que concentran el 80% del impacto financiero son: {{#each paretoTop80}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.

  TAREAS DE ANÁLISIS ESTRATÉGICO:
  1. ANALISIS TRANSVERSAL: Identifica patrones que se repiten año tras año (picos estacionales, fallas de diseño recurrentes).
  2. DRIVERS DE COSTO (80/20): Determina los factores principales que están erosionando el presupuesto. Enfócate en las causas del Top 80%.
  3. PLANES DE ACCIÓN CORPORATIVOS: Genera hojas de ruta con lenguaje de alta dirección (VP). Cada paso debe ser técnico y ejecutable dentro de la estructura de Walmart.
  4. PROYECCIÓN Y AHORRO: Determina si la gestión actual es eficiente y proyecta riesgos futuros. Estima un porcentaje de reducción de impacto si se corrigen los problemas del Pareto.

  INSTRUCCIONES DE SALIDA:
  - Tono ejecutivo, sobrio y basado estrictamente en los datos financieros.
  - Los planes de acción deben ser específicos para las causas que dominan el Pareto.`,
});

export async function analyzeStrategicTrends(input: TrendAnalysisInput): Promise<TrendAnalysisOutput> {
  const {output} = await trendPrompt(input);
  if (!output) throw new Error("Fallo en la generación del análisis estratégico.");
  return output;
}
