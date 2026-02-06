
'use server';
/**
 * @fileOverview Motor de Inteligencia Semántica para la normalización y auditoría de OC/OT.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticAnalysisInputSchema = z.object({
  descripcion: z.string(),
  causaDeclarada: z.string().optional(),
  montoTotal: z.number().optional(),
  contextoExtendido: z.any().optional().describe("Datos completos extraídos del PDF para mayor contexto."),
  isSigned: z.boolean().optional(),
});
export type SemanticAnalysisInput = z.infer<typeof SemanticAnalysisInputSchema>;

const SemanticAnalysisOutputSchema = z.object({
  conceptoNormalizado: z.string().describe("Etiqueta canónica."),
  especialidadImpactada: z.enum(['Eléctrico', 'Civil', 'Estructuras', 'Ambiental', 'Permisos', 'GNFR', 'Arquitectura', 'Instalaciones', 'Otros']),
  causaRaizReal: z.string().describe("Inferencia técnica."),
  confidence: z.number(),
  summary: z.array(z.string()).describe("Hallazgos clave."),
  preventiveChecks: z.array(z.string()).describe("Recomendaciones."),
  standardizedDescription: z.string().describe("Formato: [QUÉ]: ... / [POR QUÉ]: ... / [RIESGO]: ..."),
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
  prompt: `Eres un Consultor Estratégico de Construcción en Walmart. Analiza el siguiente registro para auditoría.

ENTRADA:
- Descripción: {{{descripcion}}}
- Causa Declarada: {{{causaDeclarada}}}
- Monto: MXN {{{montoTotal}}}
- Firmado: {{#if isSigned}} SÍ {{else}} NO {{/if}}

OBJETIVOS:
1. VERDAD TÉCNICA: Identifica la 'Causa Raíz Real'.
2. ALERTAS: Si el monto es alto y el documento NO está firmado, genera una alerta High.
3. NORMALIZACIÓN: Estandariza la descripción [QUÉ] / [POR QUÉ] / [RIESGO].`,
});

export async function analyzeOrderSemantically(input: SemanticAnalysisInput): Promise<SemanticAnalysisOutput> {
  const {output} = await semanticPrompt(input);
  if (!output) throw new Error("Error en el análisis semántico.");
  return output;
}
