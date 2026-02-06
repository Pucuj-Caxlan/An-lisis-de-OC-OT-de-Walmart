'use server';
/**
 * @fileOverview Extractor de datos de ultra-precisión para formatos oficiales de OC/OT de Walmart.
 * 
 * Captura la anatomía completa del documento: Información General, Descripción, 
 * Áreas a cargo, Anticorrupción, Impacto Financiero y Firmas de Autorización.
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
      projectStage: z.string().describe("Etapa del proyecto (ej. En construcción)."),
      requestDate: z.string().describe("Fecha de solicitud.")
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
    orderClassification: z.object({
      isOriginal: z.boolean(),
      isComplementary: z.boolean(),
      originalOrderRef: z.string().optional().describe("No. de la orden original referenciada.")
    }),
    descriptionSection: z.object({
      description: z.string().describe("Texto íntegro de '¿Qué se realizará?'."),
      modifications: z.string().optional().describe("Planos o Documentos a Modificar.")
    }),
    associates: z.array(z.object({
      area: z.string(),
      name: z.string(),
      timestamp: z.string().optional(),
      hasSignature: z.boolean().describe("Detección visual de firma o sello digital.")
    })).describe("Sección ÁREAS INCLUIDAS EN LA ORDEN / ASOCIADO A CARGO."),
    antiCorruption: z.object({
      appendixF: z.boolean().describe("Incluye Apéndice F (SÍ/NO)."),
      isDonation: z.boolean().optional(),
      isVoluntary: z.boolean().optional(),
      isImprovement: z.boolean().optional(),
      redFlagsChecked: z.boolean().describe("Detección visual del check en el recuadro de Red Flags.")
    }),
    financialImpact: z.object({
      netImpact: z.number().describe("Monto del Impacto Neto de esta solicitud."),
      accumulatedAmount: z.number().describe("Monto Acumulado total informado."),
      originalImpactAmount: z.number().optional(),
      complementaryImpacts: z.array(z.number()).optional(),
      deliveryDateBefore: z.string().optional().describe("Fecha G.O. / Entrega antes del cambio."),
      impactDaysDesign: z.string().optional(),
      impactDaysExecution: z.string().optional()
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
Tu tarea es analizar el PDF adjunto y extraer CADA CAMPO con precisión técnica.

REGLAS DE ORO:
1. IDENTIFICACIÓN: El Folio/PID (ej. 124634-000) y el No. de Orden son obligatorios.
2. ANTICORRUPCIÓN: Observa cuidadosamente el recuadro de 'Red Flags' al final del formato. Si tiene una 'X', un 'check' o una marca visual, marca 'redFlagsChecked' como true. Haz lo mismo para 'Apéndice F'.
3. FIRMAS: Analiza las secciones de 'Asociado a Cargo' y 'Límites de Autorización'. Si detectas trazos de firmas manuscritas o sellos de DocuSign (como el ID de sobre en la parte superior), marca 'hasSignature' para ese registro y setea 'isSigned' en true.
4. FINANZAS: Extrae el 'Impacto Neto' y el 'Monto Acumulado'. Si el formato indica montos de órdenes complementarias, lístalos.
5. DESCRIPCIÓN: Captura la descripción completa. Si menciona planos específicos (ej. Plano de acometida), regístralo en 'modifications'.

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
