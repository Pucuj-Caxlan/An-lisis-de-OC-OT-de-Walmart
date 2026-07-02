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

/**
 * Homologa la Causa Raíz según el Catálogo Maestro de 10 categorías de Walmart.
 */
export function normalizeRootCause(raw: any): string {
  const text = String(raw || '').trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 

  if (!text || text === 'UNDEFINED' || text === 'NULL') return 'ERRORES / OMISIONES';

  if (text.includes('ALTA') || (text.includes('ALCANCE') && text.includes('PLAN'))) return 'ALTA DE ALCANCE EN PLAN';
  if (text.includes('CUMPLIMIENTO') || text.includes('AUTORIDAD') || text.includes('GOBIERNO') || text.includes('INFRAESTRUCTURA VIAL')) return 'SOLICITUD DE CUMPLIMIENTO / AUTORIDAD';
  if (text.includes('PROTOTIPO') && (text.includes('ACTUALIZA') || text.includes('VIGENTE') || text.includes('VERSION'))) return 'ACTUALIZACIÓN DE PROTOTIPO';
  if (text.includes('ESTRATEGICA') || text.includes('SELF-CHECKOUT') || text.includes('PICKUP') || text.includes('SCOPE FUERA')) return 'INICIATIVAS ESTRATÉGICAS Y ADICIONES A SCOPE FUERA DE PROTOTIPO';
  if (text.includes('CONCURSO') || (text.includes('ALCANCE') && text.includes('CONOCIDO')) || text.includes('OMITIDO WALMART')) return 'ALCANCE CONOCIDO NO ASIGNADO POR CONCURSOS';
  if (text.includes('SINIESTRO') || text.includes('INUNDA') || text.includes('CAIDO') || text.includes('DERRUMBE') || text.includes('DESASTRE')) return 'IMPREVISTOS POR SINIESTRO';
  if (text.includes('HALLAZGO') || text.includes('SITIO') || text.includes('ROCA') || text.includes('FREATICO') || text.includes('INAH')) return 'HALLAZGOS / IMPREVISTOS EN SITIO DURANTE PROCESO DE CONSTRUCCIÓN';
  if (text.includes('PROCESO CONSTRUCTIVO') || text.includes('EXCAVACION') || text.includes('COLINDANCIA') || text.includes('TAPIAL')) return 'REQUERIMIENTO DE PROCESOS CONSTRUCTIVOS';
  if (text.includes('NEGOCIACION') || text.includes('TENANCY') || text.includes('ACUERDO PACTADO')) return 'CAMBIO DE NEGOCIACIÓN';
  if (text.includes('ERROR') || text.includes('OMISION') || text.includes('CRITERIO') || text.includes('ESPECIFICA')) return 'ERRORES / OMISIONES';

  return 'ERRORES / OMISIONES';
}

/**
 * Homologa nombres de disciplinas y asegura coherencia técnica.
 */
export function normalizeDiscipline(raw: any, subcause?: string): string {
  let text = String(raw || 'PENDIENTE').trim().toUpperCase();
  const sub = String(subcause || '').trim().toUpperCase();

  if (sub.includes('AMBIENTAL') || sub.includes('FORESTAL') || sub.includes('PROFEPA') || sub.includes('MIA')) return 'AMBIENTAL';
  if (sub.includes('UVIE') || sub.includes('ELECTRICA') || sub.includes('TABLERO') || sub.includes('SUBESTACION') || sub.includes('LUMINARIA')) return 'ELÉCTRICA';
  if (sub.includes('HIDRAUL') || sub.includes('SANITARIA') || sub.includes('PLUVIAL') || sub.includes('DRENAJE') || sub.includes('BOMBA')) return 'HIDRÁULICA';
  if (sub.includes('MECANICA') || sub.includes('HVAC') || sub.includes('AIRE') || sub.includes('REFRIGERACION')) return 'MECÁNICA';
  if (sub.includes('CIMENTACION') || sub.includes('ESTRUCTURA') || sub.includes('SUELO') || sub.includes('ROCA') || sub.includes('EXCAVACION') || sub.includes('TERRACERIA') || sub.includes('PAVIMENTO')) return 'CIVIL';
  
  if (text.includes('ESTRUCTUR')) return 'ESTRUCTURA';
  if (text.includes('ELECTR')) return 'ELÉCTRICA';
  if (text.includes('HIDRAUL')) return 'HIDRÁULICA';
  if (text.includes('ARQUITEC')) return 'ARQUITECTURA';
  if (text.includes('MECANIC')) return 'MECÁNICA';
  if (text.includes('AMBIENT')) return 'AMBIENTAL';
  if (text.includes('CIVIL')) return 'CIVIL';
  if (text.includes('INGENIER')) return 'INGENIERÍA';
  if (text.includes('GESTION') || text.includes('GESTIÓN')) return 'GESTIÓN Y ADMON';
  
  return text;
}

