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
    frecuencia: z.number()
  })).describe("Resumen agregado de las causas raíz de mayor impacto."),
  totalImpact: z.number().optional().describe("Impacto económico total del universo filtrado."),
  totalOrders: z.number().optional().describe("Volumen total de órdenes analizadas.")
});
export type WordCloudInput = z.infer<typeof WordCloudInputSchema>;

const WordCloudOutputSchema = z.object({
  executiveDiagnosis: z.string().describe("Análisis de la IA sobre la nube de palabras y el modelo 80/20."),
  coreProblem: z.string().describe("Identificación del factor principal que afecta la productividad."),
  concentrationPercentage: z.number().describe("Porcentaje de impacto concentrado en los top 5 conceptos."),
  strategicRecommendations: z.array(z.string()).describe("Acciones prioritarias basadas en la visualización."),
  concepts: z.array(WordConceptSchema).optional().describe("Conceptos refinados por la IA si es necesario.")
});
export type WordCloudOutput = z.infer<typeof WordCloudOutputSchema>;

const wordCloudPrompt = ai.definePrompt({
  name: 'wordCloudPrompt',
  input: {schema: WordCloudInputSchema},
  output: {schema: WordCloudOutputSchema},
  prompt: `Eres un Arquitecto de Inteligencia de Negocios Senior en Walmart Real Estate.
Tu misión es analizar un RESUMEN AGREGADO de causas raíz para generar un Diagnóstico Ejecutivo 80/20 de alto nivel.

CONTEXTO GLOBAL:
- Impacto Total Auditado: \${{{totalImpact}}}
- Volumen de Órdenes Analizadas: {{{totalOrders}}}

DATOS AGREGADOS (TOP CAUSAS POR IMPACTO):
{{#each groups}}
- Disciplina/Causa: {{{disciplina}}} | Impacto: \${{{impactoTotal}}} | Frecuencia: {{{frecuencia}}}
{{/each}}

TAREAS DE RAZONAMIENTO ESTRATÉGICO:
1. ANÁLISIS 80/20: Identifica el grupo crítico de causas que concentran la mayor erosión del presupuesto de construcción.
2. DIAGNÓSTICO EJECUTIVO: Explica de forma sobria y técnica por qué estos términos dominan la red de desviaciones.
3. NÚCLEO DEL PROBLEMA: Define en una frase contundente el driver principal del gasto.
4. RECOMENDACIONES: Propón 3 acciones estratégicas para mitigar el riesgo en las causas dominantes.

Responde con precisión ejecutiva orientada a la Vicepresidencia. No utilices tecnicismos innecesarios.`,
});

export async function analyzeWordCloud(input: WordCloudInput): Promise<WordCloudOutput> {
  const {output} = await wordCloudPrompt(input);
  if (!output) throw new Error("Fallo al generar inteligencia semántica de nube.");
  return {
    ...output,
    concepts: output.concepts || []
  };
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
