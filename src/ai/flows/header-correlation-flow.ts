
'use server';
/**
 * @fileOverview Motor de Correlación de Encabezados Inteligente (Header Intelligence Engine).
 * 
 * Analiza semánticamente los encabezados de archivos Excel históricos para mapearlos
 * a la estructura canónica de la base de datos institucional.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const HeaderMappingSchema = z.object({
  excelHeader: z.string(),
  canonicalField: z.string(),
  dataType: z.enum(['string', 'number', 'date', 'boolean', 'array']),
  confidence: z.number().describe("Nivel de certeza de la correlación (0-1)."),
  reasoning: z.string().optional()
});

const HeaderCorrelationInputSchema = z.object({
  headers: z.array(z.string()).describe("Lista de encabezados detectados en el archivo Excel."),
  canonicalSchema: z.array(z.string()).describe("Lista de campos destino en la base de datos."),
});
export type HeaderCorrelationInput = z.infer<typeof HeaderCorrelationInputSchema>;

const HeaderCorrelationOutputSchema = z.object({
  mappings: z.array(HeaderMappingSchema),
  overallConfidence: z.number(),
  missingCriticalFields: z.array(z.string()).describe("Campos obligatorios que no se encontraron en el Excel.")
});
export type HeaderCorrelationOutput = z.infer<typeof HeaderCorrelationOutputSchema>;

const headerPrompt = ai.definePrompt({
  name: 'headerPrompt',
  input: {schema: HeaderCorrelationInputSchema},
  output: {schema: HeaderCorrelationOutputSchema},
  prompt: `Eres un Arquitecto de Datos Forense Senior en Walmart. 
Tu misión es correlacionar los encabezados de un Excel histórico con nuestro esquema canónico institucional.

LISTA DE ENCABEZADOS EXCEL:
{{#each headers}}
- {{{this}}}
{{/each}}

ESQUEMA CANÓNICO DESTINO (DB):
{{#each canonicalSchema}}
- {{{this}}}
{{/each}}

INSTRUCCIONES DE CORRELACIÓN:
1. SEMÁNTICA: No busques coincidencia exacta. "PID", "ID Tririga", "Folio Proyecto" mapean a "projectId". "Monto Neto", "Importe", "Total" mapean a "impactoNeto".
2. INFERENCIA: Si ves "OT", "OC", "OCR", la columna mapea a "type". 
3. CALIDAD: Si el encabezado es ambiguo (ej. "Columna 1", "Dato"), asigna confianza baja.
4. CRÍTICOS: Identifica si faltan campos vitales para el análisis 80/20 (projectId, impactoNeto, fechaSolicitud, causaRaiz).

Responde únicamente con el mapeo estructurado JSON.`,
});

export async function correlateHeaders(input: HeaderCorrelationInput): Promise<HeaderCorrelationOutput> {
  const {output} = await headerPrompt(input);
  if (!output) throw new Error("Fallo en la correlación de encabezados.");
  return output;
}

const headerCorrelationFlow = ai.defineFlow(
  {
    name: 'headerCorrelationFlow',
    inputSchema: HeaderCorrelationInputSchema,
    outputSchema: HeaderCorrelationOutputSchema,
  },
  async input => {
    return correlateHeaders(input);
  }
);
