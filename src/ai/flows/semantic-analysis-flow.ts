
'use server';
/**
 * @fileOverview Motor de Inteligencia Semántica Avanzada para Auditoría de Construcción.
 * 
 * Realiza una disección técnica de los registros para identificar causa raíz real,
 * subcausas específicas (MEP), tipos de error y alertas forenses.
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
  conceptoNormalizado: z.string().describe("Categoría canónica del trabajo (ej. Ingeniería Eléctrica, Obra Civil)."),
  especialidadImpactada: z.enum(['Eléctrico', 'Civil', 'Estructuras', 'Ambiental', 'Permisos', 'GNFR', 'Arquitectura', 'Instalaciones', 'Otros']),
  subCausa: z.string().describe("Subcategoría técnica específica (ej. Tableros, Transformador, UPS, Canalizaciones, Luminarias)."),
  tipoError: z.enum(['Omisión', 'Interferencia', 'Especificación Incorrecta', 'Cambio Normativo', 'Cambio Prototipo', 'Otro']).describe("Clasificación del driver del error."),
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
- Descripción Original: {{{descripcion}}}
- Causa Declarada: {{{causaDeclarada}}}
- Impacto Financiero: MXN {{{montoTotal}}}
- Documento Firmado: {{#if isSigned}} SÍ {{else}} NO {{/if}}

INSTRUCCIONES MEP:
1. IDENTIFICACIÓN DE DRIVERS:
   - Eléctrico: Tableros, UPS, Subestación, Luminarias, UVIE.
   - Civil: Terracerías, Cimentación, Estructura, Pisos.
2. CLASIFICACIÓN DEL ERROR: Omisión, Interferencia, Especificación Incorrecta, Cambio Normativo/Prototipo.

Genera un análisis técnico profundo.`,
});

export async function analyzeOrderSemantically(input: SemanticAnalysisInput): Promise<SemanticAnalysisOutput> {
  const {output} = await semanticPrompt(input);
  if (!output) throw new Error("Fallo en la generación del análisis semántico por parte de la IA.");
  return output;
}
