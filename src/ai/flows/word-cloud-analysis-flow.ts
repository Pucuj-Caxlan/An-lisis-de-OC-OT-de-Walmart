
'use server';
/**
 * @fileOverview Motor de Análisis Semántico y Ponderación para Nube de Palabras Forense.
 * 
 * Genera un mapa de conceptos ponderados por impacto financiero y recurrencia,
 * proporcionando una interpretación estratégica basada en el modelo 80/20.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const WordConceptSchema = z.object({
  text: z.string().describe("El concepto, disciplina o causa raíz."),
  weight: z.number().describe("Peso calculado (0-100) basado en impacto y frecuencia."),
  impact: z.number().describe("Monto económico total asociado."),
  frequency: z.number().describe("Número de veces que aparece el concepto."),
  sentiment: z.enum(['Crítico', 'Riesgo', 'Estable']).describe("Nivel de alerta del concepto."),
  category: z.enum(['Disciplina', 'Causa Raíz', 'Concepto Técnico']),
  trend: z.string().describe("Dirección del impacto (Creciente/Estable/Decreciente).")
});

const WordCloudInputSchema = z.object({
  groups: z.array(z.object({
    disciplina: z.string(),
    causa: z.string(),
    impactoTotal: z.number(),
    frecuencia: z.number(),
    descripcionesMuestra: z.string().optional()
  })).describe("Datos agregados para análisis semántico masivo representativo"),
});
export type WordCloudInput = z.infer<typeof WordCloudInputSchema>;

const WordCloudOutputSchema = z.object({
  concepts: z.array(WordConceptSchema),
  executiveDiagnosis: z.string().describe("Análisis de la IA sobre la nube de palabras y el modelo 80/20."),
  coreProblem: z.string().describe("Identificación del factor principal que afecta la productividad."),
  concentrationPercentage: z.number().describe("Porcentaje de impacto concentrado en los top 5 conceptos."),
  strategicRecommendations: z.array(z.string()).describe("Acciones prioritarias basadas en la visualización.")
});
export type WordCloudOutput = z.infer<typeof WordCloudOutputSchema>;

const wordCloudPrompt = ai.definePrompt({
  name: 'wordCloudPrompt',
  input: {schema: WordCloudInputSchema},
  output: {schema: WordCloudOutputSchema},
  prompt: `Eres un Arquitecto de Inteligencia de Negocios Senior en Walmart Real Estate.
Tu misión es transformar datos agregados en una Nube de Conceptos Estratégicos que represente el 100% de la base de datos.

DATOS AGREGADOS (UNIVERSO COMPLETO):
{{#each groups}}
- Grupo: {{{disciplina}}} | Causa: {{{causa}}} | Impacto Total: \${{{impactoTotal}}} | Frecuencia: {{{frecuencia}}}
  Muestra de descripciones: {{{descripcionesMuestra}}}
{{/each}}

INSTRUCCIONES DE PONDERACIÓN:
1. IDENTIFICACIÓN: Extrae conceptos clave de las disciplinas, causas y descripciones técnicas provistas en las muestras.
2. MODELO MATEMÁTICO: Asigna pesos altos a conceptos que tengan un Impacto Económico acumulado alto (70%) y una Frecuencia alta (30%).
3. CATEGORIZACIÓN: Divide los conceptos en Disciplina, Causa Raíz o Concepto Técnico.
4. ANÁLISIS 80/20: Determina qué conceptos representan el 80% del impacto total basándote en las sumas de los grupos.
5. DIAGNÓSTICO: Explica de forma ejecutiva por qué esos términos dominan la nube y cómo afectan al presupuesto global.

Responde con precisión sobre los montos acumulados por concepto.`,
});

export async function analyzeWordCloud(input: WordCloudInput): Promise<WordCloudOutput> {
  const {output} = await wordCloudPrompt(input);
  if (!output) throw new Error("Fallo al generar inteligencia semántica de nube.");
  return output;
}

const wordCloudAnalysisFlow = ai.defineFlow(
  {
    name: 'wordCloudAnalysisFlow',
    inputSchema: WordCloudInputSchema,
    outputSchema: WordCloudOutputSchema,
  },
  async input => {
    return analyzeWordCloud(input);
  }
);
