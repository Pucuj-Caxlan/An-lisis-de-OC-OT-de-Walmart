import * as XLSX from 'xlsx';

export type NormalizedFormat = 'BAE' | 'BA' | 'MB' | 'SC' | 'WSC' | 'WE' | 'OTRO';

export const FORMAT_LABELS: Record<NormalizedFormat, string> = {
  'BAE': 'Bodega Aurrerá Express (BAE)',
  'BA': 'Bodega Aurrerá',
  'MB': 'Mi Bodega',
  'SC': 'Sam\'s Club',
  'WSC': 'Walmart Supercenter',
  'WE': 'Walmart Express',
  'OTRO': 'Otros Formatos'
};

export function normalizeFormatName(raw: string): NormalizedFormat {
  const text = String(raw || '').toUpperCase().trim();
  if (!text) return 'OTRO';
  
  if (text.includes('EXPRESS') || text.includes('BAE') || (text.includes('BOD') && text.includes('EXP'))) return 'BAE';
  if (text.includes('SAMS') || text.includes('SAM\'S')) return 'SC';
  if (text.includes('SUPERCENTER') || text.includes('WSC')) return 'WSC';
  if (text.includes('MI BODEGA') || text.includes('MIBODEGA')) return 'MB';
  if (text.includes('AURRERA') || text.includes('BODEGA')) return 'BA';
  if (text.includes('WALMART EXPRESS') || text.includes('SUPERAMA') || text.includes('W-EXP')) return 'WE';
  
  return 'OTRO';
}

export function normalizeCoordinator(raw: any): string {
  const name = String(raw || 'SIN ASIGNAR').trim().toUpperCase();
  return name || 'SIN ASIGNAR';
}

export function normalizeStage(raw: any): string {
  const stage = String(raw || 'CONSTRUCCIÓN').trim().toUpperCase();
  if (stage.includes('DISEÑO')) return 'DISEÑO';
  if (stage.includes('PERMISO')) return 'PERMISOS';
  if (stage.includes('CONSTRU')) return 'CONSTRUCCIÓN';
  if (stage.includes('LIVE') || stage.includes('CIERRE')) return 'GO-LIVE / CIERRE';
  return stage || 'CONSTRUCCIÓN';
}

export interface NormalizedRow {
  projectId: string;
  projectName: string;
  format_origin: string;
  format_normalized: NormalizedFormat;
  impactoNeto: number;
  disciplina_normalizada: string;
  causa_raiz_normalizada: string;
  subcausa_normalizada: string;
  coordinador_normalizado: string;
  etapa_proyecto_normalizada: string;
  year: number;
  month: number;
  rowNumber: number;
  [key: string]: any;
}

export const CANONICAL_SCHEMA = [
  'projectId', 
  'projectName', 
  'format', 
  'impactoNeto', 
  'disciplina_normalizada', 
  'causa_raiz_normalizada',
  'coordinador',
  'etapa',
  'fecha'
];

export function processExcelFile(buffer: ArrayBuffer): { data: NormalizedRow[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet) as any[];

  const data = rawData.map((row, idx) => {
    const rawFormat = row['formato'] || row['format'] || '';
    const rawDate = row['fecha'] || row['createdAt'] || new Date().toISOString();
    const dateObj = new Date(rawDate);
    
    return {
      ...row,
      projectId: String(row['projectId'] || row['PID'] || row['Folio'] || ''),
      projectName: String(row['projectName'] || row['Nombre'] || ''),
      format_origin: rawFormat,
      format_normalized: normalizeFormatName(rawFormat),
      impactoNeto: parseFloat(row['impactoNeto'] || row['Monto'] || '0'),
      coordinador_normalizado: normalizeCoordinator(row['coordinador'] || row['Coordinador']),
      etapa_proyecto_normalizada: normalizeStage(row['etapa'] || row['Etapa']),
      year: isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear(),
      month: isNaN(dateObj.getMonth()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1,
      rowNumber: idx + 2
    } as NormalizedRow;
  });

  return { data };
}
