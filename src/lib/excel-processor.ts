
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

export interface NormalizedRow {
  projectId: string;
  projectName: string;
  format_origin: string;
  format_normalized: NormalizedFormat;
  impactoNeto: number;
  disciplina_normalizada: string;
  causa_raiz_normalizada: string;
  subcausa_normalizada: string;
  rowNumber: number;
  [key: string]: any;
}

export const CANONICAL_SCHEMA = [
  'projectId', 'projectName', 'format', 'impactoNeto', 'disciplina_normalizada', 'causa_raiz_normalizada'
];

export function processExcelFile(buffer: ArrayBuffer): { data: NormalizedRow[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet) as any[];

  const data = rawData.map((row, idx) => {
    const rawFormat = row['formato'] || row['format'] || '';
    return {
      ...row,
      projectId: String(row['projectId'] || row['PID'] || ''),
      projectName: String(row['projectName'] || row['Nombre'] || ''),
      format_origin: rawFormat,
      format_normalized: normalizeFormatName(rawFormat),
      impactoNeto: parseFloat(row['impactoNeto'] || row['Monto'] || '0'),
      rowNumber: idx + 2
    } as NormalizedRow;
  });

  return { data };
}
