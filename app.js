/* global Chart */

// Detectamos si estamos en la página de herramientas interactivas
const isToolsPage = document.body.classList.contains('page-tools');
const isDatosPage = document.body.classList.contains('page-datos');
const isDetallePage = document.body.classList.contains('page-detalle');
const isLabPage = document.body.classList.contains('page-laboratorio');
const isConstructorPage = document.body.classList.contains('page-editor');

// ─── Configuración de series ──────────────────────────────────────────────────

const SERIES = [
  {
    id:       'tc-oficial',
    slug:     'dolar-oficial',
    descripcion: 'Cotización del dólar oficial en Argentina: serie histórica actualizada con gráfico interactivo. Seguí la evolución del tipo de cambio oficial día a día.',
    titulo:   'Tipo de Cambio Oficial',
    categoria: 'Mercado Cambiario',
    fuente:   'bluelytics',
    tipo_tc:  'oficial',
    unidad:   '$/USD',
    color:    '#2563eb',
    dias:     90,
    diasFree: 30,
    premium:  false,
    principal: true,
    compraventa: true,
  },
  {
    id:      'tc-blue',
    slug:    'dolar-blue',
    descripcion: 'Cotización del dólar blue en Argentina: serie histórica y evolución diaria del dólar paralelo, con gráfico interactivo.',
    titulo:  'Dólar Blue',
    categoria: 'Mercado Cambiario',
    fuente:  'bluelytics',
    tipo_tc: 'blue',
    unidad:  '$/USD',
    color:   '#059669',
    dias:    90,
    premium: false,
  },
  {
    id:        'inflacion',
    slug:      'inflacion-mensual',
    descripcion: 'Inflación mensual de Argentina (IPC INDEC): serie histórica de la variación de precios mes a mes, con gráfico interactivo.',
    titulo:    'Inflación Mensual (IPC)',
    categoria: 'Precios e Inflación',
    fuente:    'indec',
    serieId:   '148.3_INIVELNAL_DICI_M_26',
    unidad:    '%',
    color:     '#dc2626',
    meses:     24,
    mesesFree: 12,
    tipo:      'bar',
    variacion: true,
    premium:   false,
    principal: true,
  },
  {
    id:       'emae',
    slug:     'actividad-economica-emae',
    descripcion: 'Actividad económica de Argentina (EMAE INDEC): serie histórica del Estimador Mensual de Actividad Económica, estacional y desestacionalizada.',
    titulo:   'Actividad Económica (EMAE)',
    categoria: 'Actividad Económica',
    fuente:   'emae',
    seriesEmae: {
      estacional: '143.3_NO_PR_2004_A_21',  // EMAE serie original, base 2004
      desest:     '143.3_NO_PR_2004_A_31',  // EMAE desestacionalizada, base 2004
    },
    anioBase: 2004,
    unidad:   'índice',
    color:    '#0e7490',
    meses:    36,
    premium:  false,
    emaeMultivista: true,
    mensual:  true,
  },
  {
    id:        'icc-ditella',
    slug:      'confianza-del-consumidor',
    descripcion: 'Índice de Confianza del Consumidor (UTDT) en Argentina: variación mensual y serie histórica, con gráfico interactivo.',
    titulo:    'Confianza del Consumidor (Var. Mensual)',
    categoria: 'Confianza y Expectativas',
    fuente:    'local',
    serieId:   'icc',
    unidad:    '%',
    color:     '#ea580c',
    meses:     24,
    premium:   false,
    variacion: true,
    tipo:      'bar',
  },
  {
    id:        'ei-ditella',
    slug:      'expectativas-de-inflacion',
    descripcion: 'Expectativas de inflación de los argentinos (UTDT): serie histórica de cuánta inflación espera la gente, con gráfico interactivo.',
    titulo:    'Expectativas de Inflación (Di Tella)',
    categoria: 'Confianza y Expectativas',
    fuente:    'local',
    serieId:   'ei',
    unidad:    '%',
    color:     '#ca8a04',
    meses:     24,
    premium:   false,
  },
  {
    id:        'rem-ipc',
    slug:      'rem-inflacion-general',
    descripcion: 'Inflación general esperada según el REM del BCRA (Relevamiento de Expectativas de Mercado): proyecciones de analistas, serie histórica.',
    titulo:    'Inflación General (REM)',
    categoria: 'Relevamiento de Expectativas de Mercado (REM)',
    fuente:    'local',
    serieId:   'rem-ipc',
    unidad:    '%',
    color:     '#f43f5e',
    meses:     24,
    premium:   false
  },
  {
    id:        'rem-ipc-nucleo',
    slug:      'rem-inflacion-nucleo',
    descripcion: 'Inflación núcleo esperada según el REM del BCRA: proyecciones de los analistas de mercado, serie histórica con gráfico interactivo.',
    titulo:    'Inflación Núcleo (REM)',
    categoria: 'Relevamiento de Expectativas de Mercado (REM)',
    fuente:    'local',
    serieId:   'rem-ipc-nucleo',
    unidad:    '%',
    color:     '#fb7185',
    meses:     24,
    premium:   false
  },
  {
    id:        'rem-pib',
    slug:      'rem-pib',
    descripcion: 'Evolución esperada del PIB de Argentina según el REM del BCRA: proyecciones de crecimiento de los analistas, serie histórica.',
    titulo:    'Evolución del PIB (REM)',
    categoria: 'Relevamiento de Expectativas de Mercado (REM)',
    fuente:    'local',
    serieId:   'rem-pib',
    unidad:    '%',
    color:     '#10b981',
    meses:     24,
    premium:   false
  },
  {
    id:        'rem-tcn',
    slug:      'rem-tipo-de-cambio',
    descripcion: 'Tipo de cambio nominal esperado según el REM del BCRA: proyección del dólar de los analistas de mercado, serie histórica.',
    titulo:    'Tipo de Cambio Nominal (REM)',
    categoria: 'Relevamiento de Expectativas de Mercado (REM)',
    fuente:    'local',
    serieId:   'rem-tcn',
    unidad:    '$/USD',
    color:     '#3b82f6',
    meses:     24,
    premium:   false
  },
  {
    id:        'rem-badlar',
    slug:      'rem-tasa-badlar',
    descripcion: 'Tasa TAMAR esperada según el REM del BCRA: proyección de la tasa de interés de los analistas de mercado, serie histórica.',
    titulo:    'Tasa TAMAR (REM)',
    categoria: 'Relevamiento de Expectativas de Mercado (REM)',
    fuente:    'local',
    serieId:   'rem-badlar',
    unidad:    '%',
    color:     '#f59e0b',
    meses:     24,
    premium:   false
  },
  {
    id:        'rem-expo',
    slug:      'rem-exportaciones',
    descripcion: 'Exportaciones FOB esperadas según el REM del BCRA: proyección del comercio exterior de los analistas, serie histórica.',
    titulo:    'Exportaciones FOB (REM)',
    categoria: 'Relevamiento de Expectativas de Mercado (REM)',
    fuente:    'local',
    serieId:   'rem-expo',
    unidad:    'M USD',
    color:     '#0891b2',
    meses:     24,
    premium:   false
  },
  {
    id:        'rem-impo',
    slug:      'rem-importaciones',
    descripcion: 'Importaciones CIF esperadas según el REM del BCRA: proyección del comercio exterior de los analistas, serie histórica.',
    titulo:    'Importaciones CIF (REM)',
    categoria: 'Relevamiento de Expectativas de Mercado (REM)',
    fuente:    'local',
    serieId:   'rem-impo',
    unidad:    'M USD',
    color:     '#0369a1',
    meses:     24,
    premium:   false
  },
  {
    id:        'rem-desocupacion',
    slug:      'rem-desocupacion',
    descripcion: 'Desocupación esperada según el REM del BCRA: proyección de la tasa de desempleo de los analistas, serie histórica.',
    titulo:    'Desocupación (REM)',
    categoria: 'Relevamiento de Expectativas de Mercado (REM)',
    fuente:    'local',
    serieId:   'rem-desocupacion',
    unidad:    '%',
    color:     '#64748b',
    meses:     24,
    premium:   false
  },
  {
    id:        'rem-resultado',
    slug:      'rem-resultado-primario',
    descripcion: 'Resultado primario fiscal esperado según el REM del BCRA: proyección de las cuentas públicas de los analistas, serie histórica.',
    titulo:    'Resultado Primario (REM)',
    categoria: 'Relevamiento de Expectativas de Mercado (REM)',
    fuente:    'local',
    serieId:   'rem-resultado',
    unidad:    'Miles M ARS',
    color:     '#06b6d4',
    meses:     24,
    premium:   false
  },
  {
    id:        'reservas-bcra',
    slug:      'reservas-internacionales',
    descripcion: 'Reservas internacionales del BCRA: serie histórica de las reservas en dólares del Banco Central de Argentina, con gráfico interactivo.',
    titulo:    'Reservas Internacionales',
    categoria: 'Banco Central',
    fuente:    'bcra',
    serieId:   1, // El ID 1 corresponde a Reservas Internacionales
    unidad:    'M USD',
    color:     '#0284c7',
    dias:      365,
    diasFree:  90,
    premium:   false,
    principal: true,
  },
  {
    id:        'base-monetaria',
    slug:      'base-monetaria',
    descripcion: 'Base monetaria de Argentina: serie histórica del dinero emitido por el BCRA, con gráfico interactivo y datos para descargar.',
    titulo:    'Base Monetaria',
    categoria: 'Banco Central',
    fuente:    'bcra',
    serieId:   15, // ID 15: Base Monetaria - Total
    unidad:    'M ARS',
    color:     '#1e40af',
    dias:      365,
    diasFree:  90,
    premium:   false
  },
  {
    id:        'tasa-badlar',
    slug:      'tasa-badlar',
    descripcion: 'Tasa BADLAR de bancos privados (BCRA): serie histórica de la tasa de interés de referencia, con gráfico interactivo.',
    titulo:    'Tasa BADLAR (Bancos Privados)',
    categoria: 'Sistema Financiero',
    fuente:    'bcra',
    serieId:   8,  // ID 8: BADLAR en pesos de bancos privados
    unidad:    '%',
    color:     '#14b8a6',
    dias:      365,
    diasFree:  90,
    premium:   false // Podés ponerlo en 'true' si querés que sea solo para registrados
  },
  {
    id:        'tc-mayorista',
    slug:      'dolar-mayorista',
    descripcion: 'Dólar mayorista (Com. A3500 del BCRA) en Argentina: serie histórica del tipo de cambio mayorista, con gráfico interactivo.',
    titulo:    'Tipo de Cambio Mayorista',
    categoria: 'Mercado Cambiario',
    fuente:    'bcra',
    serieId:   4,  // ID 4: Dólar Mayorista Com. A3500
    unidad:    '$/USD',
    color:     '#3b82f6',
    dias:      90,
    premium:   false
  },
  {
    id:        'oro-usd',
    slug:      'precio-del-oro',
    descripcion: 'Precio del oro (futuro COMEX en USD/oz): serie histórica de la cotización internacional del oro, con gráfico interactivo.',
    titulo:    'Precio del Oro',
    categoria: 'Commodities',
    fuente:    'local',
    ventana:   true,
    serieId:   'oro',
    unidad:    'USD/oz',
    color:     '#d97706',
    dias:      365,
    premium:   false,
  },
  {
    id:        'soja',
    slug:      'precio-soja',
    descripcion: 'Precio internacional de la soja (futuro CBOT ZS=F) en USD por tonelada métrica: serie histórica diaria actualizada.',
    titulo:    'Soja (Chicago)',
    categoria: 'Commodities',
    fuente:    'local',
    ventana:   true,
    serieId:   'soja',
    unidad:    'USD/tn',
    color:     '#65a30d',
    dias:      365,
    premium:   false,
  },
  {
    id:        'wti',
    slug:      'petroleo-wti',
    descripcion: 'Precio del petróleo WTI (West Texas Intermediate, futuro NYMEX CL=F) en USD por barril: serie histórica diaria actualizada.',
    titulo:    'Petróleo WTI',
    categoria: 'Commodities',
    fuente:    'local',
    ventana:   true,
    serieId:   'wti',
    unidad:    'USD/barril',
    color:     '#78350f',
    dias:      365,
    premium:   false,
  },
  {
    id:        'brent',
    slug:      'petroleo-brent',
    descripcion: 'Precio del petróleo Brent (futuro ICE BZ=F) en USD por barril: serie histórica diaria actualizada.',
    titulo:    'Petróleo Brent',
    categoria: 'Commodities',
    fuente:    'local',
    ventana:   true,
    serieId:   'brent',
    unidad:    'USD/barril',
    color:     '#92400e',
    dias:      365,
    premium:   false,
  },
  // ─── Nuevos indicadores ───────────────────────────────────────────────────────
  {
    id:        'riesgo-pais',
    slug:      'riesgo-pais',
    descripcion: 'Riesgo país de Argentina (EMBI+): serie histórica del índice de riesgo país en puntos básicos, actualizado, con gráfico interactivo.',
    titulo:    'Riesgo País (EMBI+)',
    categoria: 'Mercado de Capitales',
    fuente:    'argentinadatos',
    serieId:   'finanzas/indices/riesgo-pais',
    unidad:    'puntos básicos',
    color:     '#ef4444',
    dias:      730,
    premium:   false,
    principal: true,
  },
  {
    id:        'merval-ars',
    slug:      'merval',
    descripcion: 'Índice Merval de la Bolsa de Buenos Aires: serie histórica de la cotización del principal índice bursátil argentino, con gráfico interactivo.',
    titulo:    'Merval',
    categoria: 'Mercado de Capitales',
    fuente:    'local',
    ventana:   true,
    serieId:   'merval',
    unidad:    'ARS',
    color:     '#0d9488',
    dias:      365,
    premium:   false,
  },
  {
    id:        'inflacion-anual',
    slug:      'inflacion-interanual',
    descripcion: 'Inflación interanual de Argentina (IPC): serie histórica de la variación de precios respecto a 12 meses atrás, con gráfico interactivo.',
    titulo:    'Inflación Interanual (IPC)',
    categoria: 'Precios e Inflación',
    fuente:    'bcra',
    serieId:   28,
    unidad:    '%',
    color:     '#be123c',
    dias:      730,
    premium:   false,
    tipo:      'bar',
  },
  {
    id:        'tasa-plazo-fijo',
    slug:      'tasa-plazo-fijo',
    descripcion: 'Tasa de plazo fijo a 30 días en Argentina (BCRA): serie histórica de la tasa de interés para depósitos, con gráfico interactivo.',
    titulo:    'Tasa Plazo Fijo (30 días)',
    categoria: 'Sistema Financiero',
    fuente:    'bcra',
    serieId:   12,
    unidad:    '% anual',
    color:     '#f97316',
    dias:      365,
    premium:   false,
  },
  {
    id:        'recaudacion-total',
    slug:      'recaudacion-total',
    descripcion: 'Recaudación tributaria total de ARCA (ex AFIP) en Argentina: serie histórica mensual en millones de pesos, con gráfico interactivo.',
    titulo:    'Recaudación Total (ARCA)',
    categoria: 'Finanzas Públicas',
    fuente:    'indec',
    serieId:   '172.3_TL_RECAION_M_0_0_17',
    unidad:    'M ARS',
    color:     '#7c3aed',
    meses:     36,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'recaudacion-dgi',
    slug:      'recaudacion-dgi',
    descripcion: 'Recaudación DGI (impuestos internos: IVA, Ganancias, etc.) de ARCA en Argentina: serie histórica mensual en millones de pesos.',
    titulo:    'Recaudación DGI',
    categoria: 'Finanzas Públicas',
    fuente:    'indec',
    serieId:   '172.3_SOTAL_DDGI_M_0_0_12',
    unidad:    'M ARS',
    color:     '#6d28d9',
    meses:     36,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'recaudacion-dga',
    slug:      'recaudacion-aduana',
    descripcion: 'Recaudación DGA (Aduana): derechos de exportación e importación recaudados por ARCA en Argentina, serie histórica mensual en millones de pesos.',
    titulo:    'Recaudación Aduana (DGA)',
    categoria: 'Finanzas Públicas',
    fuente:    'indec',
    serieId:   '172.3_SOTAL_DDGA_M_0_0_12',
    unidad:    'M ARS',
    color:     '#4f46e5',
    meses:     36,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'recaudacion-ss',
    slug:      'recaudacion-seguridad-social',
    descripcion: 'Recaudación de Seguridad Social (aportes y contribuciones) de ARCA en Argentina: serie histórica mensual en millones de pesos.',
    titulo:    'Recaudación Seg. Social',
    categoria: 'Finanzas Públicas',
    fuente:    'indec',
    serieId:   '172.3_SRIDAD_IAL_M_0_0_16',
    unidad:    'M ARS',
    color:     '#2563eb',
    meses:     36,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'dolar-mep',
    slug:      'dolar-mep',
    descripcion: 'Cotización del dólar MEP (bursátil) en Argentina: precio de venta histórico diario, también llamado dólar bolsa. Operado a través de bonos en pesos y dólares.',
    titulo:    'Dólar MEP (Bolsa)',
    categoria: 'Mercado Cambiario',
    fuente:    'argentinadatos',
    serieId:   'cotizaciones/dolares/bolsa',
    campo:     'venta',
    unidad:    '$/USD',
    color:     '#7c3aed',
    dias:      365,
    premium:   false,
  },
  {
    id:        'dolar-ccl',
    slug:      'dolar-ccl',
    descripcion: 'Cotización del dólar contado con liquidación (CCL) en Argentina: precio de venta histórico diario. Operado a través de activos que cotizan en pesos y en el exterior.',
    titulo:    'Dólar CCL',
    categoria: 'Mercado Cambiario',
    fuente:    'argentinadatos',
    serieId:   'cotizaciones/dolares/contadoconliqui',
    campo:     'venta',
    unidad:    '$/USD',
    color:     '#9333ea',
    dias:      365,
    premium:   false,
  },
  {
    id:        'tpm',
    slug:      'tasa-politica-monetaria',
    descripcion: 'Tasa de Política Monetaria (TPM) del BCRA en Argentina: tasa de interés de referencia fijada por el Banco Central, serie histórica mensual.',
    titulo:    'Tasa de Política Monetaria',
    categoria: 'Sistema Financiero',
    fuente:    'bcra',
    serieId:   28,
    unidad:    '% anual',
    color:     '#0891b2',
    dias:      730,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'uva',
    slug:      'uva',
    descripcion: 'Evolución de la Unidad de Valor Adquisitivo (UVA) del BCRA en Argentina: serie histórica diaria del índice utilizado para ajustar créditos hipotecarios y depósitos.',
    titulo:    'UVA',
    categoria: 'Sistema Financiero',
    fuente:    'bcra',
    serieId:   31,
    unidad:    'ARS',
    color:     '#0d9488',
    dias:      730,
    premium:   false,
  },
  {
    id:        'ipi-manufacturero',
    slug:      'ipi-manufacturero',
    descripcion: 'Índice de Producción Industrial Manufacturero (IPI) de Argentina: serie histórica mensual publicada por INDEC, base 2004.',
    titulo:    'Producción Industrial (IPI)',
    categoria: 'Sector Real',
    fuente:    'indec',
    serieId:   '453.1_SERIE_ORIGNAL_0_0_14_46',
    unidad:    'Índice',
    color:     '#0f766e',
    meses:     36,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'isac',
    slug:      'isac-construccion',
    descripcion: 'Indicador Sintético de la Actividad de la Construcción (ISAC) en Argentina: serie histórica mensual publicada por INDEC, base 2004.',
    titulo:    'Actividad Constructora (ISAC)',
    categoria: 'Sector Real',
    fuente:    'indec',
    serieId:   '33.2_ISAC_NIVELRAL_0_M_18_63',
    unidad:    'Índice',
    color:     '#0369a1',
    meses:     36,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'ipim',
    slug:      'precios-mayoristas',
    descripcion: 'Índice de Precios Internos al por Mayor (IPIM) de Argentina: variación interanual mensual publicada por INDEC, base diciembre 2015.',
    titulo:    'Precios Mayoristas (IPIM)',
    categoria: 'Precios e Inflación',
    fuente:    'indec',
    serieId:   '448.1_NIVEL_GENERAL_0_0_13_46',
    unidad:    '% i.a.',
    color:     '#9333ea',
    meses:     36,
    premium:   false,
    mensual:   true,
    variacion: true,
  },
  {
    id:        'salarios-total',
    slug:      'indice-salarios',
    descripcion: 'Índice de Salarios total de Argentina: evolución mensual del nivel salarial (privado registrado, no registrado y público), publicado por INDEC. Base octubre 2016.',
    titulo:    'Índice de Salarios (Total)',
    categoria: 'Sector Real',
    fuente:    'indec',
    serieId:   '149.1_TL_INDIIOS_OCTU_0_21',
    unidad:    'Índice',
    color:     '#d97706',
    meses:     36,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'salarios-privado',
    slug:      'salarios-privado',
    descripcion: 'Índice de Salarios del sector privado registrado de Argentina: evolución mensual publicada por INDEC. Base octubre 2016.',
    titulo:    'Salarios Privados (Registrado)',
    categoria: 'Sector Real',
    fuente:    'indec',
    serieId:   '149.1_SOR_PRIADO_OCTU_0_25',
    unidad:    'Índice',
    color:     '#b45309',
    meses:     36,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'salarios-publico',
    slug:      'salarios-publico',
    descripcion: 'Índice de Salarios del sector público de Argentina: evolución mensual publicada por INDEC. Base octubre 2016.',
    titulo:    'Salarios Públicos',
    categoria: 'Sector Real',
    fuente:    'indec',
    serieId:   '149.1_SOR_PUBICO_OCTU_0_14',
    unidad:    'Índice',
    color:     '#92400e',
    meses:     36,
    premium:   false,
    mensual:   true,
  },
  // ─── Empleo ───────────────────────────────────────────────────────────────────
  {
    id:        'desocupacion',
    slug:      'tasa-desocupacion',
    descripcion: 'Tasa de desocupación de Argentina (EPH INDEC): evolución trimestral del desempleo en porcentaje de la población económicamente activa.',
    titulo:    'Tasa de Desocupación',
    categoria: 'Empleo',
    fuente:    'indec',
    serieId:   '42.3_EPH_PUNTUATAL_0_M_30',
    factor:    100,
    unidad:    '%',
    color:     '#dc2626',
    meses:     20,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'empleo-registrado',
    slug:      'empleo-registrado',
    descripcion: 'Puestos de trabajo asalariado registrado en Argentina: evolución trimestral del empleo formal del sector privado (INDEC / MTEySS).',
    titulo:    'Empleo Registrado (privado)',
    categoria: 'Empleo',
    fuente:    'indec',
    serieId:   '324.1_TOTAL_GENEADO__51',
    unidad:    'miles de puestos',
    color:     '#16a34a',
    meses:     20,
    premium:   false,
    mensual:   true,
  },
  {
    id:        'empleo-no-registrado',
    slug:      'empleo-no-registrado',
    descripcion: 'Trabajadores asalariados no registrados (informales) en Argentina: evolución trimestral según datos del MTEySS / INDEC.',
    titulo:    'Empleo No Registrado',
    categoria: 'Empleo',
    fuente:    'indec',
    serieId:   '324.1_TOTAL_GENEREG__32',
    unidad:    'miles de puestos',
    color:     '#ea580c',
    meses:     20,
    premium:   false,
    mensual:   true,
  },
];


