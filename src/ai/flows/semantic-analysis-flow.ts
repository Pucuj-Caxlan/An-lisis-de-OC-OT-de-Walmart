
'use server';
/**
 * @fileOverview Motor de Inteligencia Semántica Avanzada para Clasificación Automática de OC/OT.
 * 
 * Realiza una clasificación híbrida con explicabilidad y trazabilidad forense.
 * Incluye una Matriz de Coherencia para evitar incongruencias entre Disciplina y Sub-causa.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticAnalysisInputSchema = z.object({
  descripcion: z.string().describe("Texto libre de la descripción de la causa raíz de la OC/OT."),
  monto: z.number().optional(),
  contexto: z.object({
    disciplinasVigentes: z.array(z.string()).optional(),
    causasVigentes: z.array(z.string()).optional(),
    justificacionDetallada: z.string().optional()
  }).optional(),
});
export type SemanticAnalysisInput = z.infer<typeof SemanticAnalysisInputSchema>;

const SemanticAnalysisOutputSchema = z.object({
  disciplina_normalizada: z.string().describe("Disciplina técnica detectada (ej. Eléctrica, Civil, Estructura)."),
  causa_raiz_normalizada: z.string().describe("Causa raíz normalizada según catálogo oficial de Walmart."),
  subcausa_normalizada: z.string().describe("Subcategoría técnica específica detectada (Nivel 3)."),
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
Tu misión es clasificar registros OC/OT con trazabilidad absoluta y asegurar la CONGRUENCIA TOTAL entre Disciplina y Causa Raíz.

REGLAS DE DISCIPLINAS OFICIALES (CRÍTICO):
Debes usar EXCLUSIVAMENTE estos términos para 'disciplina_normalizada':
- CIVIL
- ESTRUCTURA
- ARQUITECTURA
- ELÉCTRICA
- HIDRÁULICA
- MECÁNICA
- AMBIENTAL
- INGENIERÍA
- EQUIPAMIENTO
- GESTIÓN Y ADMON

CATÁLOGO MAESTRO DE CAUSAS RAÍZ (OBLIGATORIO):
Debes elegir EXACTAMENTE una de estas 10 categorías para 'causa_raiz_normalizada':
1. ALTA DE ALCANCE EN PLAN: Solicitud de trabajos adicionales a proveedores previos.
2. ERRORES / OMISIONES: Falta de CI, criterio, prototipo o normativa.
3. SOLICITUD DE CUMPLIMIENTO / AUTORIDAD: Modificaciones ambientales, viales o de autoridad.
4. ACTUALIZACIÓN DE PROTOTIPO: Implementación de CI o versión vigente de prototipo.
5. INICIATIVAS ESTRATÉGICAS Y ADICIONES A SCOPE FUERA DE PROTOTIPO: Self-checkout, pickup, etc.
6. ALCANCE CONOCIDO NO ASIGNADO POR CONCURSOS: Omisiones de Wal-Mart en alcances de contratista.
7. IMPREVISTOS POR SINIESTRO: Inundaciones, derrumbes, desastres naturales.
8. HALLAZGOS / IMPREVISTOS EN SITIO DURANTE PROCESO DE CONSTRUCCIÓN: Roca, nivel freático, cimentaciones ocultas, INAH.
9. REQUERIMIENTO DE PROCESOS CONSTRUCTIVOS: Sobre excavaciones, protección colindancias, tapiales.
10. CAMBIO DE NEGOCIACIÓN: Confinamiento estacionamiento, Co-Tenancy, acuerdos oferente.

MATRIZ DE COHERENCIA TÉCNICA (OBLIGATORIO):
Asegúrate de que la 'subcausa_normalizada' sea un hijo lógico de la 'disciplina_normalizada'.
- Si detectas "MODIFICACIÓN AMBIENTAL", "MIA", "PROFEPA" o "FORESTAL", la disciplina DEBE ser AMBIENTAL.
- Si detectas "ROCA", "NIVEL FREÁTICO", "EXCAVACIÓN" o "CIMENTACIÓN", la disciplina DEBE ser CIVIL o ESTRUCTURA.
- Si detectas "TABLERO", "UVIE", "LUMINARIA" o "CABLEADO", la disciplina DEBE ser ELÉCTRICA.

DESCRIPCIÓN PARA ANALIZAR:
"""
{{{descripcion}}}
"""

RESPONDE ÚNICAMENTE EN JSON VÁLIDO. UTILIZA LOS NOMBRES EXACTOS DEL CATÁLOGO.`,
});

export async function analyzeOrderSemantically(input: SemanticAnalysisInput): Promise<SemanticAnalysisOutput> {
  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const {output} = await semanticPrompt(input);
      if (!output) throw new Error("Fallo en la generación del análisis semántico forense.");
      
      const needsReview = output.confidence_score < 0.75 || output.subcausa_normalizada.toUpperCase().includes('SIN CLASIFICAR');
      
      return {
        ...output,
        descripcion_original: input.descripcion,
        needs_review: needsReview
      };
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || "";
      const isRetryable = errorMsg.includes('503') || errorMsg.includes('429') || errorMsg.includes('Service Unavailable') || errorMsg.includes('overloaded');
      
      if (isRetryable && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }
  
  throw lastError || new Error("Error crítico en el motor Gemini tras múltiples intentos.");
}

const semanticAnalysisFlow = ai.defineFlow(
  {
    name: 'semanticAnalysisFlow',
    inputSchema: SemanticAnalysisInputSchema,
    outputSchema: SemanticAnalysisOutputSchema,
  },
  async input => {
    return analyzeOrderSemantically(input);
  }
);
