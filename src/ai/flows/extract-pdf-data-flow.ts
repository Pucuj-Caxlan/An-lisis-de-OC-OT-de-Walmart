'use server';
/**
 * @fileOverview Extrae datos estructurados de documentos PDF de OC/OT de Walmart con alta precisión semántica.
 * 
 * Basado en el formato oficial: Det, Folio/PID, Nombre proyecto, Formato, Causa Raíz, 
 * Impacto del Cambio, Anticorrupción (Apéndice F).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractPdfDataInputSchema = z.object({
  pdfDataUri: z.string().describe("El PDF de la OC/OT como data URI Base64."),
});
export type ExtractPdfDataInput = z.infer<typeof ExtractPdfDataInputSchema>;

const ExtractPdfDataOutputSchema = z.object({
  extractedData: z.object({
    projectId: z.string().describe("Folio/PID (ej. 126393-000)."),
    det: z.string().optional().describe("Campo 'Det' del encabezado."),
    projectName: z.string().describe("Nombre del proyecto (ej. Ex Hacienda de Torreon)."),
    orderNumber: z.string().describe("No de Orden (ej. 4.0)."),
    type: z.string().describe("Tipo de documento: ORDEN DE TRABAJO, ORDEN DE CAMBIO, etc."),
    projectStage: z.string().optional().describe("Etapa del proyecto (ej. Previo a construcción)."),
    requestDate: z.string().optional().describe("Fecha de solicitud (ej. 03/septiembre/2025)."),
    format: z.string().describe("Formato de tienda (ej. Supercenter)."),
    proto: z.string().optional().describe("Prototipo (ej. 90 SD)."),
    areaSolicitante: z.string().describe("Área solicitante."),
    causaRaiz: z.string().describe("Causa raíz declarada en el formato."),
    executionType: z.string().optional().describe("Tipo de ejecución (Normal/Urgente)."),
    descriptionOriginal: z.string().describe("Descripción original del campo '¿Qué se realizará?'."),
    docsToModify: z.string().optional().describe("Planos o Documentos a Modificar."),
    impactAmount: z.number().describe("Monto del Impacto Neto de esta solicitud."),
    accumulatedAmount: z.number().optional().describe("Monto Acumulado total."),
    appendixF: z.boolean().describe("¿Incluye Apéndice F?"),
    redFlagsVerified: z.boolean().describe("¿Se verificó que no existe riesgo en Red Flags? (Checkmark en el formato)."),
    standardizedDescription: z.string().describe("Descripción siguiendo la plantilla: Qué / Por qué / Dónde / Especialidad / Documentos / Impacto / Riesgo / Referencias."),
    lineItems: z.array(z.object({
      areaEjerce: z.string(),
      areaGenera: z.string(),
      descripcion: z.string(),
      importe: z.number()
    })).describe("Tabla de desgloses de la sección ÁREAS INCLUIDAS EN LA ORDEN."),
    qcAnalysis: z.array(z.object({
      flag: z.string(),
      severity: z.enum(['High', 'Med', 'Low']),
      message: z.string()
    }))
  }),
  confidence: z.number().describe("Confianza general de la extracción (0-1).")
});
export type ExtractPdfDataOutput = z.infer<typeof ExtractPdfDataOutputSchema>;

const extractPdfPrompt = ai.definePrompt({
  name: 'extractPdfPrompt',
  input: {schema: ExtractPdfDataInputSchema},
  output: {schema: ExtractPdfDataOutputSchema},
  prompt: `Eres un experto en auditoría técnica de Walmart (Desarrollo Inmobiliario). 
  Analiza el PDF adjunto que corresponde a un formato de ORDEN DE TRABAJO o CAMBIO.
  
  EXTRACCIÓN DE DATOS:
  - Localiza el Folio/PID, el Det y el No de Orden en la parte superior.
  - En 'IMPACTO DEL CAMBIO', extrae el 'Impacto Neto' y el 'Monto Acumulado'.
  - En 'ANTICORRUPCIÓN', verifica si el Apéndice F tiene marcado 'SÍ' o 'NO'.
  - Verifica si el recuadro de 'Red Flags' tiene la marca de verificación (X o check).
  - Extrae la descripción literal de '¿Qué se realizará?' y 'Planos o Documentos a Modificar'.

  NORMALIZACIÓN:
  - Genera una 'Descripción Estandarizada' estructurada: 
    [QUÉ]: ... / [POR QUÉ]: ... / [DÓNDE]: ... / [IMPACTO]: ... / [RIESGO]: ...
  
  CONTROL DE CALIDAD (QC):
  - Marca severidad 'High' si el PID no es legible.
  - Marca severidad 'Med' si la descripción no justifica claramente la Causa Raíz.
  - Marca severidad 'High' si se detectan Red Flags sin el Apéndice F correspondiente.

  Documento PDF: {{media url=pdfDataUri}}`,
});

/**
 * Llama al flujo de extracción de datos del PDF.
 * @param input - Objeto con el data URI del PDF.
 * @returns El resultado de la extracción.
 */
export async function extractPdfData(input: ExtractPdfDataInput): Promise<ExtractPdfDataOutput> {
  return extractPdfDataFlow(input);
}

const extractPdfDataFlow = ai.defineFlow(
  {
    name: 'extractPdfDataFlow',
    inputSchema: ExtractPdfDataInputSchema,
    outputSchema: ExtractPdfDataOutputSchema,
  },
  async input => {
    const {output} = await extractPdfPrompt(input);
    if (!output) throw new Error("No se pudo extraer información del PDF.");
    return output;
  }
);