// ─── Utilidades ───────────────────────────────────────────────────────────────
// formatFecha, isoHoy, isoHace, agregarDatos y transformarEmae viven en lib.js
// (se carga antes que app.js). Tienen tests en test/lib.test.js.

// Generador temporal de datos para series de terceros sin API pública estable
function generarMock(tipo, meses) {
  const datos = [];
  let valorActual = tipo.includes('icc') ? 42.5 : 120; // Valores iniciales lógicos
  const d = new Date();
  
  for (let i = 0; i < meses; i++) {
    const fecha = new Date(d.getFullYear(), d.getMonth() - (meses - 1 - i), 1);
    const variacion = tipo.includes('icc') ? (Math.random() * 4 - 2) : (Math.random() * 15 - 7.5);
    valorActual = Math.max(0, valorActual + variacion);
    
    datos.push({
      fecha: fecha.toISOString().split('T')[0],
      valor: +(valorActual).toFixed(2)
    });
  }
  return datos;
}

// ─── Fetch APIs ───────────────────────────────────────────────────────────────

let _bluelyticsCache = null;
const _bluelyticsCV = {};  // { oficial: {compra, venta}, blue: {compra, venta} }

async function fetchBluelytics(tipo, dias) {
  if (!_bluelyticsCache) {
    const res = await fetch('https://api.bluelytics.com.ar/v2/evolution.json');
    if (!res.ok) throw new Error(`Bluelytics HTTP ${res.status}`);
    _bluelyticsCache = await res.json();
  }
  const filtrado = _bluelyticsCache
    .filter(d => d.source.toLowerCase() === tipo.toLowerCase())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-dias);
  if (filtrado.length) {
    const last = filtrado[filtrado.length - 1];
    _bluelyticsCV[tipo] = { compra: last.value_buy, venta: last.value_sell };
  }
  return filtrado.map(d => ({ fecha: d.date, valor: (d.value_sell + d.value_buy) / 2 }));
}

