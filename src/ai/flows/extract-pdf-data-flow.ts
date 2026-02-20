
'use server';
/**
 * @fileOverview Extractor de datos de ultra-precisión para formatos oficiales de OC/OT de Walmart.
 * 
 * Captura la anatomía completa del documento, con especial énfasis en la línea de tiempo
 * y fragmentos de evidencia textual para trazabilidad forense.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractPdfDataInputSchema = z.object({
  pdfDataUri: z.string().describe("El PDF de la OC/OT como data URI Base64."),
});
export type ExtractPdfDataInput = z.infer<typeof ExtractPdfDataInputSchema>;

const ExtractPdfDataOutputSchema = z.object({
  extractedData: z.object({
    envelopeId: z.string().optional().describe("ID de sobre de DocuSign si está presente."),
    header: z.object({
      type: z.string().describe("Tipo de Orden (Trabajo/Cambio/Informativa/Rediseño/Rediseño)."),
      orderNumber: z.string().describe("No. de Orden."),
      issuingArea: z.string().describe("Área emisora."),
      projectStage: z.string().describe("Etapa del proyecto (ej. En construcción)."),
      requestDate: z.string().describe("Fecha de solicitud.")
    }),
    dates: z.object({
      detectionDate: z.string().optional().describe("Fecha en que se detectó la necesidad del cambio."),
      requestDate: z.string().describe("Fecha oficial de la solicitud."),
      approvalDate: z.string().optional().describe("Fecha de aprobación final."),
      executionDate: z.string().optional().describe("Fecha programada o real de ejecución."),
      closingDate: z.string().optional().describe("Fecha de cierre administrativo.")
    }),
    projectInfo: z.object({
      det: z.string().describe("Detalle (Det)."),
      projectId: z.string().describe("Folio/PID del proyecto."),
      projectName: z.string().describe("Nombre del proyecto."),
      unitName: z.string().optional().describe("Nombre de la unidad."),
      format: z.string().describe("Formato (ej. Sams Club)."),
      proto: z.string().describe("Prototipo (Proto)."),
      requestingArea: z.string().describe("Área solicitante."),
      rootCauseDeclared: z.string().describe("Causa Raíz declarada en el formato."),
      executionType: z.string().describe("Tipo de ejecución (Normal/Urgente).")
    }),
    evidenceFragments: z.array(z.object({
      text: z.string().describe("Texto exacto extraído del documento."),
      page: z.string().describe("Página donde se encuentra el fragmento."),
      section: z.string().describe("Sección o recuadro del formato (ej. Descripción, Anticorrupción, Firmas).")
    })).describe("Fragmentos clave que sustentan la trazabilidad forense."),
    descriptionSection: z.object({
      description: z.string().describe("Texto íntegro de '¿Qué se realizará?'."),
      modifications: z.string().optional().describe("Planos o Documentos a Modificar.")
    }),
    authorizations: z.array(z.object({
      cargo: z.string(),
      area: z.string(),
      name: z.string(),
      authDate: z.string().optional(),
      hasSignature: z.boolean().describe("Detección visual de firma en la sección de límites de autorización.")
    })),
    isSigned: z.boolean().describe("Flag general que indica si el documento tiene firmas visibles.")
  }),
  confidence: z.number().describe("Confianza del OCR semántico (0.0 a 1.0).")
});
export type ExtractPdfDataOutput = z.infer<typeof ExtractPdfDataOutputSchema>;

const extractPdfPrompt = ai.definePrompt({
  name: 'extractPdfPrompt',
  input: {schema: ExtractPdfDataInputSchema},
  output: {schema: ExtractPdfDataOutputSchema},
  prompt: `Eres un Auditor Senior de Desarrollo Inmobiliario en Walmart especializado en Control de Cambios. 
Tu tarea es analizar el PDF adjunto y extraer CADA CAMPO con precisión técnica, construyendo la línea de tiempo y extrayendo evidencia textual.

REGLAS DE ORO:
1. LÍNEA DE TIEMPO: Busca fechas de detección, solicitud, aprobación y ejecución. Si no son explícitas, infiérelas de los sellos o firmas.
2. EVIDENCIA TEXTUAL: Extrae fragmentos exactos que justifiquen la causa raíz. Si dice "Se requiere por cambio en normativa de CFE", ese es un fragmento de evidencia clave.
3. FIRMAS Y SELLOS: Busca el ID de sobre de DocuSign y las firmas manuscritas.
4. FINANZAS: Extrae montos netos y acumulados.

DOCUMENTO: {{media url=pdfDataUri}}`,
});

export async function extractPdfData(input: ExtractPdfDataInput): Promise<ExtractPdfDataOutput> {
  const {output} = await extractPdfPrompt(input);
  if (!output) throw new Error("Fallo en la extracción de datos del PDF.");
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
