
'use server';
/**
 * @fileOverview Motor de Inteligencia Semántica Avanzada para Clasificación Automática de OC/OT.
 * 
 * Realiza una clasificación híbrida (Taxonomía + LLM) para normalizar Disciplinas y Causas Raíz.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticAnalysisInputSchema = z.object({
  descripcion: z.string().describe("Texto libre de la descripción de la causa raíz de la OC/OT."),
  monto: z.number().optional(),
  contexto: z.object({
    disciplinasVigentes: z.array(z.string()).optional(),
    causasVigentes: z.array(z.string()).optional(),
  }).optional(),
});
export type SemanticAnalysisInput = z.infer<typeof SemanticAnalysisInputSchema>;

const SemanticAnalysisOutputSchema = z.object({
  disciplina_normalizada: z.string().describe("Disciplina técnica detectada (ej. Eléctrica, Civil, Estructura)."),
  causa_raiz_normalizada: z.string().describe("Causa raíz normalizada según catálogo."),
  subcausa_normalizada: z.string().nullable().describe("Subcategoría técnica específica detectada."),
  confidence_score: z.number().describe("Nivel de certeza de la clasificación (0.0 a 1.0)."),
  evidence_terms: z.array(z.string()).describe("Palabras clave o frases que justifican la clasificación."),
  rationale_short: z.string().describe("Explicación breve del razonamiento de la IA (máx 2 líneas)."),
  needs_review: z.boolean().describe("True si la descripción es vaga o la confianza es baja."),
});
export type SemanticAnalysisOutput = z.infer<typeof SemanticAnalysisOutputSchema>;

const semanticPrompt = ai.definePrompt({
  name: 'semanticPrompt',
  input: {schema: SemanticAnalysisInputSchema},
  output: {schema: SemanticAnalysisOutputSchema},
  prompt: `Eres un Arquitecto de Datos y Auditor Forense Senior de Walmart. Tu misión es clasificar registros de Órdenes de Cambio (OC/OT) con precisión quirúrgica.

CATÁLOGO DE REFERENCIA (DISCIPLINAS):
{{#each contexto.disciplinasVigentes}}
- {{{this}}}
{{/each}}
(Si no coincide con ninguna, usa "Indefinida")

CATÁLOGO DE REFERENCIA (CAUSAS RAÍZ):
{{#each contexto.causasVigentes}}
- {{{this}}}
{{/each}}

REGLAS DE CLASIFICACIÓN:
1. IDIOMA: Maneja español, inglés o mezcla (spanglish) con abreviaturas técnicas.
2. ROBUSTEZ: Si el texto es vago (ej. "ajustes varios", "varios", "extra"), clasifica como "Indefinida", pon confianza < 0.5 y needs_review: true.
3. EVIDENCIA: Extrae los términos técnicos que dispararon la clasificación (ej. "UVIE", "Tablero", "Trinchera").
4. NORMALIZACIÓN: Mapea sinónimos al nombre canónico (ej. "Herrería" -> "Estructura Metálica").

DESCRIPCIÓN PARA ANALIZAR:
"""
{{{descripcion}}}
"""

RESPONDE ÚNICAMENTE EN JSON VÁLIDO.`,
});

export async function analyzeOrderSemantically(input: SemanticAnalysisInput): Promise<SemanticAnalysisOutput> {
  const {output} = await semanticPrompt(input);
  if (!output) throw new Error("Fallo en la generación del análisis semántico por parte de la IA.");
  
  // Lógica de validación post-IA
  const needsReview = output.confidence_score < 0.75 || output.disciplina_normalizada === 'Indefinida';
  
  return {
    ...output,
    needs_review: needsReview
  };
}
