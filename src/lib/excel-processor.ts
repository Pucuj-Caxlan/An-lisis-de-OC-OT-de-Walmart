
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

// Mapa de alias ampliado para soportar múltiples estructuras de reportes Walmart
const COLUMN_MAP: Record<string, string[]> = {
  projectId: ['PID', 'ID TRIRIGA', 'TRIRIGA', 'FOLIO PROYECTO', 'NUMERO DE PROYECTO', 'ID_PROYECTO'],
  projectName: ['Nombre del proyecto', 'PROYECTO', 'NAME', 'DESCRIPCION PROYECTO'],
  type: ['Tipo', 'OT/OCR/OCI', 'TIPO ORDEN', 'CLASE', 'TIPO_SOLICITUD'],
  format: ['Formato', 'FORMATO', 'PROTOTIPO', 'UNIDAD_NEGOCIO'],
  country: ['País', 'PAIS', 'COUNTRY'],
  state: ['Estado', 'ESTADO', 'PROVINCIA'],
  municipality: ['Municipio', 'MUNICIPIO', 'CIUDAD'],
  coordinador: ['Coordinador', 'COORDINADOR', 'COORDINADOR_PROYECTO'],
  plan: ['Plan', 'PLAN', 'PROGRAMA'],
  etapaProyecto: ['Etapa del Proyecto', 'ETAPA', 'FASE'],
  causaRaiz: ['Causa Raiz', 'CAUSA', 'MOTIVO', 'ORIGEN_DESVIACION'],
  descripcion: ['Descripcion', 'DESCRIPCIÓN', 'QUE SE REALIZARA', 'JUSTIFICACION'],
  montoDeductiva: ['Monto Deductiva', 'DEDUCTIVA', 'MONTO_NEGATIVO', 'DEDUCCIONES'],
  montoAditiva: ['Monto Aditiva', 'ADITIVA', 'MONTO_POSITIVO', 'ADICIONALES'],
  impactoNeto: ['Impacto Neto', 'IMPACTO', 'NETO', 'TOTAL_ORDEN'],
  areaSolicitante: ['Área solicitante', 'AREA SOLICITANTE', 'SOLICITA'],
  generadorDesviacion: ['Generador de la desviación', 'GENERADOR', 'RESPONSABLE_DESVIACION'],
  areaEjerceRecurso: ['Área que Ejerce el Recurso', 'AREA EJERCE', 'AREA_PAGO'],
  estatus: ['Estatus', 'ESTATUS', 'STATUS', 'ESTADO_SOLICITUD'],
  fechaSolicitud: ['Fecha de Solicitud', 'FECHA_SOLICITUD', 'DATE_REQUESTED', 'F. SOLICITUD'],
  fechaAprobacionGerente: ['Fecha de Aprobacion Gerente', 'FECHA_APROBACION'],
  fechaPptoProyectista: ['Fecha ppto Proyectista', 'FECHA_PPTO'],
  proveedor: ['Proveedor', 'PROVEEDOR', 'CONTRATISTA', 'VENDOR']
};

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val || val === '#VALUE!' || val === '#REF!' || val === '#N/A' || val === 'NULL') return 0;
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(val: any): string | null {
  if (!val || val === '#VALUE!' || val === 'NULL') return null;
  try {
    // Manejo de fechas seriales de Excel
    if (typeof val === 'number') {
      const d = new Date((val - 25569) * 86400 * 1000);
      return d.toISOString();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

export function processExcelFile(buffer: ArrayBuffer): { data: NormalizedRow[], errors: any[] } {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const allData: NormalizedRow[] = [];
  const errors: any[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    // Convertimos a matriz para buscar las cabeceras inteligentemente
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
    
    if (rawRows.length < 1) return;

    // 1. Detección Inteligente de Cabeceras
    let headerIdx = -1;
    for (let i = 0; i < Math.min(20, rawRows.length); i++) {
      const row = rawRows[i];
      if (!row) continue;
      
      const potentialHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
      // Buscamos coincidencia con campos clave obligatorios
      const hasKeyFields = potentialHeaders.some(h => 
        h.includes('pid') || 
        h.includes('país') || 
        h.includes('tririga') || 
        h.includes('impacto') ||
        h.includes('proyecto')
      );
      
      if (hasKeyFields) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      console.warn(`No se detectaron cabeceras claras en la hoja ${sheetName}. Usando fila 0.`);
      headerIdx = 0;
    }

    const headers = rawRows[headerIdx].map(h => String(h || '').trim());
    const dataRows = rawRows.slice(headerIdx + 1);

    dataRows.forEach((row, idx) => {
      const rowNum = headerIdx + idx + 2;
      
      // Saltamos filas vacías
      if (!row || row.every(cell => cell === null || cell === '')) return;

      const normalized: any = { 
        sheetName, 
        rowNumber: rowNum,
        qcFlags: [] 
      };

      Object.entries(COLUMN_MAP).forEach(([key, aliases]) => {
        const colIdx = headers.findIndex(h => 
          aliases.some(a => h.toLowerCase().includes(a.toLowerCase()))
        );
        
        const rawValue = colIdx !== -1 ? row[colIdx] : null;

        if (key.startsWith('monto') || key === 'impactoNeto') {
          normalized[key] = parseNumber(rawValue);
          if (String(rawValue).includes('#VALUE!')) normalized.qcFlags.push(`FIXED_VALUE_ERROR_${key}`);
        } else if (key.startsWith('fecha')) {
          normalized[key] = parseDate(rawValue);
          if (!normalized[key] && rawValue && String(rawValue).trim() !== '') {
            normalized.qcFlags.push(`DATE_FORMAT_ISSUE_${key}`);
          }
        } else {
          normalized[key] = rawValue !== null ? String(rawValue).trim() : '';
        }
      });

      // Lógica de Negocio: Autocalcular Impacto Neto si falta o es 0
      if (normalized.impactoNeto === 0 && (normalized.montoAditiva !== 0 || normalized.montoDeductiva !== 0)) {
        normalized.impactoNeto = normalized.montoAditiva - normalized.montoDeductiva;
        normalized.qcFlags.push('NET_IMPACT_AUTO_CALCULATED');
      }

      // Validación Mínima para considerarlo un registro válido
      const hasMinInfo = normalized.projectId || normalized.projectName;
      
      if (!hasMinInfo) {
        // Solo registramos error si la fila tiene algo de contenido pero le falta el ID
        if (row.some(cell => cell !== null && cell !== '')) {
          errors.push({ row: rowNum, sheet: sheetName, field: 'projectId', error: 'PID/Proyecto no detectado' });
        }
      } else {
        allData.push(normalized as NormalizedRow);
      }
    });
  });

  return { data: allData, errors };
}