async function fetchIndec(serieId, meses) {
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${serieId}&limit=${meses}&sort=desc&format=json`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`INDEC HTTP ${res.status}`);
  const json = await res.json();
  return (json.data || [])
    .map(([fecha, valor]) => ({ fecha, valor }))
    .reverse();
}

async function fetchBcra(idVariable, dias) {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - dias);

  const format = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // La API v4.0 del BCRA pagina: sin "limit" devuelve como máximo 1000
  // registros por request (aunque "desde" sea mucho más viejo), y el propio
  // "limit" tiene un tope duro de 3000 (pedir más devuelve 400). Para series
  // diarias con varios años de historial (UVA, base monetaria, tasas) eso
  // trunca en silencio los datos más antiguos si no se pagina con "offset".
  const LIMIT = 3000;
  const MAX_PAGINAS = 5; // cubre ~40.000 registros diarios — de sobra para cualquier serie del catálogo
  let detalle = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const offset = pagina * LIMIT;
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${idVariable}?desde=${format(desde)}&hasta=${format(hasta)}&limit=${LIMIT}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`BCRA HTTP ${res.status}`);
    const json = await res.json();
    const pagina_detalle = json.results?.[0]?.detalle || [];
    detalle = detalle.concat(pagina_detalle);
    const total = json.metadata?.resultset?.count ?? detalle.length;
    if (detalle.length >= total || pagina_detalle.length < LIMIT) break;
  }

  return detalle
    .map(d => ({ fecha: d.fecha, valor: d.valor }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// EMAE: trae las dos series (con estacionalidad + desestacionalizada) y las cachea.
// Devuelve { estacional: [...], desest: [...] } con índices mensuales base 2004.
let _emaeCache = null;

async function fetchEmae(seriesEmae) {
  if (_emaeCache) return _emaeCache;
  const ids = `${seriesEmae.estacional},${seriesEmae.desest}`;
  const url = `https://apis.datos.gob.ar/series/api/series/?ids=${ids}&limit=5000&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`INDEC HTTP ${res.status}`);
  const json = await res.json();
  const estacional = [];
  const desest = [];
  (json.data || []).forEach(([fecha, vEst, vDes]) => {
    if (vEst != null) estacional.push({ fecha, valor: +vEst.toFixed(2) });
    if (vDes != null) desest.push({ fecha, valor: +vDes.toFixed(2) });
  });
  if (!estacional.length && !desest.length) throw new Error('Sin datos de EMAE.');
  _emaeCache = { estacional, desest };
  return _emaeCache;
}

async function fetchLocal(serieId, dias = null) {
  // Ruta root-absoluta: funciona tanto en las páginas de la raíz como en las
  // URLs limpias anidadas (/indicador/<slug>), donde 'data/...' relativo daría 404.
  const res = await fetch(`/data/${serieId}.json`);
  if (!res.ok) throw new Error(`No se encontró /data/${serieId}.json`);
  const data = await res.json();
  if (dias == null) return data;
  const desde = isoHace(dias);
  return data.filter(d => (d.fecha || '').split('T')[0] >= desde);
}

async function fetchArgentinaDatos(endpoint, dias, campo = 'valor') {
  const res = await fetch(`https://api.argentinadatos.com/v1/${endpoint}`);
  if (!res.ok) throw new Error(`ArgentinaDatos HTTP ${res.status}`);
  const data = await res.json();
  const desde = isoHace(dias);
  return data
    .filter(d => d.fecha >= desde)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(d => ({ fecha: d.fecha, valor: d[campo] ?? d.valor }));
}




// ─── Hero stats ───────────────────────────────────────────────────────────────