/**
 * Motor de Clasificación Estratégica para el Universo Total (10,900 registros).
 * Agrupa descripciones técnicas en clusters accionables para el Pareto 80/20.
 * Garantiza asignación del 100% de los registros analizando la descripción.
 */
export function normalizeSubCause(raw: any): string {
  let text = String(raw || '').trim().toUpperCase();
  const clean = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  if (!clean || clean.length < 3 || clean === 'N/A') return 'ADICIONALES Y TRABAJOS COMPLEMENTARIOS';

  // 1. CONDICIONES DE SITIO (Driver de alto impacto imprevisto)
  if (clean.includes('ROCA') || clean.includes('FREATICO') || clean.includes('SUBSTRATO') || clean.includes('GEOTECNIA') || clean.includes('INAH') || clean.includes('HALLAZGO')) return 'CONDICIONES DE SITIO / HALLAZGOS GEOLÓGICOS';

  // 2. DISEÑO Y PROYECTO EJECUTIVO (Drivers de ineficiencia administrativa)
  if (clean.includes('CATALOGO') || clean.includes('OMISION') || clean.includes('CONCEPTO') || clean.includes('PARTIDA') || clean.includes('PROYECTO') || clean.includes('DISEÑO') || clean.includes('INGENIERIA') || clean.includes('PLANO') || clean.includes('DETALLE') || clean.includes('ALCANCE')) return 'OMISIÓN EN PROYECTO / CATÁLOGO';

  // 3. INFRAESTRUCTURA ELÉCTRICA Y POTENCIA
  if (clean.includes('ELECTRICA') || clean.includes('TABLERO') || clean.includes('SUBESTACION') || clean.includes('TRANSFORMADOR') || clean.includes('CABLE') || clean.includes('LUMINARIA') || clean.includes('UVIE') || clean.includes('PLANTA DE EMERGENCIA')) return 'INFRAESTRUCTURA ELÉCTRICA Y POTENCIA';

  // 4. OBRA CIVIL, CIMENTACIÓN Y ESTRUCTURA
  if (clean.includes('CIMENTACION') || clean.includes('ESTRUCTURA') || clean.includes('ZAPATA') || clean.includes('PILA') || clean.includes('CONCRETO') || clean.includes('ACERO') || clean.includes('MURO') || clean.includes('DEMOLICION') || clean.includes('PISO')) return 'OBRA CIVIL, ESTRUCTURA Y CIMENTACIONES';

  // 5. MOVIMIENTO DE TIERRAS Y TERRACERÍAS
  if (clean.includes('TERRACERIA') || clean.includes('RELLENO') || clean.includes('EXCAVACION') || clean.includes('PLATAFORMA') || clean.includes('MEJORAMIENTO') || clean.includes('NIVELACION')) return 'MOVIMIENTO DE TIERRAS Y TERRACERÍAS';

  // 6. INSTALACIONES MEP (HIDRÁULICA, SANITARIA, PCI)
  if (clean.includes('HIDRAULICA') || clean.includes('SANITARIA') || clean.includes('PLUVIAL') || clean.includes('DRENAJE') || clean.includes('PCI') || clean.includes('CONTRA INCENDIO') || clean.includes('BOMBA') || clean.includes('CISTERNA')) return 'INSTALACIONES HIDROSANITARIAS Y PCI';

  // 7. CLIMATIZACIÓN Y REFRIGERACIÓN
  if (clean.includes('HVAC') || clean.includes('AIRE') || clean.includes('REFRIGERACION') || clean.includes('CAMARA') || clean.includes('EXTRACCION') || clean.includes('CHILLER') || clean.includes('VITRINA')) return 'CLIMATIZACIÓN Y REFRIGERACIÓN COMERCIAL';

  // 8. EQUIPAMIENTO, MOBILIARIO Y RACKS
  if (clean.includes('MOBILIARIO') || clean.includes('EQUIPO') || clean.includes('RACK') || clean.includes('GONDOLA') || clean.includes('MUEBLE') || clean.includes('MONTACARGAS')) return 'EQUIPAMIENTO Y MOBILIARIO DE TIENDA';

  // 9. REMODELACIÓN, ACABADOS Y MEJORAS
  if (clean.includes('REMODELACION') || clean.includes('ACABADO') || clean.includes('PINTURA') || clean.includes('PISO') || clean.includes('TAPIAL') || clean.includes('PLAFON') || clean.includes('FACHADA')) return 'REMODELACIÓN, ACABADOS Y MEJORAS';

  // 10. ESTRATEGIA WALMART (SCO, PICKUP)
  if (clean.includes('SCO') || clean.includes('SELF-CHECKOUT') || clean.includes('AUTOPAGO') || clean.includes('PICKUP') || clean.includes('PICK UP') || clean.includes('OPERACION')) return 'ESTRATEGIA OPERATIVA (SCO / PICKUP)';

  // 11. TECNOLOGÍA, CCTV Y SEGURIDAD
  if (clean.includes('CCTV') || clean.includes('SEGURIDAD') || clean.includes('VOZ') || clean.includes('DATOS') || clean.includes('TELECOM') || clean.includes('ALMA') || clean.includes('SISTEMA')) return 'TECNOLOGÍA Y SEGURIDAD ELECTRÓNICA';

  // 12. GESTIÓN, TRÁMITES Y AUTORIDADES
  if (clean.includes('LICENCIA') || clean.includes('PERMISO') || clean.includes('TRAMITE') || clean.includes('GESTORIA') || clean.includes('AUTORIDAD') || clean.includes('GOBIERNO') || clean.includes('DICTAMEN')) return 'GESTIÓN DE TRÁMITES Y LICENCIAS';

  // 13. AMBIENTAL Y ENTORNO URBANO
  if (clean.includes('AMBIENTAL') || clean.includes('MIA') || clean.includes('PROFEPA') || clean.includes('MITIGACION') || clean.includes('VIAL') || clean.includes('URBANIZACION') || clean.includes('SEMAFORO')) return 'CUMPLIMIENTO AMBIENTAL Y VIAL';

  // 14. MANTENIMIENTO Y REPARACIONES
  if (clean.includes('MANTENIMIENTO') || clean.includes('REPARACION') || clean.includes('FALLA') || clean.includes('CORRECTIVO') || clean.includes('REPOSICION')) return 'MANTENIMIENTO Y REPARACIONES';

  // 15. SINIESTROS E IMPREVISTOS CLIMÁTICOS
  if (clean.includes('SINIESTRO') || clean.includes('INUNDACION') || clean.includes('DAÑO') || clean.includes('CLIMA') || clean.includes('LLUVIA') || clean.includes('DESASTRE')) return 'SINIESTROS E IMPREVISTOS CLIMÁTICOS';

  // FALLBACK ESTRATÉGICO: Cualquier registro con texto que no sea captado arriba entra aquí.
  // Esto garantiza el 100% de asignación.
  return 'ADICIONALES Y TRABAJOS COMPLEMENTARIOS';
}

