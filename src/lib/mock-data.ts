
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
  generadorDesviacion?: string;
  fechaSolicitud?: string;
  impactoNeto?: number;
  causaRaiz?: string;
  type?: string;
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
    fechaSolicitud: '2024-01-15',
    impactoNeto: 15400.50,
    causaRaiz: 'Logística - CEDIS',
    type: 'OT',
    generadorDesviacion: 'Diseño'
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
    fechaSolicitud: '2024-01-20',
    impactoNeto: 85000.00,
    causaRaiz: 'Inventario - Exceso',
    type: 'OCR',
    generadorDesviacion: 'Operaciones'
  }
];