function inicializarHeroStats(lista = SERIES) {
  const container = document.getElementById('hero-stats');
  if (!container) return;
  container.innerHTML = '';

  const tile = serie => {
    const div = document.createElement('div');
    div.className = 'hero-stat';
    div.id = `hstat-${serie.id}`;
    div.innerHTML = `
      <div class="hero-stat-label">${serie.titulo}</div>
      <div class="hero-stat-value placeholder" id="hval-${serie.id}">—</div>
      <div class="hero-stat-unit">${serie.unidad}</div>
      ${serie.compraventa ? `<div class="hero-stat-cv" id="hcv-${serie.id}"></div>` : ''}
      <div class="hero-stat-fecha" id="hfecha-${serie.id}"></div>
      <div class="hero-stat-delta" id="hdelta-${serie.id}"></div>
    `;
    return div;
  };

  // Si la lista trae principales + resto (caso Datos), mostramos los principales
  // y el resto detrás de una cajita-flecha desplegable. Si no (caso Inicio, que
  // ya manda solo los principales), se muestran todos planos.
  const principales = lista.filter(s => s.principal);
  const ocultos = principales.length ? lista.filter(s => !s.principal) : [];
  const visibles = principales.length ? principales : lista;

  visibles.forEach(s => container.appendChild(tile(s)));

  if (ocultos.length) {
    const wrap = document.createElement('span');
    wrap.id = 'hero-stats-resto';
    ocultos.forEach(s => wrap.appendChild(tile(s)));
    container.appendChild(wrap);

    const btn = document.createElement('button');
    btn.className = 'hero-stats-toggle';
    btn.setAttribute('aria-label', 'Ver todos los valores');
    btn.innerHTML = '<span class="chev">▾</span>';
    btn.onclick = () => {
      const abierto = wrap.classList.toggle('abierto');
      btn.classList.toggle('abierto', abierto);
      btn.setAttribute('aria-label', abierto ? 'Ver menos valores' : 'Ver todos los valores');
    };
    container.appendChild(btn);
  }
}

// Sesgo económico: el color del delta refleja si la variación es buena (verde)
// o mala (roja) para la economía, NO el signo matemático. La flecha ▲/▼ igual
// muestra la dirección real del dato.
//  - SESGO_BAJA: bajar es bueno (dólar, inflación, riesgo país, desempleo...).
//  - SESGO_NEUTRAL: sin lectura buena/mala (commodities, tasas, base monetaria).
//  - El resto: subir es bueno (reservas, actividad, Merval, exportaciones...).
const SESGO_BAJA = new Set([
  'tc-oficial', 'tc-blue', 'tc-mayorista', 'inflacion', 'inflacion-anual',
  'ei-ditella', 'rem-ipc', 'rem-ipc-nucleo', 'rem-tcn', 'rem-desocupacion', 'riesgo-pais',
]);
const SESGO_NEUTRAL = new Set([
  'oro-usd', 'base-monetaria', 'tasa-badlar', 'tasa-plazo-fijo', 'rem-badlar', 'rem-impo',
]);

function formatFechaHero(fechaISO, mensual) {
  const [anio, mes, dia] = fechaISO.slice(0, 10).split('-').map(Number);
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  if (mensual) return `${MESES[mes - 1]}. ${anio}`;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = new Date(anio, mes - 1, dia);
  const diff = Math.round((hoy - fecha) / 86400000);
  const dd = String(dia).padStart(2, '0');
  const mm = String(mes).padStart(2, '0');
  return `${dd}/${mm}`;
}

function actualizarHeroStat(serie, datos) {
  const el = document.getElementById(`hval-${serie.id}`);
  if (!el) return;
  const ultimo = datos[datos.length - 1];
  const decimalesHero = Math.abs(ultimo.valor) >= 1000 ? 0 : 2;
  el.textContent = ultimo.valor.toLocaleString('es-AR', { maximumFractionDigits: decimalesHero });
  el.classList.remove('placeholder');
  const len = el.textContent.length;
  el.style.fontSize = len > 11 ? '1.1rem' : len > 8 ? '1.35rem' : '';

  const felEl = document.getElementById(`hfecha-${serie.id}`);
  if (felEl) felEl.textContent = formatFechaHero(ultimo.fecha, !!serie.mensual);

  const d = document.getElementById(`hdelta-${serie.id}`);
  if (!d) return;
  const prev = datos.length >= 2 ? datos[datos.length - 2].valor : null;
  if (prev == null || !isFinite(prev) || prev === 0) {
    d.textContent = '';
    d.className = 'hero-stat-delta';
    return;
  }
  // Series que ya son una tasa en % (ej. inflación): variación en puntos
  // porcentuales (pp). El resto: variación relativa en %.
  const esTasa = !!serie.variacion;
  const delta = esTasa ? (ultimo.valor - prev) : (ultimo.valor / prev - 1) * 100;
  const suf = esTasa ? ' pp' : '%';
  const txt = Math.abs(delta).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const sube = delta > 0;

  // Color por lógica económica (no por signo).
  let cls;
  if (Math.abs(delta) < 0.005 || SESGO_NEUTRAL.has(serie.id)) {
    cls = 'neutral';
  } else {
    const bueno = SESGO_BAJA.has(serie.id) ? !sube : sube;
    cls = bueno ? 'buena' : 'mala';
  }
  d.textContent = `${Math.abs(delta) < 0.005 ? '=' : (sube ? '▲' : '▼')} ${txt}${suf}`;
  d.className = 'hero-stat-delta ' + cls;
}


// ─── Cards ────────────────────────────────────────────────────────────────────

