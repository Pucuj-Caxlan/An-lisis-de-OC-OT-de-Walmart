
'use server';
/**
 * @fileOverview Flujo de análisis semántico avanzado para OC/OT.
 * Normaliza conceptos, infiere causas reales y genera insights preventivos.
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
  contexto: z.string().optional().describe("Contexto histórico o reglas de taxonomía"),
});
export type SemanticAnalysisInput = z.infer<typeof SemanticAnalysisInputSchema>;

const SemanticAnalysisOutputSchema = z.object({
  conceptoNormalizado: z.string().describe("Etiqueta corta del trabajo (ej. UVIE, Acometida, Layout)"),
  especialidadImpactada: z.enum(['Eléctrico', 'Civil', 'Estructuras', 'Ambiental', 'Permisos', 'GNFR', 'Otros']),
  causaRaizReal: z.string().describe("Causa inferida tras análisis profundo (ej. Omisión en Diseño vs Cambio de Alcance)"),
  confidence: z.number(),
  summary: z.array(z.string()).describe("3-5 bullets con los puntos clave del impacto"),
  preventiveChecks: z.array(z.string()).describe("Checklist para prevenir este error en el futuro"),
  isOutlier: z.boolean().describe("Si el impacto o la combinación es inusual")
});
export type SemanticAnalysisOutput = z.infer<typeof SemanticAnalysisOutputSchema>;

const semanticPrompt = ai.definePrompt({
  name: 'semanticPrompt',
  input: {schema: SemanticAnalysisInputSchema},
  output: {schema: SemanticAnalysisOutputSchema},
  prompt: `Eres un consultor senior de auditoría técnica para Walmart. 
  Tu objetivo es analizar una Orden de Cambio (OC) o de Trabajo (OT) y normalizarla.

  DATOS DE ENTRADA:
  Descripción: {{{descripcion}}}
  Causa Declarada: {{{causaDeclarada}}}
  Line Items: {{#each lineItems}} - {{{this.descripcion}}} (${{{this.importe}}}) {{/each}}
  
  TAREAS:
  1. Identifica el "Concepto Normalizado" (ej. si dice 'movimiento de muros y pintura' -> 'Remodelación Layout').
  2. Determina la "Especialidad Impactada" predominante.
  3. Infiere la "Causa Raíz Real": a veces lo declaran como 'Emergencia' pero el texto revela 'Falta de Planeación'.
  4. Genera un Resumen Ejecutivo en bullets.
  5. Crea un Checklist Preventivo (Acciones de diseño/supervisión para evitar esto).

  Contexto Adicional: {{{contexto}}}`,
});

export async function analyzeOrderSemantically(input: SemanticAnalysisInput): Promise<SemanticAnalysisOutput> {
  const {output} = await semanticPrompt(input);
  return output!;
}
