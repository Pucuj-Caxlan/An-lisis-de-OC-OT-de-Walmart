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
  orders: z.array(z.any()).describe("Lote de órdenes a analizar"),
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
  prompt: `Eres un Auditor Forense Senior de Walmart especializado en Desarrollo Inmobiliario. 
  Tu misión es encontrar "Red Flags" en este lote de órdenes de cambio (OC/OT).

  DATOS PARA ANALIZAR:
  {{#each orders}}
  - ID: {{{id}}} | PID: {{{projectId}}} | Monto: \${{{impactoNeto}}} | Causa: {{{causaRaiz}}} | Firmado: {{{isSigned}}} | Apéndice F: {{{antiCorruption.appendixF}}}
    Descripción: {{{descripcion}}}
    IA Concepto: {{{semanticAnalysis.conceptoNormalizado}}} | IA Causa Real: {{{semanticAnalysis.causaRaizReal}}}
  {{/each}}

  CRITERIOS DE DETECCIÓN:
  1. DISCREPANCIA SEMÁNTICA: Si la 'Causa Real' inferida por IA difiere drásticamente de la 'Causa Declarada' (ej. Error de diseño vs Autoridad).
  2. RIESGO DE CUMPLIMIENTO: Órdenes de >$1M sin firmas o sin Apéndice F cuando la causa involucra autoridades.
  3. FRAGMENTACIÓN: Múltiples órdenes para el mismo PID en fechas cercanas que parecen dividir un costo mayor.
  4. ANOMALÍA FINANCIERA: Montos inusualmente altos para conceptos simples (ej. $500k por un trámite administrativo).

  Genera un reporte técnico con hallazgos precisos.`,
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
