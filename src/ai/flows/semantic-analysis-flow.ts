'use server';
/**
 * @fileOverview Motor de Inteligencia Semántica para la normalización y auditoría de OC/OT.
 * 
 * Transforma datos crudos de PDF/Excel en inteligencia de negocio,
 * detectando discrepancias entre la causa declarada y la realidad técnica.
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
  conceptoNormalizado: z.string().describe("Etiqueta canónica (ej. Acometida Eléctrica, Obra Civil, Permisos)."),
  especialidadImpactada: z.enum(['Eléctrico', 'Civil', 'Estructuras', 'Ambiental', 'Permisos', 'GNFR', 'Arquitectura', 'Instalaciones', 'Otros']),
  causaRaizReal: z.string().describe("Inferencia técnica (ej. Error de Cálculo en Diseño, Omisión de Trámite, Ajuste Operativo)."),
  confidence: z.number(),
  summary: z.array(z.string()).describe("Hallazgos clave detectados por la IA."),
  preventiveChecks: z.array(z.string()).describe("Recomendaciones para evitar recurrencia."),
  standardizedDescription: z.string().describe("Formato: [QUÉ]: ... / [POR QUÉ]: ... / [RIESGO]: ..."),
  auditAlerts: z.array(z.object({
    type: z.string(),
    message: z.string(),
    severity: z.enum(['High', 'Med', 'Low'])
  })).describe("Alertas de cumplimiento o inconsistencias de datos.")
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
- Monto: \${{{montoTotal}}}
- Firmado: {{#if isSigned}} SÍ {{else}} NO {{/if}}
- Contexto PDF: {{{contextoExtendido}}}

OBJETIVOS:
1. VERDAD TÉCNICA: A menudo se declara 'Cumplimiento / Autoridad' para evitar penalizaciones internas, pero la descripción revela 'ajuste por error en plano'. Identifica la 'Causa Raíz Real'.
2. ALERTAS: Si el monto es alto y el documento NO está firmado, genera una alerta High. Si falta el Apéndice F en un cambio por 'Autoridad', genera una alerta.
3. NORMALIZACIÓN: Estandariza la descripción para que Pedro (VP) pueda leerla rápidamente.

Esquema de descripción:
[QUÉ]: El cambio físico.
[POR QUÉ]: El motivo técnico o administrativo.
[RIESGO]: Qué pasa si no se autoriza.`,
});

export async function analyzeOrderSemantically(input: SemanticAnalysisInput): Promise<SemanticAnalysisOutput> {
  const {output} = await semanticPrompt(input);
  if (!output) throw new Error("Error en el análisis semántico.");
  return output;
}
