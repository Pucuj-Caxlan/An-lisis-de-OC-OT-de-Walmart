
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
}

const COLUMN_MAP: Record<string, string[]> = {
  projectId: ['PID', 'ID TRIRIGA', 'TRIRIGA'],
  projectName: ['Nombre del proyecto', 'PROYECTO'],
  type: ['Tipo', 'OT/OCR/OCI', 'TIPO ORDEN'],
  format: ['Formato', 'FORMATO'],
  country: ['País', 'PAIS'],
  state: ['Estado', 'ESTADO'],
  municipality: ['Municipio', 'MUNICIPIO'],
  coordinador: ['Coordinador', 'COORDINADOR'],
  plan: ['Plan', 'PLAN'],
  etapaProyecto: ['Etapa del Proyecto', 'ETAPA'],
  causaRaiz: ['Causa Raiz', 'CAUSA'],
  descripcion: ['Descripcion', 'DESCRIPCIÓN'],
  montoDeductiva: ['Monto Deductiva', 'DEDUCTIVA'],
  montoAditiva: ['Monto Aditiva', 'ADITIVA'],
  impactoNeto: ['Impacto Neto', 'IMPACTO'],
  areaSolicitante: ['Área solicitante', 'AREA SOLICITANTE'],
  generadorDesviacion: ['Generador de la desviación', 'GENERADOR'],
  areaEjerceRecurso: ['Área que Ejerce el Recurso', 'AREA EJERCE'],
  estatus: ['Estatus', 'ESTATUS'],
  fechaSolicitud: ['Fecha de Solicitud'],
  fechaAprobacionGerente: ['Fecha de Aprobacion Gerente'],
  fechaPptoProyectista: ['Fecha ppto Proyectista'],
  proveedor: ['Proveedor', 'PROVEEDOR']
};

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val || val === '#VALUE!' || val === '#REF!') return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  return parseFloat(cleaned) || 0;
}

function parseDate(val: any): string | null {
  if (!val) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

export function processExcelFile(buffer: ArrayBuffer): { data: NormalizedRow[], errors: any[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const allData: NormalizedRow[] = [];
  const errors: any[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    if (rawRows.length < 2) return;

    // Detect header row (first 10 rows)
    let headerIdx = -1;
    for (let i = 0; i < Math.min(10, rawRows.length); i++) {
      if (rawRows[i].some(cell => String(cell).toLowerCase().includes('pid') || String(cell).toLowerCase().includes('país'))) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) headerIdx = 0;

    const headers = rawRows[headerIdx].map(h => String(h).trim());
    const dataRows = rawRows.slice(headerIdx + 1);

    dataRows.forEach((row, idx) => {
      const rowNum = headerIdx + idx + 2;
      const normalized: any = { 
        sheetName, 
        rowNumber: rowNum,
        qcFlags: [] 
      };

      Object.entries(COLUMN_MAP).forEach(([key, aliases]) => {
        const colIdx = headers.findIndex(h => aliases.some(a => h.toLowerCase().includes(a.toLowerCase())));
        const rawValue = colIdx !== -1 ? row[colIdx] : null;

        if (key.startsWith('monto') || key === 'impactoNeto') {
          normalized[key] = parseNumber(rawValue);
          if (String(rawValue).includes('#VALUE!')) normalized.qcFlags.push(`ERROR_EN_CELDA_${key}`);
        } else if (key.startsWith('fecha')) {
          normalized[key] = parseDate(rawValue);
          if (!normalized[key] && rawValue) normalized.qcFlags.push(`FECHA_INVALIDA_${key}`);
        } else {
          normalized[key] = rawValue ? String(rawValue).trim() : '';
        }
      });

      // Business Logic: Calculate Impacto Neto if missing
      if (!normalized.impactoNeto && (normalized.montoAditiva || normalized.montoDeductiva)) {
        normalized.impactoNeto = normalized.montoAditiva - normalized.montoDeductiva;
        normalized.qcFlags.push('IMPACTO_NETO_CALCULADO');
      }

      // Basic Validation
      if (!normalized.projectId) {
        errors.push({ row: rowNum, sheet: sheetName, field: 'projectId', error: 'Falta PID/Tririga' });
      } else {
        allData.push(normalized as NormalizedRow);
      }
    });
  });

  return { data: allData, errors };
}
