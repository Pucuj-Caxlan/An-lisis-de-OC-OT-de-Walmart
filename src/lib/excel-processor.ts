
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
  etapaProyecto: string;
  causaRaiz: string;
  descripcion: string;
  montoDeductiva: number;
  montoAditiva: number;
  impactoNeto: number;
  areaSolicitante: string;
  generadorDesviacion: string;
  areaEjerceRecurso: string;
  estatus: string;
  fechaSolicitud: string | null;
  fechaAprobacionGerente: string | null;
  fechaPptoProyectista: string | null;
  proveedor: string;
  qcFlags: string[];
  rowNumber: number;
  sheetName: string;
  structural_quality_score: number;
  reliability_level: 'HIGH' | 'MEDIUM' | 'LOW';
  pdf_traceability_reconstructed: boolean;
}

/**
 * Mapa canónico base para validación estructural.
 */
export const CANONICAL_SCHEMA = [
  'projectId', 'projectName', 'type', 'format', 'country', 'state', 'municipality',
  'coordinador', 'plan', 'etapaProyecto', 'causaRaiz', 'descripcion',
  'montoDeductiva', 'montoAditiva', 'impactoNeto', 'areaSolicitante',
  'generadorDesviacion', 'areaEjerceRecurso', 'estatus', 'fechaSolicitud',
  'fechaAprobacionGerente', 'fechaPptoProyectista', 'proveedor'
];

const COLUMN_MAP: Record<string, string[]> = {
  projectId: ['pid', 'id tririga', 'tririga', 'folio proyecto', 'numero de proyecto', 'id_proyecto', 'project id', 'num proyecto'],
  projectName: ['nombre del proyecto', 'proyecto', 'name', 'descripcion proyecto', 'unidad de negocio', 'nombre unidad'],
  type: ['tipo', 'ot/ocr/oci', 'tipo orden', 'clase', 'tipo_solicitud', 'clase de orden'],
  format: ['formato', 'prototipo', 'unidad_negocio', 'formato tienda', 'business unit'],
  causaRaiz: ['causa raiz', 'causa', 'motivo', 'origen_desviacion', 'root cause', 'causa_normalizada'],
  descripcion: ['descripcion', 'descripción', 'que se realizara', 'justificacion', 'comentarios', 'detalle tecnico', 'description'],
  impactoNeto: ['impacto neto', 'impacto', 'neto', 'total_orden', 'monto total', 'net impact', 'amount'],
  fechaSolicitud: ['fecha de solicitud', 'fecha_solicitud', 'date_requested', 'f. solicitud', 'created date']
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
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
      const d2 = new Date(year, month, day);
      if (!isNaN(d2.getTime())) return d2.toISOString();
    }
    return null;
  } catch { return null; }
}

/**
 * MODELO MATEMÁTICO: Structural Quality Score (SQS)
 * Calcula la integridad del registro basado en pesos estratégicos.
 */
function calculateStructuralQuality(normalized: any): number {
  let score = 0;
  
  // Pesos Críticos (Total 100)
  const weights: Record<string, number> = {
    projectId: 20,
    impactoNeto: 20,
    fechaSolicitud: 20,
    descripcion: 20,
    causaRaiz: 20
  };

  Object.entries(weights).forEach(([field, weight]) => {
    if (normalized[field] && String(normalized[field]).trim() !== '' && normalized[field] !== 0) {
      score += weight;
    }
  });

  // Bonos por campos de soporte (Max +20 adicionales, luego normalizado)
  const supportFields = ['proveedor', 'coordinador', 'disciplina_normalizada', 'format', 'etapaProyecto'];
  supportFields.forEach(field => {
    if (normalized[field]) score += 4;
  });

  // Penalizaciones
  if (normalized.impactoNeto === 0) score -= 10;
  if (!normalized.fechaSolicitud) score -= 10;

  return Math.min(100, Math.max(0, score));
}

/**
 * HEURÍSTICA DE RECONSTRUCCIÓN DE TRAZABILIDAD
 */
function reconstructTraceability(normalized: any): boolean {
  // Un registro tiene trazabilidad reconstruida si tiene PID válido,
  // Número de Orden y una descripción técnica mayor a 50 caracteres.
  const hasValidIdentity = /^(\d+)(-\d+)?$/.test(normalized.projectId);
  const hasOrderNum = !!normalized.orderNumber || (normalized.type && normalized.type !== '');
  const hasTechnicalDepth = normalized.descripcion?.length > 50;
  
  return hasValidIdentity && hasOrderNum && hasTechnicalDepth;
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
      
      const normalized: any = { sheetName, rowNumber: headerIdx + idx + 2, qcFlags: [] };

      // Mapeo Heurístico
      CANONICAL_SCHEMA.forEach(field => {
        const aliases = COLUMN_MAP[field] || [field.toLowerCase()];
        const colIdx = headers.findIndex(h => aliases.some(a => h === a || h.includes(a)));
        const rawValue = colIdx !== -1 ? row[colIdx] : null;

        if (field.startsWith('monto') || field === 'impactoNeto') {
          normalized[field] = parseNumber(rawValue);
        } else if (field.startsWith('fecha')) {
          normalized[field] = parseDate(rawValue);
        } else {
          normalized[field] = rawValue !== null ? String(rawValue).trim() : '';
        }
      });

      // Calidad y Trazabilidad
      normalized.structural_quality_score = calculateStructuralQuality(normalized);
      normalized.pdf_traceability_reconstructed = reconstructTraceability(normalized);
      
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