function crearCard(serie) {
  const div = document.createElement('div');
  div.className = 'card';
  div.id = `card-${serie.id}`;
  div.style.setProperty('--card-color', serie.color);

  // Hacemos que la tarjeta sea clickeable y redirija a detalle.html
  if (!isToolsPage) {
    div.style.cursor = 'pointer';
    div.title = 'Ver gráfico ampliado';
    // Accesibilidad: navegable por teclado y anunciada como enlace
    div.setAttribute('role', 'link');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `Ver detalle de ${serie.titulo}`);
    div.addEventListener('mouseenter', () => div.style.transform = 'translateY(-4px)');
    div.addEventListener('mouseleave', () => div.style.transform = 'translateY(0)');
    div.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
    const irADetalle = (e) => {
      if (e.target.tagName.toLowerCase() === 'button' || e.target.tagName.toLowerCase() === 'input') return;
      window.location.href = `/indicador/${serie.slug || serie.id}`;
    };
    div.onclick = irADetalle;
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irADetalle(e); }
    });
  }

  div.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">
        ${serie.titulo}
        ${isToolsPage ? `<button id="btn-export-${serie.id}" style="display: none; margin-left: 8px; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; cursor: pointer; border: 1px solid #cbd5e1; background: transparent; color: inherit;" title="Descargar datos en CSV">⬇️ CSV</button>` : ''}
      </h2>
      <span class="badge muted" id="badge-${serie.id}">Cargando…</span>
    </div>
    <div class="card-meta" id="meta-${serie.id}"></div>
    ${isToolsPage ? `
    <div class="card-controls" id="controls-${serie.id}" style="padding: 0.25rem 1rem 0.75rem; font-size: 0.8rem; display: none; gap: 1rem; align-items: center; flex-wrap: wrap; border-bottom: 1px solid #f1f5f9;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <label style="font-weight: 500;">Agrupar</label>
        <div class="btn-group" id="agg-group-${serie.id}"></div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 280px;">
        <label style="font-weight: 500;">Período</label>
        <input type="date" id="start-date-${serie.id}" style="padding: 2px 4px; border-radius: 4px; border: 1px solid #e2e8f0; outline: none; flex: 1;">
        <span class="muted">→</span>
        <input type="date" id="end-date-${serie.id}" style="padding: 2px 4px; border-radius: 4px; border: 1px solid #e2e8f0; outline: none; flex: 1;">
      </div>
    </div>
    ` : ''}
    <div class="chart-wrap" id="wrap-${serie.id}">
      <div class="skeleton"></div>
    </div>
  `;
  return div;
}



// ─── Charts ───────────────────────────────────────────────────────────────────

const charts = {};

// Plugin inline: dibuja crosshair vertical + punto de valor al hover
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    const active = chart.tooltip._active;
    if (!active || !active.length) return;
    const { ctx, chartArea: { top, bottom } } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(100,116,139,0.35)';
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.restore();
  },
};

function renderChart(serie, datos) {
  const wrap = document.getElementById(`wrap-${serie.id}`);
  wrap.innerHTML = '<canvas></canvas>';
  const canvas = wrap.querySelector('canvas');

  if (charts[serie.id]) charts[serie.id].destroy();

  if (!datos || datos.length === 0) {
    wrap.innerHTML = `<div class="chart-error" style="padding: 2rem 1rem;">No hay datos para el período seleccionado.</div>`;
    document.getElementById(`badge-${serie.id}`).textContent = 'Sin datos';
    return;
  }

  const tipo      = serie.tipo || 'line';
  const labels    = datos.map(d => formatFecha(d.fecha, serie));
  const values    = datos.map(d => d.valor);
  const enDetalle = isDetallePage || isToolsPage;

  // Nombre accesible para lectores de pantalla
  const ultimo = datos[datos.length - 1];
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    `Gráfico de ${serie.titulo}. Último valor: ${ultimo.valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${serie.unidad}, ${formatFecha(ultimo.fecha, serie)}.`);

  if (enDetalle) {
    canvas.style.cursor = 'grab';
    canvas.addEventListener('mousedown', () => { canvas.style.cursor = 'grabbing'; });
    canvas.addEventListener('mouseup',   () => { canvas.style.cursor = 'grab'; });
    // Doble clic para resetear zoom
    canvas.addEventListener('dblclick', () => resetZoom(serie.id));
  }

  charts[serie.id] = new Chart(canvas, {
    type:    tipo,
    plugins: enDetalle ? [crosshairPlugin] : [],
    data: {
      labels,
      datasets: [{
        data:            values,
        borderColor:     serie.color,
        backgroundColor: tipo === 'bar' ? serie.color + 'bb' : serie.color + '18',
        borderWidth:     tipo === 'bar' ? 0 : 2,
        borderRadius:    tipo === 'bar' ? 3 : 0,
        pointRadius:     0,
        pointHoverRadius: enDetalle ? 5 : 0,
        pointHoverBackgroundColor: serie.color,
        pointHoverBorderColor:     '#fff',
        pointHoverBorderWidth:     2,
        tension:         0.3,
        fill:            tipo !== 'bar',
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           { duration: 400 },
      interaction: {
        mode:      'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: 'rgba(15,23,42,0.85)',
          padding:         10,
          cornerRadius:    8,
          titleFont:       { size: 11, weight: '500' },
          bodyFont:        { size: 13, weight: '600' },
          callbacks: {
            title: ctx => ctx[0].label,
            label: ctx =>
              `${ctx.parsed.y.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${serie.unidad}`,
          },
        },
        zoom: {
          zoom: {
            wheel:          { enabled: true, speed: 0.12 },
            pinch:          { enabled: true },
            mode:           'x',
            onZoomComplete: () => mostrarResetZoom(serie.id),
          },
          pan: {
            enabled:       enDetalle,
            mode:          'x',
            onPanComplete: () => mostrarResetZoom(serie.id),
          },
          limits: { x: { min: 'original', max: 'original' } },
        },
      },
      scales: {
        x: {
          // Las tarjetas mini (home, "Indicadores destacados") son mucho más
          // angostas que el gráfico de detalle; con el mismo límite de 6 ticks
          // las fechas se superponen y quedan ilegibles.
          ticks:  { maxTicksLimit: enDetalle ? 6 : 4, maxRotation: 0, font: { size: 10 } },
          grid:   { display: false },
          border: { display: false },
        },
        y: {
          ticks: {
            font: { size: 10 },
            callback: (v, i, ticks) => formatTickEje(v, ticks),
          },
          grid:   { color: '#f1f5f9' },
          border: { display: false },
        },
      },
    },
  });
}

function mostrarResetZoom(serieId) {
  const hint = document.getElementById(`hint-zoom-${serieId}`);
  if (hint) { hint.style.transition = 'opacity .4s'; hint.style.opacity = '0'; }
}

function resetZoom(serieId) {
  const chart = charts[serieId];
  if (chart) chart.resetZoom();
  const hint = document.getElementById(`hint-zoom-${serieId}`);
  if (hint) hint.style.opacity = '1';
}

function descargarPNG(serieId, titulo) {
  const chart = charts[serieId];
  if (!chart) return;

  // Se exporta a mayor densidad de píxeles que la pantalla (no solo se
  // agranda el canvas ya dibujado, se le pide a Chart.js que vuelva a
  // trazar todo —líneas, texto— a más resolución), así se ve nítido si
  // después se lo agranda o se lo inserta en un informe.
  const ESCALA_EXPORT = 2;
  const dprOriginal = chart.options.devicePixelRatio;
  chart.options.devicePixelRatio = (dprOriginal || window.devicePixelRatio || 1) * ESCALA_EXPORT;
  chart.resize();

  // Fondo blanco: el canvas es transparente por defecto y queda feo en PNG
  const canvas = chart.canvas;
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const ctx = tmp.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tmp.width, tmp.height);
  ctx.drawImage(canvas, 0, 0);

  const link = document.createElement('a');
  const slug = (titulo || serieId).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  link.download = `macroar-${slug}.png`;
  link.href = tmp.toDataURL('image/png');
  link.click();

  // Restaurar la resolución normal de pantalla (si no, el gráfico queda
  // pesado/lento de renderizar en cada interacción).
  chart.options.devicePixelRatio = dprOriginal;
  chart.resize();
}


// ─── Controles de Gráfico ─────────────────────────────────────────────────────

const rawDataStore = {};

function setupChartControls(serie, datos) {
  if (!isToolsPage && !isDetallePage) return; // Si no es herramientas ni detalle, salimos
  if (serie.emaeMultivista) return setupEmaeControls(serie, datos);

  const controlsContainer = document.getElementById(`controls-${serie.id}`);
  const aggGroup = document.getElementById(`agg-group-${serie.id}`);
  const startDateInput = document.getElementById(`start-date-${serie.id}`);
  const endDateInput = document.getElementById(`end-date-${serie.id}`);

  // 1. Poblar botones de agregación
  aggGroup.innerHTML = '';
  const esSerieMensual = serie.fuente === 'indec';
  const periodosDisponibles = esSerieMensual
    ? [['mensual_orig', 'Mensual'], ['trimestral', 'Trimestral'], ['anual', 'Anual']]
    : [['diario', 'Diario'], ['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['anual', 'Anual']];

  periodosDisponibles.forEach(([key, label], index) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.dataset.agg = key;
    Object.assign(btn.style, { background: 'transparent', border: '1px solid #e2e8f0', padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem' });
    if (index === 0) btn.style.borderRadius = '6px 0 0 6px';
    if (index === periodosDisponibles.length - 1) btn.style.borderRadius = '0 6px 6px 0';
    if (index > 0) btn.style.borderLeft = 'none';

    btn.onclick = () => {
      aggGroup.querySelectorAll('button').forEach(b => { b.style.background = 'transparent'; b.style.color = 'inherit'; });
      btn.style.background = '#e2e8f0';
      btn.style.color = '#1e293b';
      actualizarGrafico(serie.id);
    };
    aggGroup.appendChild(btn);
  });
  aggGroup.firstChild.style.background = '#e2e8f0';
  aggGroup.firstChild.style.color = '#1e293b';

  // 1.5 Lectura: Niveles / Variación % — no aplica a series que ya son una
  // tasa (serie.variacion, ej. IPC), esas ya se muestran en % de por sí.
  if (!serie.variacion) {
    let lecturaWrap = document.getElementById(`lectura-wrap-${serie.id}`);
    if (!lecturaWrap) {
      lecturaWrap = document.createElement('div');
      lecturaWrap.id = `lectura-wrap-${serie.id}`;
      lecturaWrap.style.cssText = 'display:flex; align-items:center; gap:0.5rem;';
      lecturaWrap.innerHTML = `
        <label style="font-weight:500; color:var(--navy);">Lectura:</label>
        <div class="btn-group" id="lectura-group-${serie.id}"></div>
      `;
      aggGroup.parentElement.after(lecturaWrap);
    }
    const lecturaGroup = document.getElementById(`lectura-group-${serie.id}`);
    lecturaGroup.innerHTML = '';
    [['niveles', 'Niveles'], ['variacion', 'Variación %']].forEach(([key, label], index) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.dataset.lectura = key;
      Object.assign(btn.style, { background: 'transparent', border: '1px solid #e2e8f0', padding: '3px 8px', cursor: 'pointer', fontSize: '0.75rem' });
      if (index === 0) btn.style.borderRadius = '6px 0 0 6px';
      if (index === 1) btn.style.borderRadius = '0 6px 6px 0';
      if (index > 0) btn.style.borderLeft = 'none';
      btn.onclick = () => {
        lecturaGroup.querySelectorAll('button').forEach(b => { b.style.background = 'transparent'; b.style.color = 'inherit'; });
        btn.style.background = '#e2e8f0';
        btn.style.color = '#1e293b';
        actualizarGrafico(serie.id);
      };
      lecturaGroup.appendChild(btn);
    });
    lecturaGroup.firstChild.style.background = '#e2e8f0';
    lecturaGroup.firstChild.style.color = '#1e293b';
  }

  // 2. Poblar inputs de fecha
  const minDate = datos[0].fecha.slice(0, 10);
  const maxDate = datos[datos.length - 1].fecha.slice(0, 10);
  startDateInput.min = endDateInput.min = minDate;
  startDateInput.max = endDateInput.max = maxDate;
  startDateInput.value = minDate;
  endDateInput.value = maxDate;

  // 3. Agregar listeners
  startDateInput.onchange = () => actualizarGrafico(serie.id);
  endDateInput.onchange = () => actualizarGrafico(serie.id);

  // 4. Mostrar controles
  controlsContainer.style.display = 'flex';
}

// Controles específicos del EMAE: selector de serie (estacional/desest) + lectura (índice/variaciones)
function setupEmaeControls(serie, datos) {
  const controlsContainer = document.getElementById(`controls-${serie.id}`);
  if (!controlsContainer) return;

  const grupoBotones = (groupId, opciones, activo) => {
    const botones = opciones.map(([val, label], i) => {
      const radius = i === 0 ? '6px 0 0 6px' : i === opciones.length - 1 ? '0 6px 6px 0' : '0';
      const borderLeft = i > 0 ? 'border-left:none;' : '';
      const act = val === activo;
      return `<button data-val="${val}" data-active="${act ? 1 : 0}" style="background:${act ? '#e2e8f0' : 'transparent'}; color:${act ? '#1e293b' : 'inherit'}; border:1px solid #e2e8f0; ${borderLeft} padding:3px 10px; cursor:pointer; font-size:0.75rem; border-radius:${radius}; font-family:inherit;">${label}</button>`;
    }).join('');
    return `<div class="btn-group" id="${groupId}">${botones}</div>`;
  };

  controlsContainer.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.5rem;">
      <label style="font-weight:500; color:var(--navy);">Serie:</label>
      ${grupoBotones(`emae-serie-${serie.id}`, [['desest', 'Desestacionalizada'], ['estacional', 'Con estacionalidad']], 'desest')}
    </div>
    <div style="display:flex; align-items:center; gap:0.5rem;">
      <label style="font-weight:500; color:var(--navy);">Lectura:</label>
      ${grupoBotones(`emae-lectura-${serie.id}`, [['indice', 'Índice'], ['var-mensual', 'Var. mensual'], ['var-trimestral', 'Var. trimestral'], ['var-interanual', 'Var. interanual']], 'indice')}
    </div>
    <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:280px;">
      <label style="font-weight:500; color:var(--navy);">Período:</label>
      <input type="date" id="start-date-${serie.id}" style="padding:6px 10px; border-radius:6px; border:1px solid #e2e8f0; outline:none; flex:1; font-family:inherit;">
      <span class="muted">→</span>
      <input type="date" id="end-date-${serie.id}" style="padding:6px 10px; border-radius:6px; border:1px solid #e2e8f0; outline:none; flex:1; font-family:inherit;">
    </div>
  `;

  // Listeners de los grupos de botones (toggle exclusivo + re-render)
  ['emae-serie', 'emae-lectura'].forEach(prefix => {
    const group = document.getElementById(`${prefix}-${serie.id}`);
    group.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => {
        group.querySelectorAll('button').forEach(b => {
          b.dataset.active = '0';
          b.style.background = 'transparent';
          b.style.color = 'inherit';
        });
        btn.dataset.active = '1';
        btn.style.background = '#e2e8f0';
        btn.style.color = '#1e293b';
        actualizarGrafico(serie.id);
      };
    });
  });

  // Rango de fechas sobre la serie mensual
  const startDateInput = document.getElementById(`start-date-${serie.id}`);
  const endDateInput = document.getElementById(`end-date-${serie.id}`);
  const minDate = datos[0].fecha.slice(0, 10);
  const maxDate = datos[datos.length - 1].fecha.slice(0, 10);
  startDateInput.min = endDateInput.min = minDate;
  startDateInput.max = endDateInput.max = maxDate;
  startDateInput.value = minDate;
  endDateInput.value = maxDate;
  startDateInput.onchange = () => actualizarGrafico(serie.id);
  endDateInput.onchange = () => actualizarGrafico(serie.id);

  controlsContainer.style.display = 'flex';
}