export function normalizeState(raw: any): string {
  let text = String(raw || '').trim().toUpperCase();
  const clean = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  if (!clean || clean === 'UNDEFINED' || clean === 'NULL') return 'CIUDAD DE MÉXICO';

  if (clean.includes('CDMX') || clean.includes('CIUDAD DE MEXICO') || clean.includes('DISTRITO FEDERAL') || clean === 'DF') return 'CIUDAD DE MÉXICO';
  if (clean.includes('EDOMEX') || clean === 'MEXICO' || clean.includes('ESTADO DE MEXICO') || clean.includes('NAUCALPAN')) return 'ESTADO DE MÉXICO';
  if (clean.includes('NUEVO LEON') || clean.includes('MONTERREY')) return 'NUEVO LEÓN';
  if (clean.includes('JALISCO') || clean.includes('GUADALAJARA')) return 'JALISCO';
  if (clean.includes('QUERETARO')) return 'QUERÉTARO';
  if (clean.includes('YUCATAN') || clean.includes('MERIDA')) return 'YUCATÁN';
  if (clean.includes('GUANAJUATO') || clean.includes('LEON')) return 'GUANAJUATO';
  if (clean.includes('PUEBLA')) return 'PUEBLA';
  if (clean.includes('VERACRUZ')) return 'VERACRUZ';
  if (clean.includes('CHIHUAHUA')) return 'CHIHUAHUA';
  if (clean.includes('BAJA CALIFORNIA') && !clean.includes('SUR')) return 'BAJA CALIFORNIA';
  if (clean.includes('BAJA CALIFORNIA SUR')) return 'BAJA CALIFORNIA SUR';
  if (clean.includes('MICHOACAN')) return 'MICHOACÁN';
  if (clean.includes('SAN LUIS')) return 'SAN LUIS POTOSÍ';
  if (clean.includes('COAHUILA')) return 'COAHUILA';
  if (clean.includes('SINALOA')) return 'SINALOA';
  if (clean.includes('SONORA')) return 'SONORA';
  if (clean.includes('CHIAPAS')) return 'CHIAPAS';
  if (clean.includes('TABASCO')) return 'TABASCO';
  if (clean.includes('QUINTANA')) return 'QUINTANA ROO';
  if (clean.includes('GUERRERO')) return 'GUERRERO';
  if (clean.includes('OAXACA')) return 'OAXACA';
  if (clean.includes('TAMAULIPAS')) return 'TAMAULIPAS';
  if (clean.includes('HIDALGO')) return 'HIDALGO';
  if (clean.includes('MORELOS')) return 'MORELOS';
  if (clean.includes('AGUASCALIENTES')) return 'AGUASCALIENTES';
  if (clean.includes('DURANGO')) return 'DURANGO';
  if (clean.includes('ZACATECAS')) return 'ZACATECAS';
  if (clean.includes('TLAXCALA')) return 'TLAXCALA';
  if (clean.includes('NAYARIT')) return 'NAYARIT';
  if (clean.includes('COLIMA')) return 'COLIMA';
  if (clean.includes('CAMPECHE')) return 'CAMPECHE';

  return text;
}

