
'use server';
/**
 * @fileOverview Motor de Inteligencia Semántica Avanzada para Clasificación Automática de OC/OT.
 * 
 * Realiza una clasificación híbrida con explicabilidad y trazabilidad forense.
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
  subcausa_normalizada: z.string().describe("Subcategoría técnica específica detectada."),
  detalle_nivel_3: z.string().describe("Tercer nivel de especificidad técnica detectado."),
  confidence_score: z.number().describe("Nivel de certeza de la clasificación (0.0 a 1.0)."),
  evidence_terms: z.array(z.string()).describe("Palabras clave o frases que justifican la clasificación."),
  descripcion_original: z.string().describe("Texto íntegro analizado."),
  standardizedDescription: z.string().describe("Descripción técnica estandarizada y clara del hallazgo."),
  rationale_tecnico: z.string().describe("Explicación resumida del porqué técnico de la decisión."),
  logica_clasificacion: z.object({
    terminos_detectados: z.array(z.string()),
    mapa_taxonomia: z.string().describe("Relación entre términos y taxonomía."),
    criterio_aplicado: z.string().describe("Lógica o patrón detectado."),
    posibles_ambiguedades: z.string().describe("Menciona si hubo dudas o términos confusos.")
  }),
  needs_review: z.boolean(),
});
export type SemanticAnalysisOutput = z.infer<typeof SemanticAnalysisOutputSchema>;

const semanticPrompt = ai.definePrompt({
  name: 'semanticPrompt',
  input: {schema: SemanticAnalysisInputSchema},
  output: {schema: SemanticAnalysisOutputSchema},
  prompt: `Eres un Arquitecto de IA y Auditor Forense Senior especializado en Control de Cambios de Walmart. 
Tu misión es clasificar registros OC/OT con trazabilidad absoluta y explicabilidad técnica.

REGLAS DE CLASIFICACIÓN FORENSE:
1. EXPLICABILIDAD: No solo elijas una categoría. Explica qué elementos del texto activaron la decisión en 'rationale_tecnico'.
2. TRAZABILIDAD: Lista los términos exactos encontrados que coinciden con la taxonomía en 'evidence_terms'.
3. ESTANDARIZACIÓN: Genera una 'standardizedDescription' que resuma de forma técnica y profesional lo que se realizará.
4. AMBIGÜEDAD: Si el texto es vago (ej. "ajustes varios", "extra", "trabajos"), clasifica como "Indefinida", pon confianza < 0.6 y detalla la ambigüedad.
5. TAXONOMÍA: 
   - Disciplina -> Causa -> Subcausa -> Detalle Nivel 3.
   - Si no puedes llegar al Nivel 3, pon "No determinado".

CATÁLOGO DE REFERENCIA (DISCIPLINAS):
{{#each contexto.disciplinasVigentes}}
- {{{this}}}
{{/each}}

CATÁLOGO DE REFERENCIA (CAUSAS RAÍZ):
{{#each contexto.causasVigentes}}
- {{{this}}}
{{/each}}

DESCRIPCIÓN PARA ANALIZAR:
"""
{{{descripcion}}}
"""

RESPONDE ÚNICAMENTE EN JSON VÁLIDO.`,
});

export async function analyzeOrderSemantically(input: SemanticAnalysisInput): Promise<SemanticAnalysisOutput> {
  const {output} = await semanticPrompt(input);
  if (!output) throw new Error("Fallo en la generación del análisis semántico forense.");
  
  const needsReview = output.confidence_score < 0.75 || output.disciplina_normalizada === 'Indefinida';
  
  return {
    ...output,
    descripcion_original: input.descripcion,
    needs_review: needsReview
  };
}