function actualizarGrafico(serieId) {
  const serie = SERIES.find(s => s.id === serieId);
  const rawData = rawDataStore[serieId];
  if (!serie || !rawData) return;

  // EMAE: ruta especial con selector de serie + lectura
  if (serie.emaeMultivista && (isToolsPage || isDetallePage)) {
    return actualizarGraficoEmae(serie);
  }

  let processedData = rawData;
  let lectura = 'niveles';

  // Solo aplicar filtros si estamos en la vista de herramientas o detalle
  if (isToolsPage || isDetallePage) {
    const aggBtn = document.querySelector(`#agg-group-${serieId} button[style*="background: rgb(226, 232, 240)"]`);
    const aggregation = aggBtn ? aggBtn.dataset.agg : 'diario';
    const startDate = document.getElementById(`start-date-${serieId}`).value;
    const endDate = document.getElementById(`end-date-${serieId}`).value;

    const filteredData = rawData.filter(d => d.fecha.slice(0, 10) >= startDate && d.fecha.slice(0, 10) <= endDate);
    processedData = agregarDatos(filteredData, aggregation);

    if (!serie.variacion) {
      const lecturaBtn = document.querySelector(`#lectura-group-${serieId} button[style*="background: rgb(226, 232, 240)"]`);
      lectura = lecturaBtn ? lecturaBtn.dataset.lectura : 'niveles';
      if (lectura === 'variacion') processedData = calcularVariacionPeriodo(processedData);
    }
  }

  const serieRender = lectura === 'variacion' ? { ...serie, unidad: '%', tipo: 'bar' } : serie;
  renderChart(serieRender, processedData);

  const badge = document.getElementById(`badge-${serie.id}`);
  if (processedData.length > 0) {
    const ultimoValor = processedData[processedData.length - 1].valor;
    const unidadBadge = lectura === 'variacion' ? '%' : serie.unidad;
    const signo = lectura === 'variacion' && ultimoValor > 0 ? '+' : '';
    badge.textContent = `${signo}${ultimoValor.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${unidadBadge}`;
  }

  if (isToolsPage || isDetallePage) {
    const btnExport = document.getElementById(`btn-export-${serieId}`);
    if (btnExport) btnExport.onclick = () => exportarCSV(serie, processedData);
  }
}

// Variación % de un período contra el anterior, sobre datos ya agregados
// (respeta la frecuencia elegida: diaria, mensual, trimestral o anual).
function calcularVariacionPeriodo(datos) {
  const out = [];
  for (let i = 1; i < datos.length; i++) {
    const prev = datos[i - 1].valor;
    if (prev) out.push({ fecha: datos[i].fecha, valor: +((datos[i].valor / prev - 1) * 100).toFixed(2) });
  }
  return out;
}

const LECTURAS_EMAE_LABEL = {
  'indice':         'Índice',
  'var-mensual':    'Variación % mensual',
  'var-trimestral': 'Variación % trimestral',
  'var-interanual': 'Variación % interanual',
};

function actualizarGraficoEmae(serie) {
  const serieId = serie.id;
  const serieSel   = document.querySelector(`#emae-serie-${serieId} button[data-active="1"]`)?.dataset.val || 'desest';
  const lecturaSel = document.querySelector(`#emae-lectura-${serieId} button[data-active="1"]`)?.dataset.val || 'indice';

  const base = (_emaeCache && _emaeCache[serieSel]) ? _emaeCache[serieSel] : rawDataStore[serieId];

  // Filtrar por fecha sobre la serie mensual ANTES de transformar (evita problemas con formato trimestral)
  const startDate = document.getElementById(`start-date-${serieId}`).value;
  const endDate   = document.getElementById(`end-date-${serieId}`).value;
  const filtrada = base.filter(d => d.fecha.slice(0, 10) >= startDate && d.fecha.slice(0, 10) <= endDate);

  const processedData = transformarEmae(filtrada, lecturaSel);

  // Serie derivada para el render: índice = línea, variaciones = barras
  const esIndice = lecturaSel === 'indice';
  const serieRender = {
    ...serie,
    unidad: esIndice ? `índice (base ${serie.anioBase}=100)` : '%',
    tipo:   esIndice ? 'line' : 'bar',
  };

  renderChart(serieRender, processedData);

  const badge = document.getElementById(`badge-${serieId}`);
  if (badge && processedData.length > 0) {
    const ultimo = processedData[processedData.length - 1].valor;
    const unidadBadge = esIndice ? `(base ${serie.anioBase}=100)` : '%';
    const signo = !esIndice && ultimo > 0 ? '+' : '';
    badge.textContent = `${signo}${ultimo.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${unidadBadge}`;
  }

  // Sublabel dinámico de la lectura
  const meta = document.getElementById(`meta-${serieId}`);
  if (meta && processedData.length > 0) {
    const ultimo = processedData[processedData.length - 1];
    const serieTxt = serieSel === 'desest' ? 'desestacionalizada' : 'con estacionalidad';
    meta.textContent = `${LECTURAS_EMAE_LABEL[lecturaSel]} · serie ${serieTxt} · último: ${formatFecha(ultimo.fecha, serie)}`;
  }

  const btnExport = document.getElementById(`btn-export-${serieId}`);
  if (btnExport) {
    btnExport.onclick = () => exportarCSVEmaeCompleto();
    btnExport.title = 'Descargar CSV con todas las lecturas (índice y variaciones, ambas series)';
  }
}

// ─── Herramientas Extras ──────────────────────────────────────────────────────

const estadoMercado = { oficial: null, blue: null };

function exportarCSV(serie, datos) {
  if (!datos || !datos.length) return;
  const cabeceras = ['Fecha', 'Valor'];
  const filas = datos.map(d => `${d.fecha},${d.valor}`);
  const csvContent = [cabeceras.join(','), ...filas].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `macroar_${serie.id}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// CSV del EMAE con TODAS las lecturas: ambas series y sus variaciones, alineadas por fecha.
function exportarCSVEmaeCompleto() {
  if (!_emaeCache) return;
  const { estacional, desest } = _emaeCache;

  const mapNivel = arr => Object.fromEntries(arr.map(d => [d.fecha.slice(0, 10), d.valor]));
  const mapVar = (arr, lag) => {
    const m = {};
    for (let i = lag; i < arr.length; i++) {
      const prev = arr[i - lag].valor;
      m[arr[i].fecha.slice(0, 10)] = prev ? +((arr[i].valor / prev - 1) * 100).toFixed(2) : '';
    }
    return m;
  };

  const estNivel = mapNivel(estacional);
  const desNivel = mapNivel(desest);
  const estVarM  = mapVar(estacional, 1);
  const estVarI  = mapVar(estacional, 12);
  const desVarM  = mapVar(desest, 1);
  const desVarI  = mapVar(desest, 12);

  const fechas = [...new Set([...estacional, ...desest].map(d => d.fecha.slice(0, 10)))].sort();

  const cabeceras = [
    'Fecha',
    'Indice_con_estacionalidad',
    'Indice_desestacionalizado',
    'Var_mensual_desest_%',
    'Var_interanual_desest_%',
    'Var_mensual_con_estacionalidad_%',
    'Var_interanual_con_estacionalidad_%',
  ];
  const filas = fechas.map(f => [
    f,
    estNivel[f] ?? '',
    desNivel[f] ?? '',
    desVarM[f]  ?? '',
    desVarI[f]  ?? '',
    estVarM[f]  ?? '',
    estVarI[f]  ?? '',
  ].join(','));

  const csv = [cabeceras.join(','), ...filas].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'macroar_emae_completo.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function crearCardCalculadora() {
  const div = document.createElement('div');
  div.className = 'card';
  div.id = 'card-calculadora';
  div.style.setProperty('--card-color', '#f59e0b'); // Color ámbar
  div.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Calculadora de Divisas</h2>
    </div>
    <div class="card-meta">Convertí ARS ↔ USD usando las cotizaciones actuales</div>
    <div class="chart-wrap" style="height: auto; padding: 1rem 0;">
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <input type="number" id="calc-monto" placeholder="Monto..." value="1000" style="flex: 1; padding: 0.5rem; border-radius: 4px; border: 1px solid #e2e8f0; outline: none; width: 50%;">
        <select id="calc-moneda" style="padding: 0.5rem; border-radius: 4px; border: 1px solid #e2e8f0; outline: none; background: #fff; width: 50%;">
          <option value="USD">Dólares (USD) a Pesos</option>
          <option value="ARS">Pesos (ARS) a Dólares</option>
        </select>
      </div>
      <div id="calc-resultados" style="font-size: 0.95rem; line-height: 1.6; background: #f8fafc; padding: 0.75rem; border-radius: 6px; border: 1px solid #e2e8f0;">
        <span class="muted">Esperando datos del mercado...</span>
      </div>
    </div>
  `;
  
  // Escuchar cambios en los inputs para recalcular automáticamente
  div.addEventListener('input', actualizarCalculadora);
  
  return div;
}

