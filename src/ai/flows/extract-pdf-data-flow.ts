
'use server';
/**
 * @fileOverview Extractor de datos de ultra-precisión para formatos oficiales de OC/OT de Walmart.
 * 
 * Captura la anatomía completa del documento, con especial énfasis en la línea de tiempo,
 * la presencia de firmas oficiales y fragmentos de evidencia textual.
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
      type: z.string().describe("Tipo de Orden (Trabajo/Cambio/Informativa/Rediseño)."),
      orderNumber: z.string().describe("No. de Orden."),
      issuingArea: z.string().describe("Área emisora."),
      projectStage: z.string().describe("Etapa del proyecto."),
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
      format: z.string().describe("Formato (ej. Supercenter, Sam's Club)."),
      proto: z.string().describe("Prototipo (Proto)."),
      requestingArea: z.string().describe("Área solicitante."),
      rootCauseDeclared: z.string().describe("Causa Raíz declarada en el formato."),
      executionType: z.string().describe("Tipo de ejecución (Normal/Urgente).")
    }),
    financialImpact: z.object({
      netImpact: z.number().describe("Monto total de la orden (Impacto Neto)."),
      accumulatedAmount: z.number().optional().describe("Monto acumulado reportado.")
    }),
    evidenceFragments: z.array(z.object({
      text: z.string().describe("Texto exacto extraído del documento."),
      page: z.string().describe("Página donde se encuentra el fragmento."),
      section: z.string().describe("Sección o recuadro del formato.")
    })),
    descriptionSection: z.object({
      description: z.string().describe("Texto íntegro de '¿Qué se realizará?'."),
      modifications: z.string().optional().describe("Planos o Documentos a Modificar.")
    }),
    authorizations: z.array(z.object({
      cargo: z.string(),
      area: z.string(),
      name: z.string(),
      authDate: z.string().optional(),
      hasSignature: z.boolean().describe("Detección visual de firma en el documento.")
    })),
    isSigned: z.boolean().describe("Indica si el documento tiene firmas visibles en la sección de autorización.")
  }),
  metadata: z.object({
    processedAt: z.string(),
    modelVersion: z.string(),
    extractionConfidence: z.number(),
    missingFields: z.array(z.string()).describe("Lista de campos obligatorios no encontrados en el PDF.")
  })
});
export type ExtractPdfDataOutput = z.infer<typeof ExtractPdfDataOutputSchema>;

const extractPdfPrompt = ai.definePrompt({
  name: 'extractPdfPrompt',
  input: {schema: ExtractPdfDataInputSchema},
  output: {schema: ExtractPdfDataOutputSchema},
  prompt: `Eres un Auditor Senior de Desarrollo Inmobiliario en Walmart. Tu tarea es analizar el PDF adjunto de una OC/OT y extraer la información técnica con precisión forense.

REGLAS CRÍTICAS:
1. FIRMAS: Revisa cuidadosamente la sección "FIRMA DE ACUERDO A LÍMITES DE AUTORIZACIÓN". Si los campos de firma están en blanco, establece 'isSigned' como false. No asumas firmas por nombres impresos.
2. MONTOS: Busca el "Impacto Neto" y "Monto Acumulado".
3. LÍNEA DE TIEMPO: Extrae todas las fechas. Si no hay una fecha explícita, regístrala como omitida.
4. EVIDENCIA: Captura fragmentos textuales literales que justifiquen la causa raíz.

DOCUMENTO: {{media url=pdfDataUri}}`,
});

export async function extractPdfData(input: ExtractPdfDataInput): Promise<ExtractPdfDataOutput> {
  const {output} = await extractPdfPrompt(input);
  if (!output) throw new Error("Fallo en la extracción de datos del PDF.");
  return output;
}
