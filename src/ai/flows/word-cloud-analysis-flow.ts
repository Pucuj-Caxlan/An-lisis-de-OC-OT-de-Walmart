
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
  orders: z.array(z.object({
    id: z.string(),
    impactoNeto: z.number(),
    disciplina_normalizada: z.string().optional(),
    causa_raiz_normalizada: z.string().optional(),
    descripcion: z.string(),
    standardizedDescription: z.string().optional(),
    fechaSolicitud: z.string().optional()
  })).describe("Lote de órdenes para análisis semántico masivo"),
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
Tu misión es transformar datos dispersos en una Nube de Conceptos Estratégicos.

DATOS DISPONIBLES:
{{#each orders}}
- PID: {{{id}}} | Monto: \${{{impactoNeto}}} | Disciplina: {{{disciplina_normalizada}}} | Causa: {{{causa_raiz_normalizada}}}
  Desc: {{{descripcion}}} {{#if standardizedDescription}} | IA: {{{standardizedDescription}}} {{/if}}
{{/each}}

INSTRUCCIONES DE PONDERACIÓN:
1. IDENTIFICACIÓN: Extrae conceptos clave de las disciplinas, causas y descripciones técnicas.
2. MODELO MATEMÁTICO: Asigna pesos altos a conceptos que tengan un Impacto Económico alto (70%) y una Frecuencia alta (30%).
3. CATEGORIZACIÓN: Divide los conceptos en Disciplina, Causa Raíz o Concepto Técnico.
4. ANÁLISIS 80/20: Determina qué conceptos representan el 80% del impacto total.
5. DIAGNÓSTICO: Explica de forma ejecutiva por qué esos términos dominan la nube.

Busca términos como "Error de Diseño", "Omisión MEP", "Regulatorio", "Ajuste Prototipo", etc.
Sé preciso en los montos acumulados por palabra.`,
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