function actualizarCalculadora() {
  const montoInput = document.getElementById('calc-monto');
  const monedaInput = document.getElementById('calc-moneda');
  const resultadosDiv = document.getElementById('calc-resultados');

  if (!montoInput || !monedaInput || !resultadosDiv) return;

  const monto = parseFloat(montoInput.value) || 0;
  const modo = monedaInput.value;

  if (!estadoMercado.oficial && !estadoMercado.blue) {
    resultadosDiv.innerHTML = '<span class="muted">Esperando datos del mercado...</span>';
    return;
  }

  let html = '';
  if (modo === 'USD') { // De Dólares a Pesos
     if (estadoMercado.oficial) html += `<div style="display: flex; justify-content: space-between;"><strong>Oficial:</strong> <span>${(monto * estadoMercado.oficial).toLocaleString('es-AR', {maximumFractionDigits:2})} ARS</span></div>`;
     if (estadoMercado.blue) html += `<div style="display: flex; justify-content: space-between;"><strong>Blue:</strong> <span>${(monto * estadoMercado.blue).toLocaleString('es-AR', {maximumFractionDigits:2})} ARS</span></div>`;
  } else { // De Pesos a Dólares
     if (estadoMercado.oficial) html += `<div style="display: flex; justify-content: space-between;"><strong>Oficial:</strong> <span>${(monto / estadoMercado.oficial).toLocaleString('es-AR', {maximumFractionDigits:2})} USD</span></div>`;
     if (estadoMercado.blue) html += `<div style="display: flex; justify-content: space-between;"><strong>Blue:</strong> <span>${(monto / estadoMercado.blue).toLocaleString('es-AR', {maximumFractionDigits:2})} USD</span></div>`;
  }
  resultadosDiv.innerHTML = html;
}


// ─── Fetch de datos por fuente (sin render) ───────────────────────────────────
// Devuelve el array [{fecha, valor}] de una serie según su fuente. Reusado por
// cargarSerie (con render) y por el Laboratorio (solo datos). `completo` = true
// trae el historial entero (no acota EMAE a los últimos meses).
async function obtenerDatosSerie(serie, diasReq, mesesReq, completo) {
  const variacionPct = (raw) => raw.slice(1).map((d, i) => ({
    fecha: d.fecha,
    valor: raw[i].valor > 0 ? +((d.valor / raw[i].valor - 1) * 100).toFixed(2) : null,
  })).filter(d => d.valor !== null);

  if (serie.fuente === 'bluelytics') {
    return await fetchBluelytics(serie.tipo_tc, diasReq);
  } else if (serie.fuente === 'bcra') {
    const raw = await fetchBcra(serie.serieId, diasReq);
    return serie.variacion ? variacionPct(raw) : raw;
  } else if (serie.fuente === 'argentinadatos') {
    return await fetchArgentinaDatos(serie.serieId, diasReq, serie.campo);
  } else if (serie.fuente === 'emae') {
    const emae = await fetchEmae(serie.seriesEmae);
    let datos = emae.desest;  // por defecto: desestacionalizada
    if (!completo) datos = datos.slice(-(serie.meses || 36));
    return datos;
  } else if (serie.fuente === 'local') {
    const res = await fetch(`/data/${serie.serieId}.json`);
    if (!res.ok) throw new Error(`No se encontró /data/${serie.serieId}.json`);
    const json = await res.json();
    let raw = Array.isArray(json) ? json : (json.datos || []);
    if (!Array.isArray(json) && json.publicacion) serie._publicacion = json.publicacion;
    if (serie.ventana && diasReq) {
      const desde = isoHace(diasReq);
      raw = raw.filter(d => (d.fecha || '').split('T')[0] >= desde);
    }
    return serie.variacion ? variacionPct(raw) : raw;
  } else if (serie.fuente.startsWith('mock')) {
    return generarMock(serie.fuente, mesesReq);
  } else {
    let raw = await fetchIndec(serie.serieId, mesesReq);
    if (serie.factor) raw = raw.map(d => ({ fecha: d.fecha, valor: d.valor * serie.factor }));
    return serie.variacion ? variacionPct(raw) : raw;
  }
}

// ─── Carga de cada serie ──────────────────────────────────────────────────────

async function cargarSerie(serie) {
  const badge = document.getElementById(`badge-${serie.id}`);
  const meta  = document.getElementById(`meta-${serie.id}`);

  try {
    let diasReq = serie.dias;
    let mesesReq = serie.meses;
    const completo = isToolsPage || isDetallePage;

    if (completo) {
      diasReq  = 3650;
      mesesReq = 120;
    }

    const datos = await obtenerDatosSerie(serie, diasReq, mesesReq, completo);

    if (!datos.length) throw new Error('Sin datos disponibles');

    // Guardar datos crudos para manipulación
    rawDataStore[serie.id] = datos;

    // Actualizar elementos estáticos con el último dato disponible
    const ultimo = datos[datos.length - 1];
    const fechaMeta = serie._publicacion || ultimo.fecha;
    meta.textContent  = `Último dato: ${formatFecha(fechaMeta, serie)}`;
    actualizarHeroStat(serie, datos);
    if (serie.compraventa && _bluelyticsCV[serie.tipo_tc]) {
      const cv = _bluelyticsCV[serie.tipo_tc];
      const cvEl = document.getElementById(`hcv-${serie.id}`);
      if (cvEl) cvEl.textContent = `Compra ${cv.compra.toLocaleString('es-AR')} · Venta ${cv.venta.toLocaleString('es-AR')}`;
    }

    // Vista detalle: mostrar la fecha del último registro debajo de la categoría
    const ultimaFechaEl = document.getElementById(`ultima-fecha-${serie.id}`);
    if (ultimaFechaEl) ultimaFechaEl.textContent = `Último registro: ${formatFecha(fechaMeta, serie)}`;

    // Configurar controles y renderizar el gráfico por primera vez
    if (isToolsPage || isDetallePage) setupChartControls(serie, datos);
    actualizarGrafico(serie.id);

    if (isToolsPage || isDetallePage) {
      // Guardar los datos para usarlos en la calculadora y actualizarla
      if (serie.id === 'tc-oficial') { estadoMercado.oficial = ultimo.valor; actualizarCalculadora(); }
      if (serie.id === 'tc-blue') { estadoMercado.blue = ultimo.valor; actualizarCalculadora(); }

      const btnExport = document.getElementById(`btn-export-${serie.id}`);
      if (btnExport) btnExport.style.display = 'inline-block';

      const btnPng = document.getElementById(`btn-png-${serie.id}`);
      if (btnPng) {
        btnPng.style.display = 'inline-block';
        btnPng.onclick = () => descargarPNG(serie.id, serie.titulo);
      }
    }

  } catch (err) {
    badge.textContent = 'Error';
    badge.classList.remove('muted');
    badge.classList.add('error');
    meta.textContent = err.message;
    document.getElementById(`wrap-${serie.id}`).innerHTML = `<div class="chart-error">No se pudo cargar el indicador</div>`;
  }
}


// ─── Inicialización ───────────────────────────────────────────────────────────

