
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
  structuralQuality: number;
}

/**
 * Mapa de alias exhaustivo para homologación de esquemas Walmart.
 * Permite detectar columnas en formatos CAM, BAE, B2, S3 y reportes ad-hoc.
 */
const COLUMN_MAP: Record<string, string[]> = {
  projectId: ['pid', 'id tririga', 'tririga', 'folio proyecto', 'numero de proyecto', 'id_proyecto', 'project id', 'num proyecto'],
  projectName: ['nombre del proyecto', 'proyecto', 'name', 'descripcion proyecto', 'unidad de negocio', 'nombre unidad'],
  type: ['tipo', 'ot/ocr/oci', 'tipo orden', 'clase', 'tipo_solicitud', 'clase de orden'],
  format: ['formato', 'prototipo', 'unidad_negocio', 'formato tienda', 'business unit'],
  country: ['país', 'pais', 'country', 'region'],
  state: ['estado', 'provincia', 'state', 'entidad'],
  municipality: ['municipio', 'ciudad', 'municipality', 'delegacion'],
  coordinador: ['coordinador', 'pm', 'project manager', 'responsable pmo'],
  plan: ['plan', 'programa', 'plan de inversion', 'budget line'],
  etapaProyecto: ['etapa del proyecto', 'etapa', 'fase', 'stage', 'status obra'],
  causaRaiz: ['causa raiz', 'causa', 'motivo', 'origen_desviacion', 'root cause', 'causa_normalizada'],
  descripcion: ['descripcion', 'descripción', 'que se realizara', 'justificacion', 'comentarios', 'detalle tecnico', 'description'],
  montoDeductiva: ['monto deductiva', 'deductiva', 'monto_negativo', 'deducciones', 'ahorro', 'credit'],
  montoAditiva: ['monto aditiva', 'aditiva', 'monto_positivo', 'adicionales', 'extra cost', 'debit'],
  impactoNeto: ['impacto neto', 'impacto', 'neto', 'total_orden', 'monto total', 'net impact', 'amount'],
  areaSolicitante: ['área solicitante', 'area solicitante', 'solicita', 'requesting area'],
  generadorDesviacion: ['generador de la desviación', 'generador', 'responsable_desviacion', 'causante'],
  areaEjerceRecurso: ['área que ejerce el recurso', 'area ejerce', 'area_pago', 'ejecutor'],
  estatus: ['estatus', 'estatus solicitud', 'status', 'estado_solicitud', 'estado actual'],
  fechaSolicitud: ['fecha de solicitud', 'fecha_solicitud', 'date_requested', 'f. solicitud', 'created date'],
  fechaAprobacionGerente: ['fecha de aprobacion gerente', 'fecha_aprobacion', 'approval date', 'f. aprobacion'],
  fechaPptoProyectista: ['fecha ppto proyectista', 'fecha_ppto', 'quote date'],
  proveedor: ['proveedor', 'contratista', 'vendor', 'razon social', 'empresa']
};

function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val || val === '#VALUE!' || val === '#REF!' || val === '#N/A' || val === 'NULL' || val === 'NaN') return 0;
  // Eliminar símbolos de moneda y comas
  const cleaned = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

