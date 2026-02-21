
import * as XLSX from 'xlsx';

export interface NormalizedRow {
  projectId: string;
  projectName: string;
  type: string;
  format: string;
  country: string;
  state: string;
  municipality: string;
  coordinador: string;
  plan: string;
  projectStage: string;
  causaRaiz: string;
  descripcion: string;
  montoDeductiva: number;
  montoAditiva: number;
  impactoNeto: number;
  importeProy: number;
  importeObra: number;
  importeCompras: number;
  areaSolicitante: string;
  generadorDesviacion: string;
  areaEjerceRecursoDeductiva: string;
  areaEjerceRecursoAditiva: string;
  estatus: string;
  fechaSolicitud: string | null;
  fechaAprobacionGerente: string | null;
  fechaAprobacionLider: string | null;
  fechaPptoProyectista: string | null;
  fechaRetraso: string | null;
  noRechazo: string;
  motivoRechazo: string;
  proveedor: string;
  rowNumber: number;
  sheetName: string;
  structural_quality_score: number;
  reliability_level: 'HIGH' | 'MEDIUM' | 'LOW';
  pdf_traceability_reconstructed: boolean;
}

export const CANONICAL_SCHEMA = [
  'projectId', 'projectName', 'type', 'format', 'country', 'state', 'municipality',
  'coordinador', 'plan', 'projectStage', 'causaRaiz', 'descripcion',
  'montoDeductiva', 'montoAditiva', 'impactoNeto', 'importeProy', 'importeObra', 'importeCompras',
  'areaSolicitante', 'generadorDesviacion', 'areaEjerceRecursoDeductiva', 'areaEjerceRecursoAditiva',
  'estatus', 'fechaSolicitud', 'fechaAprobacionGerente', 'fechaAprobacionLider',
  'fechaPptoProyectista', 'fechaRetraso', 'noRechazo', 'motivoRechazo', 'proveedor'
];

const COLUMN_MAP: Record<string, string[]> = {
  projectId: ['pid', 'id tririga', 'tririga', 'folio proyecto', 'numero de proyecto', 'project id'],
  projectName: ['nombre del proyecto', 'proyecto', 'name', 'descripcion proyecto'],
  type: ['tipo', 'ot/ocr/oci', 'tipo orden', 'clase'],
  format: ['formato', 'prototipo', 'unidad_negocio', 'formato tienda'],
  country: ['país', 'pais', 'country'],
  state: ['estado', 'provincia', 'state'],
  municipality: ['municipio', 'ciudad', 'municipality'],
  coordinador: ['coordinador', 'responsable'],
  plan: ['plan', 'ejercicio'],
  projectStage: ['etapa del proyecto', 'etapa', 'stage'],
  causaRaiz: ['causa raiz', 'causa', 'motivo', 'root cause'],
  descripcion: ['descripcion', 'descripción', 'que se realizara', 'justificacion', 'description'],
  montoDeductiva: ['monto deductiva', 'deductiva'],
  montoAditiva: ['monto aditiva', 'aditiva'],
  impactoNeto: ['impacto neto', 'impacto', 'neto', 'total_orden', 'amount'],
  importeProy: ['importe proy'],
  importeObra: ['importe obra'],
  importeCompras: ['importe compras'],
  areaSolicitante: ['área solicitante', 'area solicitante'],
  generadorDesviacion: ['generador de la desviación', 'generador'],
  areaEjerceRecursoDeductiva: ['área que ejerce el recurso/deductiva', 'area ejerce recurso deductiva'],
  areaEjerceRecursoAditiva: ['área que ejerce el recurso/aditiva', 'area ejerce recurso aditiva'],
  estatus: ['estatus', 'status', 'estado orden'],
  fechaSolicitud: ['fecha de solicitud', 'fecha_solicitud', 'created date'],
  fechaAprobacionGerente: ['fecha de aprobacion gerente', 'aprobacion gerente'],
  fechaAprobacionLider: ['fecha de aprobacion líder de squad', 'aprobacion lider'],
  fechaPptoProyectista: ['fecha ppto proyectista', 'fecha ppto'],
  fechaRetraso: ['fecha retraso'],
  noRechazo: ['no de rechazo', 'rechazos'],
  motivoRechazo: ['motivo del rechazo'],
  proveedor: ['proveedor', 'contratista', 'vendor']
};

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val || val === '#VALUE!' || val === '#REF!' || val === '#N/A') return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(val: any): string | null {
  if (!val || val === '#VALUE!' || val === '0') return null;
  try {
    if (typeof val === 'number') {
      const d = new Date((val - 25569) * 86400 * 1000);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    const dateStr = String(val).trim();
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
    return null;
  } catch { return null; }
}

function calculateStructuralQuality(normalized: any): number {
  let score = 0;
  const criticalFields = ['projectId', 'impactoNeto', 'fechaSolicitud', 'descripcion', 'causaRaiz'];
  criticalFields.forEach(f => {
    if (normalized[f] && String(normalized[f]).trim() !== '' && normalized[f] !== 0) score += 20;
  });
  return Math.min(100, Math.max(0, score));
}

export function processExcelFile(buffer: ArrayBuffer): { data: NormalizedRow[], errors: any[] } {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const allData: NormalizedRow[] = [];
  const errors: any[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
    if (rawRows.length < 1) return;

    let headerIdx = -1;
    for (let i = 0; i < Math.min(25, rawRows.length); i++) {
      const row = rawRows[i];
      if (!row) continue;
      const potentialHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
      const matches = potentialHeaders.filter(h => 
        Object.values(COLUMN_MAP).flat().some(alias => h === alias || h.includes(alias))
      ).length;
      if (matches >= 3) { headerIdx = i; break; }
    }

    if (headerIdx === -1) headerIdx = 0;
    const headers = rawRows[headerIdx].map(h => String(h || '').trim().toLowerCase());
    const dataRows = rawRows.slice(headerIdx + 1);

    dataRows.forEach((row, idx) => {
      if (!row || row.every(cell => cell === null || cell === '')) return;
      
      const normalized: any = { sheetName, rowNumber: headerIdx + idx + 2 };

      CANONICAL_SCHEMA.forEach(field => {
        const aliases = COLUMN_MAP[field] || [field.toLowerCase()];
        const colIdx = headers.findIndex(h => aliases.some(a => h === a || h.includes(a)));
        const rawValue = colIdx !== -1 ? row[colIdx] : null;

        if (field.startsWith('monto') || field.startsWith('impacto') || field.startsWith('importe')) {
          normalized[field] = parseNumber(rawValue);
        } else if (field.startsWith('fecha')) {
          normalized[field] = parseDate(rawValue);
        } else {
          normalized[field] = rawValue !== null ? String(rawValue).trim() : '';
        }
      });

      normalized.structural_quality_score = calculateStructuralQuality(normalized);
      normalized.pdf_traceability_reconstructed = !!(normalized.projectId && normalized.orderNumber && normalized.descripcion?.length > 50);
      
      if (normalized.structural_quality_score > 85) normalized.reliability_level = 'HIGH';
      else if (normalized.structural_quality_score > 60) normalized.reliability_level = 'MEDIUM';
      else normalized.reliability_level = 'LOW';

      if (normalized.projectId) {
        allData.push(normalized as NormalizedRow);
      } else {
        errors.push({ row: normalized.rowNumber, error: 'PID Faltante' });
      }
    });
  });

  return { data: allData, errors };
}