export function normalizeMunicipality(raw: any): string {
  let text = String(raw || 'SIN MUNICIPIO').trim().toUpperCase();
  if (!text || text === 'UNDEFINED' || text === 'NULL') return 'SIN MUNICIPIO';
  return text;
}

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

export function normalizePlan(raw: any): string {
  const plan = String(raw || 'PLAN MAESTRO').trim().toUpperCase();
  return plan || 'PLAN MAESTRO';
}

export function normalizeRegion(raw: any): string {
  const region = String(raw || 'CENTRO').trim().toUpperCase();
  if (region.includes('CDMX') || region.includes('MEXICO') || region.includes('EDOMEX')) return 'CENTRO';
  if (region.includes('NUEVO LEON') || region.includes('MONTERREY') || region.includes('COAHUILA')) return 'NORTE';
  if (region.includes('QUINTANA') || region.includes('YUCATAN') || region.includes('CHIAPAS')) return 'SURESTE';
  if (region.includes('JALISCO') || region.includes('GUADALAJARA')) return 'OCCIDENTE';
  return region || 'CENTRO';
}

export interface NormalizedRow {
  projectId: string;
  projectName: string;
  format_origin: string;
  format_normalized: NormalizedFormat;
  impactoNeto: number;
  disciplina_normalizada: string;
  causa_raiz_normalizada: string;
  causaRaizOriginal: string;
  subcausa_normalizada: string;
  coordinador_normalizado: string;
  etapa_proyecto_normalizada: string;
  plan_nombre_normalizado: string;
  region_normalized: string;
  state_normalized: string;
  municipality_normalized: string;
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
  'plan',
  'fecha',
  'region',
  'estado',
  'municipio'
];

export function processExcelFile(buffer: ArrayBuffer): { data: NormalizedRow[] } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet) as any[];

  const data = rawData.map((row, idx) => {
    const rawFormat = row['formato'] || row['format'] || '';
    const rawDate = row['fecha'] || row['createdAt'] || new Date().toISOString();
    const dateObj = new Date(rawDate);
    const rawRegion = row['region'] || row['Region'] || row['Estado'] || 'CENTRO';
    const rawState = row['estado'] || row['Estado'] || row['State'] || 'CIUDAD DE MÉXICO';
    const rawMun = row['municipio'] || row['Municipio'] || row['Municipality'] || row['Ciudad'] || 'SIN MUNICIPIO';
    
    const subRaw = String(row['subcausa'] || row['Sub-causa'] || '').trim();
    const subNormalized = normalizeSubCause(subRaw);
    
    const rawRootCause = row['causaRaiz'] || row['causa_raiz'] || row['Causa Raíz'] || '';

    return {
      ...row,
      projectId: String(row['projectId'] || row['PID'] || row['Folio'] || ''),
      projectName: String(row['projectName'] || row['Nombre'] || ''),
      format_origin: rawFormat,
      format_normalized: normalizeFormatName(rawFormat),
      impactoNeto: parseFloat(row['impactoNeto'] || row['Monto'] || '0'),
      coordinador_normalizado: normalizeCoordinator(row['coordinador'] || row['Coordinador']),
      etapa_proyecto_normalizada: normalizeStage(row['etapa'] || row['Etapa']),
      plan_nombre_normalizado: normalizePlan(row['plan'] || row['Plan']),
      region_normalized: normalizeRegion(rawRegion),
      state_normalized: normalizeState(rawState),
      municipality_normalized: normalizeMunicipality(rawMun),
      disciplina_normalizada: normalizeDiscipline(row['disciplina'] || row['Disciplina'], subNormalized),
      subcausa_normalizada: subNormalized,
      causaRaizOriginal: String(rawRootCause).trim(),
      causa_raiz_normalizada: normalizeRootCause(rawRootCause),
      year: isNaN(dateObj.getFullYear()) ? new Date().getFullYear() : dateObj.getFullYear(),
      month: isNaN(dateObj.getMonth()) ? new Date().getMonth() + 1 : dateObj.getMonth() + 1,
      rowNumber: idx + 2
    } as NormalizedRow;
  });

  return { data };
}
