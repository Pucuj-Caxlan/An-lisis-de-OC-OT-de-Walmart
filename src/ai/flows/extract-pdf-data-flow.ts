
'use server';
/**
 * @fileOverview Extrae datos estructurados de documentos PDF de OC/OT de Walmart.
 *
 * - extractPdfData - Función que procesa el documento y retorna el esquema canónico.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractPdfDataInputSchema = z.object({
  pdfDataUri: z.string().describe("El PDF de la OC/OT como data URI Base64."),
});
export type ExtractPdfDataInput = z.infer<typeof ExtractPdfDataInputSchema>;

const ExtractPdfDataOutputSchema = z.object({
  extractedData: z.object({
    projectId: z.string().describe("PID o ID Tririga."),
    projectName: z.string().describe("Nombre de la unidad o proyecto."),
    orderNumber: z.string().describe("Número de folio de la OC o OT."),
    type: z.string().describe("Tipo: OC, OT, OCR o OCI."),
    format: z.string().describe("Formato de tienda."),
    impactAmount: z.number().describe("Monto del impacto neto."),
    areaSolicitante: z.string().describe("Área que solicita el cambio."),
    causaRaiz: z.string().describe("Causa raíz declarada en el documento."),
    standardizedDescription: z.string().describe("Descripción siguiendo la plantilla: Qué / Por qué / Dónde / Especialidad / Documentos / Impacto / Riesgo / Referencias."),
    lineItems: z.array(z.object({
      areaEjerce: z.string(),
      areaGenera: z.string(),
      descripcion: z.string(),
      importe: z.number()
    })).describe("Tabla de desgloses de incrementos/ahorros."),
    redFlags: z.object({
      hasRisks: z.boolean(),
      riskScore: z.number().describe("Puntuación de 0 a 100."),
      observations: z.string()
    }),
    qcAnalysis: z.array(z.object({
      flag: z.string(),
      severity: z.enum(['High', 'Med', 'Low']),
      message: z.string()
    }))
  }),
  confidence: z.number().describe("Confianza general de la extracción (0-1).")
});
export type ExtractPdfDataOutput = z.infer<typeof ExtractPdfDataOutputSchema>;

export async function extractPdfData(input: ExtractPdfDataInput): Promise<ExtractPdfDataOutput> {
  return extractPdfDataFlow(input);
}

const extractPdfPrompt = ai.definePrompt({
  name: 'extractPdfPrompt',
  input: {schema: ExtractPdfDataInputSchema},
  output: {schema: ExtractPdfDataOutputSchema},
  prompt: `Eres un experto en auditoría de documentos OC/OT de Walmart. 
  Analiza el siguiente PDF y extrae todos los campos requeridos.
  
  Instrucciones Especiales:
  1. Genera una "Descripción Estandarizada" con esta estructura: 
     Qué se hará / Por qué (causa) / Dónde aplica / Especialidad impactada / Documentos a modificar / Impacto (costo-tiempo) / Riesgo si no se ejecuta / Referencias.
  2. Identifica Red Flags de anticorrupción (Mejoras municipales, donativos, falta de Apéndice F).
  3. Realiza un Control de Calidad (QC): detecta si la descripción es vaga, si el monto total no coincide con el desglose, o si faltan firmas.

  PDF Document: {{media url=pdfDataUri}}`,
});

const extractPdfDataFlow = ai.defineFlow(
  {
    name: 'extractPdfDataFlow',
    inputSchema: ExtractPdfDataInputSchema,
    outputSchema: ExtractPdfDataOutputSchema,
  },
  async input => {
    const {output} = await extractPdfPrompt(input);
    return output!;
  }
);
