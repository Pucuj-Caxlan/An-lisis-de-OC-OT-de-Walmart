'use server';
/**
 * @fileOverview Motor de Generación de Informes de Trazabilidad Semántica Forense.
 * 
 * Genera un análisis profundo de una incidencia OC/OT reconstruyendo la línea de tiempo,
 * mapeando evidencia documental y evaluando riesgos sistémicos.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TimelineEventSchema = z.object({
  event: z.string().describe("Nombre del hito (Detección, Solicitud, etc.)"),
  date: z.string().describe("Fecha detectada o 'Dato Faltante'"),
  evidence: z.string().describe("Referencia al documento o sección"),
  gapDays: z.number().optional().describe("Días transcurridos desde el hito anterior")
});

const TraceabilityReportInputSchema = z.object({
  orderData: z.any().describe("Datos completos del registro OC/OT"),
  context: z.object({
    relatedOrders: z.array(z.any()).optional(),
  }).optional(),
});
export type TraceabilityReportInput = z.infer<typeof TraceabilityReportInputSchema>;

const TraceabilityReportOutputSchema = z.object({
  header: z.object({
    title: z.string(),
    projectId: z.string(),
    orderId: z.string(),
    topic: z.string(),
    status: z.string()
  }),
  executiveSummary: z.object({
    overview: z.string(),
    economicImpact: z.string(),
    currentRisk: z.enum(['P0', 'P1', 'P2', 'P3']),
    priorityRationale: z.string()
  }),
  forensicTimeline: z.array(TimelineEventSchema),
  documentaryMapping: z.array(z.object({
    source: z.string().describe("PDF, Excel o Registro"),
    location: z.string().describe("Página, Fila o Campo"),
    finding: z.string(),
    conclusion: z.string()
  })),
  semanticClassification: z.object({
    discipline: z.string(),
    cause: z.string(),
    subcause: z.string(),
    level3: z.string().optional(),
    justification: z.string(),
    evidenceTerms: z.array(z.string())
  }),
  deepAnalysis: z.object({
    recurrentPatterns: z.string(),
    mainDrivers: z.array(z.string()),
    earlySignals: z.string(),
    dataQualityScore: z.number().describe("0-100")
  }),
  recommendations: z.array(z.object({
    type: z.enum(['Preventiva', 'Correctiva']),
    action: z.string(),
    owner: z.string(),
    expectedImpact: z.string(),
    priority: z.enum(['Alta', 'Media', 'Baja'])
  })),
  missingData: z.array(z.object({
    field: z.string(),
    reason: z.string(),
    uncertaintyRange: z.string().optional()
  })),
  riskIndex: z.object({
    cost: z.number(),
    schedule: z.number(),
    regulatory: z.number(),
    recurrence: z.number()
  })
});
export type TraceabilityReportOutput = z.infer<typeof TraceabilityReportOutputSchema>;

const traceabilityPrompt = ai.definePrompt({
  name: 'traceabilityPrompt',
  input: {
    schema: z.object({
      serializedOrderData: z.string(),
      context: z.any().optional()
    })
  },
  output: {schema: TraceabilityReportOutputSchema},
  prompt: `Eres un Analista Forense Senior de Proyectos de Construcción en Walmart. 
Tu misión es generar un Informe de Trazabilidad Semántica exhaustivo para el registro OC/OT provisto.

DATOS DEL REGISTRO (JSON):
{{{serializedOrderData}}}

INSTRUCCIONES DE ANÁLISIS:
1. LÍNEA DE TIEMPO: Reconstruye los hitos. Si faltan fechas, márcalas como 'Dato Faltante'. Calcula los 'gapDays' si es posible inferir el tiempo entre pasos.
2. MAPEO DOCUMENTAL: Cruza la información. Si el registro viene de un PDF, menciona la página o sección (si está en la data). Si viene de Excel, menciona la fila.
3. CLASIFICACIÓN SEMÁNTICA: Justifica por qué elegiste la disciplina y causa. Usa los términos de evidencia detectados.
4. RCI: Identifica por qué se repite este patrón. ¿Es el proveedor? ¿Es la etapa? ¿Es una falta de homologación?
5. RIESGO: Calcula el índice de riesgo (0-100) para costo, programa y regulatorio.

Tono: Ejecutivo, técnico, sobrio y basado 100% en evidencia. No inventes fechas ni documentos que no estén en la data de entrada.`,
});

export async function generateTraceabilityReport(input: TraceabilityReportInput): Promise<TraceabilityReportOutput> {
  const {output} = await traceabilityPrompt({
    serializedOrderData: JSON.stringify(input.orderData, null, 2),
    context: input.context
  });
  if (!output) throw new Error("Fallo al generar informe de trazabilidad.");
  return output;
}

const traceabilityReportFlow = ai.defineFlow(
  {
    name: 'traceabilityReportFlow',
    inputSchema: TraceabilityReportInputSchema,
    outputSchema: TraceabilityReportOutputSchema,
  },
  async input => {
    return generateTraceabilityReport(input);
  }
);
