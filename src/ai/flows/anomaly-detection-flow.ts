
'use server';
/**
 * @fileOverview Motor de Detección de Anomalías e Inteligencia Forense.
 * 
 * Analiza un conjunto de órdenes para detectar discrepancias semánticas, 
 * riesgos de cumplimiento y patrones de fraude o error administrativo.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnomalySchema = z.object({
  orderId: z.string(),
  projectId: z.string(),
  type: z.enum(['Financiera', 'Cumplimiento', 'Semántica', 'Operacional']),
  severity: z.enum(['Alta', 'Media', 'Baja']),
  finding: z.string().describe("Descripción detallada del hallazgo"),
  reasoning: z.string().describe("Explicación técnica de por qué es una anomalía"),
  recommendation: z.string().describe("Acción correctiva sugerida")
});

const AnomalyDetectionInputSchema = z.object({
  orders: z.array(z.object({
    id: z.string(),
    projectId: z.string(),
    impactoNeto: z.number(),
    causaRaiz: z.string(),
    isSigned: z.boolean(),
    appendixF: z.boolean(),
    descripcion: z.string(),
    semanticAnalysis: z.any().nullable()
  })).describe("Lote de órdenes normalizadas para analizar"),
});
export type AnomalyDetectionInput = z.infer<typeof AnomalyDetectionInputSchema>;

const AnomalyDetectionOutputSchema = z.object({
  anomalies: z.array(AnomalySchema),
  globalHealthScore: z.number().describe("Puntaje de salud de los datos (0-100)"),
  summary: z.string().describe("Resumen ejecutivo de la auditoría")
});
export type AnomalyDetectionOutput = z.infer<typeof AnomalyDetectionOutputSchema>;

const anomalyPrompt = ai.definePrompt({
  name: 'anomalyPrompt',
  input: {schema: AnomalyDetectionInputSchema},
  output: {schema: AnomalyDetectionOutputSchema},
  prompt: `Eres un Auditor Forense Senior de Walmart especializado en Desarrollo Inmobiliario y Control de Cambios. 
  Tu misión es encontrar "Red Flags" y discrepancias críticas en este lote de órdenes de cambio (OC/OT).

  DATOS PARA ANALIZAR (NORMALIZADOS):
  {{#each orders}}
  - ID: {{{id}}} | PID: {{{projectId}}} | Monto: \${{{impactoNeto}}} | Causa Declarada: {{{causaRaiz}}} | Firmado: {{#if isSigned}} SÍ {{else}} NO {{/if}} | Apéndice F: {{#if appendixF}} SÍ {{else}} NO {{/if}}
    Descripción: {{{descripcion}}}
    IA Concepto Previo: {{{semanticAnalysis.conceptoNormalizado}}} | IA Causa Real Previa: {{{semanticAnalysis.causaRaizReal}}}
  {{/each}}

  CRITERIOS DE AUDITORÍA FORENSE:
  1. DISCREPANCIA SEMÁNTICA CRÍTICA: La descripción revela un error de diseño o coordinación (ej. "ajuste por omisión de planos") pero se declara como "Regulatorio" o "Autoridad" para evitar penalizaciones.
  2. RIESGO DE COMPLIANCE FINANCIERO: Órdenes con montos > $1M (MXN) que NO están firmadas o carecen de Apéndice F cuando la descripción menciona trámites o autoridades.
  3. FRAGMENTACIÓN DE COSTOS (SPLITTING): Identifica si un mismo PID tiene múltiples órdenes en fechas cercanas que sumadas exceden límites de autorización.
  4. ANOMALÍA OPERACIONAL: Montos desproporcionados para la descripción técnica provista (ej. $500k por "limpieza de terreno" en una unidad pequeña).

  INSTRUCCIONES DE SALIDA:
  - Sé específico en el hallazgo (no genérico).
  - El Health Score debe bajar drásticamente si hay discrepancias semánticas o falta de firmas en montos altos.
  - El resumen debe ser de nivel ejecutivo (VP).`,
});

export async function detectAnomalies(input: AnomalyDetectionInput): Promise<AnomalyDetectionOutput> {
  const {output} = await anomalyPrompt(input);
  return output!;
}

const anomalyDetectionFlow = ai.defineFlow(
  {
    name: 'anomalyDetectionFlow',
    inputSchema: AnomalyDetectionInputSchema,
    outputSchema: AnomalyDetectionOutputSchema,
  },
  async input => {
    return detectAnomalies(input);
  }
);