function parseDate(val: any): string | null {
  if (!val || val === '#VALUE!' || val === 'NULL' || val === '0') return null;
  try {
    // Manejo de fechas seriales de Excel (números)
    if (typeof val === 'number') {
      const d = new Date((val - 25569) * 86400 * 1000);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    
    // Intento de parseo de strings
    const dateStr = String(val).trim();
    if (!dateStr) return null;
    
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d.toISOString();
    
    // Fallback para formatos DD/MM/YYYY comunes en Latam
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
      const d2 = new Date(year, month, day);
      if (!isNaN(d2.getTime())) return d2.toISOString();
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Calcula un índice de calidad estructural del registro (0-100)
 */
function calculateStructuralQuality(normalized: any): number {
  const criticalFields = ['projectId', 'impactoNeto', 'descripcion', 'causaRaiz', 'fechaSolicitud'];
  let score = 100;
  const penaltyPerMissingCritical = 20;
  
  criticalFields.forEach(field => {
    if (!normalized[field] || normalized[field] === '' || normalized[field] === 0) {
      score -= penaltyPerMissingCritical;
    }
  });
  
  return Math.max(0, score);
}

export function processExcelFile(buffer: ArrayBuffer): { data: NormalizedRow[], errors: any[] } {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false, cellText: false });
  const allData: NormalizedRow[] = [];
  const errors: any[] = [];

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    // Convertimos a matriz para búsqueda de cabeceras profunda
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
    
    if (rawRows.length < 1) return;

    // 1. Detección Inteligente de Cabeceras (Escaneo de las primeras 25 filas)
    let headerIdx = -1;
    for (let i = 0; i < Math.min(25, rawRows.length); i++) {
      const row = rawRows[i];
      if (!row) continue;
      
      const potentialHeaders = row.map(cell => String(cell || '').toLowerCase().trim());
      // Requerimos al menos 3 coincidencias clave para confirmar que es la fila de cabeceras
      const matches = potentialHeaders.filter(h => 
        Object.values(COLUMN_MAP).flat().some(alias => h === alias || h.includes(alias))
      ).length;
      
      if (matches >= 3) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      console.warn(`No se detectó un esquema claro en la hoja ${sheetName}.`);
      headerIdx = 0; // Fallback
    }

    const headers = rawRows[headerIdx].map(h => String(h || '').trim().toLowerCase());
    const dataRows = rawRows.slice(headerIdx + 1);

    dataRows.forEach((row, idx) => {
      const rowNum = headerIdx + idx + 2;
      
      if (!row || row.every(cell => cell === null || cell === '')) return;

      const normalized: any = { 
        sheetName, 
        rowNumber: rowNum,
        qcFlags: [] 
      };

      // 2. Mapeo Forense de Columnas
      Object.entries(COLUMN_MAP).forEach(([canonicalKey, aliases]) => {
        // Buscar la columna por coincidencia exacta o parcial de alias
        const colIdx = headers.findIndex(h => 
          aliases.some(alias => h === alias || h.includes(alias))
        );
        
        const rawValue = colIdx !== -1 ? row[colIdx] : null;

        if (canonicalKey.startsWith('monto') || canonicalKey === 'impactoNeto') {
          normalized[canonicalKey] = parseNumber(rawValue);
          if (String(rawValue).includes('#VALUE!')) normalized.qcFlags.push(`CLEANED_VALUE_ERROR_${canonicalKey}`);
        } else if (canonicalKey.startsWith('fecha')) {
          normalized[canonicalKey] = parseDate(rawValue);
          if (!normalized[canonicalKey] && rawValue && String(rawValue).trim() !== '') {
            normalized.qcFlags.push(`INVALID_DATE_FORMAT_${canonicalKey}`);
          }
        } else {
          normalized[canonicalKey] = rawValue !== null ? String(rawValue).trim() : '';
        }
      });

      // 3. Lógica de Consistencia Financiera
      if (normalized.impactoNeto === 0 && (normalized.montoAditiva !== 0 || normalized.montoDeductiva !== 0)) {
        normalized.impactoNeto = normalized.montoAditiva - normalized.montoDeductiva;
        normalized.qcFlags.push('FINANCIAL_RECONCILIATION_APPLIED');
      }

      // 4. Validación de Calidad Estructural
      normalized.structuralQuality = calculateStructuralQuality(normalized);
      if (normalized.structuralQuality < 60) {
        normalized.qcFlags.push('LOW_STRUCTURAL_INTEGRITY');
      }

      // 5. Criterio de Aceptación Mínima
      const hasIdentity = normalized.projectId && normalized.projectId !== '';
      
      if (!hasIdentity) {
        if (row.some(cell => cell !== null && cell !== '')) {
          errors.push({ row: rowNum, sheet: sheetName, field: 'projectId', error: 'Identificador Crítico (PID) Faltante' });
        }
      } else {
        allData.push(normalized as NormalizedRow);
      }
    });
  });

  return { data: allData, errors };
}
