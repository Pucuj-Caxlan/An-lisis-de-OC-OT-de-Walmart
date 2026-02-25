'use server';
/**
 * @fileOverview Extractor de datos de ultra-precisión para formatos oficiales de OC/OT de Walmart.
 * 
 * Captura la anatomía completa del documento (7 páginas), incluyendo la bitácora histórica,
 * justificaciones técnicas, red flags y metadatos de DocuSign.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const HistoricalLogEntrySchema = z.object({
  orderNumber: z.string(),
  type: z.string(),
  rootCause: z.string(),
  exercisingArea: z.string(),
  amount: z.number(),
  status: z.string(),
  date: z.string()
});

const ExtractPdfDataInputSchema = z.object({
  pdfDataUri: z.string().describe("El PDF de la OC/OT como data URI Base64."),
});
export type ExtractPdfDataInput = z.infer<typeof ExtractPdfDataInputSchema>;

const ExtractPdfDataOutputSchema = z.object({
  extractedData: z.object({
    envelopeId: z.string().optional().describe("ID de sobre de DocuSign (Envelope ID)."),
    header: z.object({
      type: z.string().describe("Tipo de Orden (Trabajo/Cambio/Informativa/Rediseño)."),
      orderNumber: z.string().describe("No. de Orden."),
      issuingArea: z.string().describe("Área emisora."),
      projectStage: z.string().describe("Etapa del proyecto (ej. En construcción)."),
      requestDate: z.string().describe("Fecha de solicitud.")
    }),
    projectInfo: z.object({
      projectId: z.string().describe("Folio/PID del proyecto."),
      projectName: z.string().describe("Nombre del proyecto."),
      format: z.string().describe("Formato (Sams Club, Supercenter, etc.)."),
      proto: z.string().describe("Prototipo."),
      requestingArea: z.string().describe("Área solicitante."),
      rootCauseDeclared: z.string().describe("Causa Raíz declarada."),
      executionType: z.string().describe("Tipo de ejecución (Normal/Urgente).")
    }),
    financialImpact: z.object({
      netImpact: z.number().describe("Monto total de la orden (Impacto Neto)."),
      accumulatedAmount: z.number().describe("Monto acumulado reportado en el formato.")
    }),
    technicalJustification: z.object({
      description: z.string().describe("Descripción de '¿Qué se realizará?'."),
      detailedReasoning: z.string().optional().describe("Justificación técnica de la carta compromiso."),
      scope: z.string().optional().describe("Alcance detallado del proyecto.")
    }),
    governance: z.object({
      redFlagsDetected: z.array(z.string()).describe("Lista de Red Flags marcadas en el documento."),
      isSigned: z.boolean(),
      appendixF: z.boolean()
    }),
    historicalLog: z.array(HistoricalLogEntrySchema).optional().describe("Bitácora histórica de OTs y OCs extraída de la última página."),
    authorizations: z.array(z.object({
      cargo: z.string(),
      area: z.string(),
      name: z.string(),
      timestamp: z.string().optional().describe("Timestamp de firma DocuSign."),
      hasSignature: z.boolean()
    }))
  }),
  metadata: z.object({
    processedAt: z.string(),
    modelVersion: z.string(),
    extractionConfidence: z.number(),
    pagesAnalyzed: z.number()
  })
});
export type ExtractPdfDataOutput = z.infer<typeof ExtractPdfDataOutputSchema>;

const extractPdfPrompt = ai.definePrompt({
  name: 'extractPdfPrompt',
  input: {schema: ExtractPdfDataInputSchema},
  output: {schema: ExtractPdfDataOutputSchema},
  prompt: `Eres un Auditor Forense Senior de Desarrollo Inmobiliario en Walmart. Tu tarea es analizar integralmente TODAS las páginas de este PDF de OC/OT.

REGLAS DE EXTRACCIÓN POR PÁGINA:
1. PÁGINA 1 (GENERAL): Extrae el Envelope ID de DocuSign (arriba a la izquierda), No. de Orden, PID, Monto Neto y Causa Raíz.
2. PÁGINA 2-3 (CONTROL): Busca áreas generadoras, firmas con timestamps y el listado de Red Flags. Si una casilla de Red Flag está marcada, inclúyela.
3. PÁGINA 5-6 (CARTA COMPROMISO): Extrae la narrativa técnica detallada y el alcance. Esto es vital para el 'detailedReasoning'.
4. PÁGINA 7 (BITÁCORA): Extrae la tabla de historial acumulado. Necesitamos saber qué otras órdenes ha tenido este PID.

CRITERIOS DE PRECISIÓN:
- Envelope ID: Debe ser el formato C419B5CC-...
- Montos: Impacto Neto vs Monto Acumulado.
- Firmas: No asumas firma si solo está el nombre; busca el trazo o el sello DocuSign.

DOCUMENTO: {{media url=pdfDataUri}}`,
});

export async function extractPdfData(input: ExtractPdfDataInput): Promise<ExtractPdfDataOutput> {
  const {output} = await extractPdfPrompt(input);
  if (!output) throw new Error("Fallo en la extracción integral del PDF.");
  return output;
}
