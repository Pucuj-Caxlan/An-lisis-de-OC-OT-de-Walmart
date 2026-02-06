export interface OCData {
  id: string;
  orderNumber: string;
  format: 'Bodega Aurrera' | 'Walmart Supercenter' | 'Sam\'s Club' | 'Walmart Express';
  country: 'México' | 'Guatemala' | 'Costa Rica' | 'Honduras' | 'El Salvador' | 'Nicaragua';
  year: number;
  month: string;
  plan: 'Regular' | 'Promoción' | 'Temporada';
  area: 'Logística' | 'Compras' | 'Operaciones' | 'Inventarios';
  impactAmount: number;
  status: 'Completado' | 'Pendiente' | 'En Proceso';
  cause: string;
  isAnomaly: boolean;
  details: string;
  createdAt: string;
}

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const MOCK_OC_DATA: OCData[] = [
  {
    id: '1',
    orderNumber: 'OC-2024-001',
    format: 'Walmart Supercenter',
    country: 'México',
    year: 2024,
    month: 'Ene',
    plan: 'Regular',
    area: 'Logística',
    impactAmount: 15400.50,
    status: 'Completado',
    cause: 'Retraso en transporte primario',
    isAnomaly: false,
    details: 'Carga demorada en CEDIS México por falla mecánica.',
    createdAt: '2024-01-15T08:00:00Z',
  },
  {
    id: '2',
    orderNumber: 'OC-2024-002',
    format: 'Bodega Aurrera',
    country: 'México',
    year: 2024,
    month: 'Ene',
    plan: 'Promoción',
    area: 'Inventarios',
    impactAmount: 85000.00,
    status: 'Pendiente',
    cause: 'Error en pronóstico de demanda',
    isAnomaly: true,
    details: 'Exceso de stock para campaña de Reyes Magos.',
    createdAt: '2024-01-20T10:30:00Z',
  },
  {
    id: '3',
    orderNumber: 'OC-2024-003',
    format: 'Sam\'s Club',
    country: 'México',
    year: 2024,
    month: 'Feb',
    plan: 'Temporada',
    area: 'Logística',
    impactAmount: 12300.00,
    status: 'Completado',
    cause: 'Falta de capacidad en muelle',
    isAnomaly: false,
    details: 'Saturación en muelle de recibo durante fin de semana.',
    createdAt: '2024-02-05T14:00:00Z',
  },
  {
    id: '4',
    orderNumber: 'OC-2024-004',
    format: 'Walmart Express',
    country: 'Guatemala',
    year: 2024,
    month: 'Feb',
    plan: 'Regular',
    area: 'Compras',
    impactAmount: 4500.00,
    status: 'En Proceso',
    cause: 'Error en precio de proveedor',
    isAnomaly: false,
    details: 'Discrepancia entre PO y factura de proveedor local.',
    createdAt: '2024-02-12T09:15:00Z',
  },
  {
    id: '5',
    orderNumber: 'OC-2024-005',
    format: 'Walmart Supercenter',
    country: 'Costa Rica',
    year: 2024,
    month: 'Mar',
    plan: 'Promoción',
    area: 'Operaciones',
    impactAmount: 9200.75,
    status: 'Completado',
    cause: 'Error en etiquetado',
    isAnomaly: false,
    details: 'Etiquetas de precio incorrectas en lote de importación.',
    createdAt: '2024-03-02T16:45:00Z',
  },
  {
    id: '6',
    orderNumber: 'OC-2024-006',
    format: 'Bodega Aurrera',
    country: 'México',
    year: 2024,
    month: 'Mar',
    plan: 'Regular',
    area: 'Logística',
    impactAmount: 210000.00,
    status: 'Completado',
    cause: 'Siniestro en carretera',
    isAnomaly: true,
    details: 'Pérdida total de unidad por accidente en carretera federal.',
    createdAt: '2024-03-10T22:00:00Z',
  },
  {
    id: '7',
    orderNumber: 'OC-2024-007',
    format: 'Sam\'s Club',
    country: 'Honduras',
    year: 2024,
    month: 'Mar',
    plan: 'Temporada',
    area: 'Inventarios',
    impactAmount: 32000.00,
    status: 'Completado',
    cause: 'Caducidad prematura',
    isAnomaly: false,
    details: 'Lote de perecederos con vida útil corta al recibo.',
    createdAt: '2024-03-15T11:00:00Z',
  },
  {
    id: '8',
    orderNumber: 'OC-2023-999',
    format: 'Walmart Supercenter',
    country: 'México',
    year: 2023,
    month: 'Dic',
    plan: 'Temporada',
    area: 'Logística',
    impactAmount: 55000.00,
    status: 'Completado',
    cause: 'Congestión estacional',
    isAnomaly: false,
    details: 'Retrasos generalizados por temporada navideña.',
    createdAt: '2023-12-20T08:00:00Z',
  }
];