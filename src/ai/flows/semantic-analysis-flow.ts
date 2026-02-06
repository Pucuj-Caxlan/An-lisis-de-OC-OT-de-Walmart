'use server';
/**
 * @fileOverview Motor de Inteligencia Semántica para la normalización de OC/OT.
 * 
 * Transforma descripciones técnicas en datos estructurados de auditoría,
 * infiere causas raíz reales y construye descripciones estandarizadas corporativas.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticAnalysisInputSchema = z.object({
  descripcion: z.string(),
  lineItems: z.array(z.object({
    descripcion: z.string(),
    importe: z.number()
  })).optional(),
  causaDeclarada: z.string().optional(),
  montoTotal: z.number().optional(),
  contexto: z.string().optional(),
});
export type SemanticAnalysisInput = z.infer<typeof SemanticAnalysisInputSchema>;

const SemanticAnalysisOutputSchema = z.object({
  conceptoNormalizado: z.string().describe("Etiqueta canónica (ej. Acometida, UVIE, Layout)."),
  especialidadImpactada: z.enum(['Eléctrico', 'Civil', 'Estructuras', 'Ambiental', 'Permisos', 'GNFR', 'Arquitectura', 'Otros']),
  causaRaizReal: z.string().describe("Causa técnica inferida (ej. Omisión en Diseño, Error de Cálculo)."),
  confidence: z.number(),
  summary: z.array(z.string()).describe("Resumen ejecutivo de 3-5 puntos clave."),
  preventiveChecks: z.array(z.string()).describe("Acciones para evitar la recurrencia."),
  standardizedDescription: z.string().describe("Descripción final bajo formato: QUÉ / POR QUÉ / DÓNDE / ESPECIALIDAD / IMPACTO / RIESGO."),
  isOutlier: z.boolean().describe("Si el monto o la causa son inusuales para el formato.")
});
export type SemanticAnalysisOutput = z.infer<typeof SemanticAnalysisOutputSchema>;

const semanticPrompt = ai.definePrompt({
  name: 'semanticPrompt',
  input: {schema: SemanticAnalysisInputSchema},
  output: {schema: SemanticAnalysisOutputSchema},
  prompt: `Eres un Consultor Estratégico de Construcción en Walmart. Analiza el siguiente registro de Orden de Cambio/Trabajo.

ENTRADA:
- Descripción: {{{descripcion}}}
- Causa Declarada: {{{causaDeclarada}}}
- Desglose: {{#each lineItems}} * {{{this.descripcion}}} (${{{this.importe}}}) {{/each}}

OBJETIVOS SEMÁNTICOS:
1. NORMALIZACIÓN: Convierte el texto libre en un 'Concepto Normalizado'. Si mencionan cables o tableros, es 'Sistema Eléctrico'.
2. INFERENCIA DE CAUSA: A menudo se declara 'Emergencia' para acelerar, pero el texto revela 'Falta de planeación'. Identifica la 'Causa Raíz Real'.
3. DESCRIPCIÓN CORPORATIVA: Redacta la 'standardizedDescription' con este esquema estricto:
   [QUÉ]: ... / [POR QUÉ]: ... / [DÓNDE]: ... / [ESPECIALIDAD]: ... / [IMPACTO]: ... / [RIESGO]: ...

Contexto: {{{contexto}}}`,
});

export async function analyzeOrderSemantically(input: SemanticAnalysisInput): Promise<SemanticAnalysisOutput> {
  const {output} = await semanticPrompt(input);
  if (!output) throw new Error("Error en el motor semántico de IA.");
  return output;
}
