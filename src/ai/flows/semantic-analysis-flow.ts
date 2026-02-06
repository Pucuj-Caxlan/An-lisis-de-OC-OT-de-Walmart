
'use server';
/**
 * @fileOverview Motor de Inteligencia Semántica Avanzada para Auditoría de Construcción.
 * 
 * Este flujo realiza una disección técnica de los registros de OC/OT para identificar
 * la causa raíz real, estandarizar descripciones y generar alertas de riesgo.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticAnalysisInputSchema = z.object({
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  format: z.string().optional(),
  descripcion: z.string(),
  causaDeclarada: z.string().optional(),
  montoTotal: z.number().optional(),
  contextoExtendido: z.any().optional().describe("Datos completos extraídos del PDF o Excel para mayor contexto."),
  isSigned: z.boolean().optional(),
});
export type SemanticAnalysisInput = z.infer<typeof SemanticAnalysisInputSchema>;

const SemanticAnalysisOutputSchema = z.object({
  conceptoNormalizado: z.string().describe("Categoría canónica del trabajo (ej. Sistema Eléctrico, Obra Civil)."),
  especialidadImpactada: z.enum(['Eléctrico', 'Civil', 'Estructuras', 'Ambiental', 'Permisos', 'GNFR', 'Arquitectura', 'Instalaciones', 'Otros']),
  causaRaizReal: z.string().describe("Inferencia técnica de la causa real basada en la descripción."),
  confidence: z.number().describe("Nivel de certeza del análisis (0.0 a 1.0)."),
  summary: z.array(z.string()).describe("Hallazgos clave de la auditoría semántica."),
  preventiveChecks: z.array(z.string()).describe("Acciones para evitar este tipo de desviaciones en el futuro."),
  standardizedDescription: z.string().describe("Descripción en formato oficial: [QUÉ] / [POR QUÉ] / [RIESGO]."),
  auditAlerts: z.array(z.object({
    type: z.string(),
    message: z.string(),
    severity: z.enum(['High', 'Med', 'Low'])
  }))
});
export type SemanticAnalysisOutput = z.infer<typeof SemanticAnalysisOutputSchema>;

const semanticPrompt = ai.definePrompt({
  name: 'semanticPrompt',
  input: {schema: SemanticAnalysisInputSchema},
  output: {schema: SemanticAnalysisOutputSchema},
  prompt: `Eres un Auditor Forense Senior de Construcción para Walmart International. Tu objetivo es normalizar y auditar registros de Órdenes de Cambio (OC/OT).

CONTEXTO DEL REGISTRO:
- Proyecto: {{{projectName}}} (PID: {{{projectId}}})
- Formato: {{{format}}}
- Descripción Original: {{{descripcion}}}
- Causa Declarada: {{{causaDeclarada}}}
- Impacto Financiero: MXN {{{montoTotal}}}
- Documento Firmado: {{#if isSigned}} SÍ {{else}} NO {{/if}}

INSTRUCCIONES DE AUDITORÍA:
1. VERDAD TÉCNICA: Ignora la "Causa Declarada" si la "Descripción Original" sugiere algo distinto. Si la descripción menciona errores de diseño o planos, la Causa Raíz Real es "Omisión de Diseño", incluso si se declaró como "Regulatorio".
2. NORMALIZACIÓN: Genera una 'Descripción Estandarizada' siguiendo estrictamente este formato:
   [QUÉ]: (Breve descripción del trabajo) / [POR QUÉ]: (Causa técnica identificada) / [RIESGO]: (Impacto si no se realiza).
3. DETECCIÓN DE ALERTAS:
   - Severidad HIGH: Si el monto es > $50,000 MXN y NO está firmado.
   - Severidad MED: Si hay discrepancia entre la Causa Declarada y la Real.
   - Severidad LOW: Si faltan planos referenciados en la descripción.

Manten un tono técnico, preciso y ejecutivo.`,
});

export async function analyzeOrderSemantically(input: SemanticAnalysisInput): Promise<SemanticAnalysisOutput> {
  const {output} = await semanticPrompt(input);
  if (!output) throw new Error("Fallo en la generación del análisis semántico por parte de la IA.");
  return output;
}
