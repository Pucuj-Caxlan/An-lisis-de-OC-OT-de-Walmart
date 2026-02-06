'use server';
/**
 * @fileOverview Extractor de datos de alta precisión para documentos PDF de OC/OT de Walmart.
 * 
 * Captura campos clave, montos financieros, fechas de solicitud, validaciones de cumplimiento 
 * y desgloses de partidas con una semántica orientada a la auditoría técnica.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractPdfDataInputSchema = z.object({
  pdfDataUri: z.string().describe("El PDF de la OC/OT como data URI Base64."),
});
export type ExtractPdfDataInput = z.infer<typeof ExtractPdfDataInputSchema>;

const ExtractPdfDataOutputSchema = z.object({
  extractedData: z.object({
    projectId: z.string().describe("Folio o PID del proyecto (ej. 126393-000)."),
    orderNumber: z.string().describe("Número de Orden de Cambio o Trabajo."),
    projectName: z.string().describe("Nombre oficial del proyecto."),
    type: z.string().describe("Tipo de documento (OC, OT, OCI, OCR)."),
    format: z.string().describe("Formato de tienda (Supercenter, Sam's, etc.)."),
    causaRaiz: z.string().describe("Causa raíz declarada literalmente en el formato."),
    areaSolicitante: z.string().describe("Área que solicita el cambio."),
    fechaSolicitud: z.string().optional().describe("Fecha de solicitud encontrada en el documento."),
    descripcionOriginal: z.string().describe("Texto íntegro de la sección '¿Qué se realizará?'."),
    docsToModify: z.string().optional().describe("Planos o documentos mencionados para modificación."),
    impactAmount: z.number().describe("Monto del impacto neto de esta solicitud."),
    accumulatedAmount: z.number().optional().describe("Monto acumulado total hasta la fecha."),
    appendixF: z.boolean().describe("Indica si el Apéndice F está marcado como SÍ."),
    redFlagsVerified: z.boolean().describe("Indica si la sección de Red Flags tiene marca de verificación."),
    standardizedDescription: z.string().describe("Descripción estructurada: QUÉ / POR QUÉ / DÓNDE / IMPACTO / RIESGO."),
    lineItems: z.array(z.object({
      areaEjerce: z.string(),
      areaGenera: z.string(),
      descripcion: z.string(),
      importe: z.number()
    })).describe("Desglose detallado de la tabla de incrementos/ahorros."),
    qcAnalysis: z.array(z.object({
      flag: z.string(),
      severity: z.enum(['High', 'Med', 'Low']),
      message: z.string()
    })).describe("Hallazgos de auditoría y control de calidad sobre el documento.")
  }),
  confidence: z.number().describe("Nivel de confianza de la extracción (0.0 a 1.0).")
});
export type ExtractPdfDataOutput = z.infer<typeof ExtractPdfDataOutputSchema>;

const extractPdfPrompt = ai.definePrompt({
  name: 'extractPdfPrompt',
  input: {schema: ExtractPdfDataInputSchema},
  output: {schema: ExtractPdfDataOutputSchema},
  prompt: `Eres un Auditor Senior de Desarrollo Inmobiliario en Walmart. Tu tarea es procesar el PDF adjunto con precisión quirúrgica.

REGLAS DE EXTRACCIÓN:
1. IDENTIFICACIÓN: Localiza el PID (Folio) y el No. de Orden. Son vitales para el match.
2. FINANZAS: Extrae el 'Impacto Neto' y el 'Monto Acumulado'. Si el acumulado es menor al neto, genera un hallazgo de QC.
3. COMPLIANCE: Verifica visualmente si el Apéndice F y las Red Flags tienen marcas (X, Check).
4. DESGLOSE: Mapea cada fila de la tabla de 'Áreas incluidas en la orden' al objeto lineItems.
5. SEMÁNTICA: Genera una 'Descripción Estandarizada' que resuma el QUÉ, POR QUÉ y el RIESGO de no ejecutarlo.

Documento PDF: {{media url=pdfDataUri}}`,
});

export async function extractPdfData(input: ExtractPdfDataInput): Promise<ExtractPdfDataOutput> {
  const {output} = await extractPdfPrompt(input);
  if (!output) throw new Error("La IA no pudo procesar el contenido del PDF.");
  return output;
}

const extractPdfDataFlow = ai.defineFlow(
  {
    name: 'extractPdfDataFlow',
    inputSchema: ExtractPdfDataInputSchema,
    outputSchema: ExtractPdfDataOutputSchema,
  },
  async input => {
    return extractPdfData(input);
  }
);
