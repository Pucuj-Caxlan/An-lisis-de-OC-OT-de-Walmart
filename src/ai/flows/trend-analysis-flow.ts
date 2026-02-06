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
});

const TrendAnalysisInputSchema = z.object({
  monthlyData: z.array(MonthlyTrendSchema),
  years: z.array(z.number()).describe("Rango de años analizados para detectar patrones transversales"),
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
  narrative: z.string().describe("Resumen ejecutivo de las tendencias observadas en el rango de años"),
  keyDrivers: z.array(z.string()).describe("Principales factores históricos que impulsan el costo o la frecuencia"),
  projections: z.string().describe("Comentario sobre la proyección y salud financiera a largo plazo"),
  recommendations: z.array(z.string()).describe("Acciones estratégicas prioritarias"),
  actionPlan: z.array(ActionPlanItemSchema).describe("Hojas de ruta inteligentes y concretas basadas en las causas raíz recurrentes"),
  sentiment: z.enum(['Optimista', 'Estable', 'Crítico']).describe("Estado general del presupuesto basado en la tendencia multi-anual")
});
export type TrendAnalysisOutput = z.infer<typeof TrendAnalysisOutputSchema>;

const trendPrompt = ai.definePrompt({
  name: 'trendPrompt',
  input: {schema: TrendAnalysisInputSchema},
  output: {schema: TrendAnalysisOutputSchema},
  prompt: `Eres un Asesor Estratégico Senior de Walmart especializado en Control de Cambios e Inteligencia Forense. 
  Tu objetivo es realizar un análisis estratégico transversal de las Órdenes de Cambio (OC/OT) para el periodo: {{#each years}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.

  CONTEXTO DE DATOS CONSOLIDADOS:
  Impacto Total en el Periodo: MXN {{{totalImpact}}}
  
  DESGLOSE AGREGADO MENSUAL (Promedio/Suma del rango):
  {{#each monthlyData}}
  - {{{this.month}}}: \${{{this.impact}}} ({{{this.count}}} órdenes)
  {{/each}}
  
  RESUMEN DE CAUSAS RAÍZ RECURRENTES:
  {{#each rootCauseSummary}}
  - {{{this.cause}}}: Impacto acumulado de \${{{this.impact}}} en {{{this.count}}} incidentes.
  {{/each}}
  
  TAREAS DE ANÁLISIS ESTRATÉGICO:
  1. ANALISIS TRANSVERSAL: Identifica patrones que se repiten año tras año (picos estacionales, fallas de diseño recurrentes).
  2. DRIVERS DE COSTO: Determina los 3 factores principales que están erosionando el presupuesto.
  3. PLANES DE ACCIÓN CORPORATIVOS: Genera hojas de ruta con lenguaje de alta dirección. Cada paso debe ser técnico y ejecutable dentro de la estructura de Walmart.
  4. PROYECCIÓN: Determina si la gestión actual es eficiente comparada con el histórico y proyecta riesgos futuros.

  INSTRUCCIONES DE SALIDA:
  - Tono ejecutivo, sobrio y basado estrictamente en los datos financieros.
  - Los planes de acción deben incluir métricas de éxito (Impacto esperado).`,
});

export async function analyzeStrategicTrends(input: TrendAnalysisInput): Promise<TrendAnalysisOutput> {
  const {output} = await trendPrompt(input);
  return output!;
}