function loadAll() {
  // El Laboratorio y el Editor de gráficos manejan su propia carga (laboratorio.js /
  // editor.js); app.js solo aporta SERIES + obtenerDatosSerie.
  if (isLabPage || isConstructorPage) return;

  _bluelyticsCache = null;

  const grid = document.getElementById('grid');
  const catContainer = document.getElementById('categories-container');

  if (grid) grid.innerHTML = '';
  if (catContainer) catContainer.innerHTML = '';

  if (typeof isDetallePage !== 'undefined' && isDetallePage) {
    // Las páginas pre-generadas (/indicador/<slug>) traen el id horneado en
    // data-serie-id; los links viejos siguen funcionando con ?id=.
    const params = new URLSearchParams(window.location.search);
    const serieId = document.body.dataset.serieId || params.get('id');
    const serie = SERIES.find(s => s.id === serieId || s.slug === serieId);
    
    const container = document.getElementById('detalle-content');
    if (!container) return;

    if (!serie) {
      container.innerHTML = '<p style="text-align: center; padding: 2rem;">Serie no encontrada.</p>';
      return;
    }

    // Título de pestaña dinámico por indicador (SEO + UX)
    document.title = `${serie.titulo} — MacroAr`;

    // Canonical → la URL limpia del indicador (refuerza las páginas pre-generadas
    // y canonicaliza los links viejos detalle.html?id=).
    const urlCanonica = `https://macroar.com.ar/indicador/${serie.slug || serie.id}`;
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) {
      canon = document.createElement('link');
      canon.setAttribute('rel', 'canonical');
      document.head.appendChild(canon);
    }
    canon.setAttribute('href', urlCanonica);



    container.innerHTML = `
      <div class="detalle-header">
        <h1 class="detalle-title" style="display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          ${serie.titulo}
          <button id="btn-export-${serie.id}" class="btn-export-mini" style="display: none;" title="Descargar datos en CSV">⬇️ Exportar CSV</button>
          <button id="btn-png-${serie.id}" class="btn-export-mini" style="display: none;" title="Descargar gráfico como imagen">🖼️ Descargar PNG</button>
        </h1>
        <p class="detalle-meta">
          Categoría: ${serie.categoria} · Fuente: ${serie.fuente.toUpperCase()}${serie.anioBase ? ` · Base ${serie.anioBase}=100` : ` · Unidad: ${serie.unidad}`}
        </p>
        <p class="detalle-meta" id="ultima-fecha-${serie.id}" style="font-size:0.9rem; color:#94a3b8; margin-top:0.25rem;">Último registro: —</p>
      </div>
      <div class="card-controls" id="controls-${serie.id}" style="display: none; background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); margin-bottom: 1.5rem; gap: 1.5rem; align-items: center; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label style="font-weight: 500; color: var(--navy);">Agrupar:</label>
          <div class="btn-group" id="agg-group-${serie.id}"></div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 280px;">
          <label style="font-weight: 500; color: var(--navy);">Período:</label>
          <input type="date" id="start-date-${serie.id}" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0; outline: none; flex: 1; font-family: inherit;">
          <span class="muted">→</span>
          <input type="date" id="end-date-${serie.id}" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0; outline: none; flex: 1; font-family: inherit;">
        </div>
      </div>
      <div style="position: relative;">
        <div style="position:absolute; bottom:14px; left:50%; transform:translateX(-50%); z-index:5; pointer-events:none;" id="hint-zoom-${serie.id}">
          <span style="background:rgba(15,23,42,0.55); color:#fff; font-size:0.72rem; padding:4px 10px; border-radius:20px; white-space:nowrap; backdrop-filter:blur(4px);">Scroll para zoom · Arrastrá para navegar · Doble clic para resetear</span>
        </div>
        <div class="detalle-chart-wrap" id="wrap-${serie.id}">
          <div class="skeleton" style="height: 100%; width: 100%;"></div>
        </div>
      </div>
      <div class="detalle-info">
        <h3 style="margin-bottom: 0.5rem; color: var(--navy); font-family: 'Poppins', sans-serif;">Sobre este indicador</h3>
        <p style="color: #475569; margin-bottom: 1rem;">
          Esta serie temporal muestra la evolución de <strong>${serie.titulo}</strong>. 
          Los datos son obtenidos desde <strong>${serie.fuente.toUpperCase()}</strong>.
          En este gráfico detallado podés observar con mayor precisión los cambios en la métrica a lo largo del período disponible.
        </p>
        <p style="font-size: 0.95rem; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 1rem; margin-top: 1rem; display:flex; align-items:center; flex-wrap:wrap; gap:0.75rem;">
          <span class="badge muted" id="badge-${serie.id}">Cargando último valor...</span>
          <span id="meta-${serie.id}"></span>
        </p>
      </div>
    `;

    cargarSerie(serie);

    return;
  }

  // En el Inicio mostramos solo los indicadores principales; el catálogo completo vive en Datos.
  const esInicio = !isDatosPage && !isToolsPage && !isDetallePage;
  const seriesAMostrar = esInicio ? SERIES.filter(s => s.principal) : SERIES;

  inicializarHeroStats(seriesAMostrar);

  if (isDatosPage && catContainer) {
    const categorias = [...new Set(SERIES.map(s => s.categoria || 'Otros'))];
    const slug = cat => `cat-${cat.replace(/\s+/g, '-').toLowerCase()}`;

    categorias.forEach(cat => {
      const section = document.createElement('div');
      section.className = 'category-section';
      section.id = slug(cat);
      section.innerHTML = `
        <h3 style="margin: 2.5rem 0 1rem; font-family: 'Poppins', sans-serif; font-size: 1.15rem; color: var(--navy); border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">${cat}</h3>
        <div class="grid" id="grid-${cat.replace(/\s+/g, '-').toLowerCase()}"></div>
      `;
      catContainer.appendChild(section);

      const catGrid = section.querySelector('.grid');
      const seriesCat = SERIES.filter(s => (s.categoria || 'Otros') === cat);

      seriesCat.forEach(serie => catGrid.appendChild(crearCard(serie)));
    });
  } else if (grid) {
    seriesAMostrar.forEach(serie => grid.appendChild(crearCard(serie)));

    // Agregar la tarjeta de calculadora al final del grid de métricas
    if (isToolsPage) {
      grid.appendChild(crearCardCalculadora());
    }
  }

  Promise.all(seriesAMostrar.map(cargarSerie));
}

// Tarjeta de acceso al catálogo completo (solo en el Inicio)
function crearCardVerTodos() {
  const div = document.createElement('div');
  div.className = 'card';
  div.style.cssText = 'display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; cursor:pointer; min-height:220px; border:2px dashed #cbd5e1; background:#f8fafc; transition:all .2s;';
  div.setAttribute('role', 'link');
  div.setAttribute('tabindex', '0');
  div.setAttribute('aria-label', 'Ver todos los indicadores');
  div.onmouseover = () => { div.style.background = '#f1f5f9'; div.style.borderColor = '#94a3b8'; };
  div.onmouseout  = () => { div.style.background = '#f8fafc'; div.style.borderColor = '#cbd5e1'; };
  const irADatos = () => { window.location.href = '/datos'; };
  div.onclick = irADatos;
  div.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irADatos(); }
  });
  div.innerHTML = `
    <div style="font-size:2.5rem; line-height:1; margin-bottom:0.75rem;">📊</div>
    <div style="font-weight:600; color:var(--navy); font-family:'Poppins',sans-serif; font-size:1.05rem;">Ver todos los indicadores</div>
    <div style="color:#64748b; font-size:0.9rem; margin-top:0.35rem;">Catálogo completo por categoría →</div>
  `;
  return div;
}

// ─── Desplegable de categorías en el navbar ("Datos") ─────────────────────────
function construirNavDatos() {
  const datosLink = document.querySelector('.nav-links a[href$="datos.html"]')
    || document.querySelector('.nav-links a[href="/datos"]');
  if (!datosLink) return;

  const categorias = [...new Set(SERIES.map(s => s.categoria || 'Otros'))];
  const slug = cat => `cat-${cat.replace(/\s+/g, '-').toLowerCase()}`;
  const esPaginaDatos = !!datosLink.getAttribute('style'); // el link activo trae color inline

  const wrap = document.createElement('div');
  wrap.className = 'nav-dropdown';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-dropdown-toggle' + (esPaginaDatos ? ' active' : '');
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = 'Datos <span class="nav-caret" aria-hidden="true">▾</span>';

  const menu = document.createElement('div');
  menu.className = 'nav-dropdown-menu';
  menu.setAttribute('role', 'menu');

  let html = `<a class="nav-dropdown-item nav-dropdown-all" role="menuitem" href="/datos">Ver catálogo completo</a>`;
  categorias.forEach(cat => {
    const seriesCat = SERIES.filter(s => (s.categoria || 'Otros') === cat);
    const subItems = seriesCat.map(s =>
      `<a class="nav-submenu-item" role="menuitem" href="/indicador/${s.slug || s.id}">${s.titulo}</a>`
    ).join('');
    html += `<div class="nav-dropdown-cat">
      <a class="nav-dropdown-item nav-cat-link" role="menuitem" href="/datos#${slug(cat)}">${cat}<span class="nav-subcaret" aria-hidden="true">›</span></a>
      <div class="nav-submenu" role="menu">${subItems}</div>
    </div>`;
  });
  menu.innerHTML = html;

  wrap.appendChild(toggle);
  wrap.appendChild(menu);
  datosLink.replaceWith(wrap);

  const cerrar = () => { wrap.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const abierto = wrap.classList.toggle('open');
    toggle.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  });
  // Al elegir cualquier opción (categoría o índice individual), cerrar el menú
  menu.querySelectorAll('a').forEach(item => item.addEventListener('click', cerrar));
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) cerrar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });
}

construirNavDatos();

// ─── Preview de los últimos informes en el home ───────────────────────────────
// Sin backend: se trae /reportes.html y se reusan sus propias tarjetas
// (.reporte-card), así no hay que duplicar el listado a mano en cada publicación.
async function cargarPreviewInformes() {
  const grid = document.getElementById('informes-preview-grid');
  if (!grid) return;

  try {
    const res = await fetch('/reportes');
    if (!res.ok) return;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const tarjetas = [...doc.querySelectorAll('.reporte-card')].slice(0, 3);
    if (tarjetas.length === 0) return; // sigue el placeholder "todavía no publicamos"

    grid.innerHTML = '';
    tarjetas.forEach(t => grid.appendChild(document.importNode(t, true)));
  } catch {
    // Sin conexión o falla el fetch: se deja el placeholder de siempre.
  }
}
cargarPreviewInformes();

// Botón "Volver atrás" sin javascript: URI (compatible con CSP).
// href="datos.html" es el fallback; si hay historial, volvemos a la página previa.
const _btnBack = document.getElementById('btn-back');
if (_btnBack) {
  _btnBack.addEventListener('click', (e) => {
    if (window.history.length > 1) { e.preventDefault(); window.history.back(); }
  });
}

loadAll();

// ─── Menú hamburguesa ─────────────────────────────────────────────────────────
(function () {
  const burger = document.querySelector('.nav-burger');
  const menu   = document.querySelector('.nav-mobile');
  if (!burger || !menu) return;

  burger.addEventListener('click', () => {
    const abierto = burger.classList.toggle('abierto');
    menu.classList.toggle('abierto', abierto);
    burger.setAttribute('aria-expanded', abierto);
    document.body.style.overflow = abierto ? 'hidden' : '';
  });

  // Cerrar al hacer click en un link
  menu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      burger.classList.remove('abierto');
      menu.classList.remove('abierto');
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
})();
