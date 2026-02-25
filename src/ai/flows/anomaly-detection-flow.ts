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

  LISTADO OFICIAL DE RED FLAGS PARA ANALIZAR:
  1. Frecuencia inusualmente alta de solicitudes de órdenes de cambio para un proyecto o ciertos proveedores.
  2. OC/OTs que no siguen los procesos estándar (urgentes o apresurados) o falta la documentación de soporte requerida.
  3. OC/OTs enviadas inmediatamente o poco después de la aprobación original del proyecto o del inicio de la construcción.
  4. OC/OTs con cambios en tarifas, cargos por servicio, cargos administrativos u otros cargos auxiliares que no estén adecuadamente soportados contractualmente.
  5. OC/OTs con descripciones vagas, propósito comercial inusual o fuera del alcance del trabajo definido.
  6. OC/OTs con descripción de servicios para la aceleración iniciada por el gobierno o agilización de hitos.
  7. Posibilidad o apariencia de manipulación del proceso para aumentar inapropiadamente el alcance o gasto general.

  DATOS PARA ANALIZAR (NORMALIZADOS):
  {{#each orders}}
  - ID: {{{id}}} | PID: {{{projectId}}} | Monto: MXN {{{impactoNeto}}} | Causa Declarada: {{{causaRaiz}}} | Firmado: {{#if isSigned}} SÍ {{else}} NO {{/if}} | Apéndice F: {{#if appendixF}} SÍ {{else}} NO {{/if}}
    Descripción: {{{descripcion}}}
    IA Causa Normalizada: {{{semanticAnalysis.causa_raiz_normalizada}}} | IA Rationale: {{{semanticAnalysis.rationale_tecnico}}}
  {{/each}}

  INSTRUCCIONES DE SALIDA:
  - Sé específico en el hallazgo citando el número de Red Flag detectado.
  - El Health Score debe bajar significativamente si detectas manipulación o falta de soporte en montos altos.
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
