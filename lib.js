/* lib.js — funciones puras de transformación de datos.
 * Sin dependencias del DOM: se cargan como <script> antes de app.js (quedan en
 * el scope global compartido de scripts clásicos) y también se pueden importar
 * en Node para tests (`require('./lib.js')`).
 */

// ─── Fechas ─────────────────────────────────────────────────────────────────

function formatFecha(fechaStr, serie = null) {
  if (!fechaStr) return '—';

  // Limpiamos la hora/zona horaria si viene de la base de datos (ej: 2026-04-30T00:00:00+00)
  fechaStr = fechaStr.split('T')[0];

  // Formatos de agregación
  if (fechaStr.includes('-Q')) return fechaStr.replace('-Q', ' T'); // "2023-Q1" -> "2023 T1"
  if (/^\d{4}$/.test(fechaStr)) return fechaStr; // "2023"

  // Series mensuales (REM y EMAE): mostrar "mes año" en vez de día/mes/año
  const esMensual = serie && ((serie.id && serie.id.startsWith('rem-')) || serie.mensual);

  if (fechaStr.length === 7 || esMensual) {
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const [y, m] = fechaStr.split('-');
    return `${meses[parseInt(m, 10) - 1]} ${y}`;
  }
  const [y, m, d] = fechaStr.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// Etiqueta de un tick del eje Y de Chart.js. Cuando el paso entre ticks es
// menor a 1 (rangos de valores chicos: variación % diaria, o cualquier serie
// acotada a un período corto), redondear siempre a 0 decimales hace que ticks
// distintos (4.5 y 4) se muestren con la misma etiqueta ("4"); se necesitan
// hasta 2 decimales en ese caso.
function formatTickEje(valor, ticksVecinos) {
  const paso = ticksVecinos && ticksVecinos.length > 1
    ? Math.abs(ticksVecinos[1].value - ticksVecinos[0].value)
    : 0;
  const decimales = paso > 0 && paso < 1 ? 2 : 0;
  return valor.toLocaleString('es-AR', { maximumFractionDigits: decimales });
}

function isoHoy() { return new Date().toISOString().split('T')[0]; }
function isoHace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
}

// ─── Agregación temporal ──────────────────────────────────────────────────────

function agregarDatos(datos, periodo) {
  // Si el período es el original (diario o mensual), no hacer nada
  if (periodo === 'diario' || periodo === 'mensual_orig') return datos;

  const groups = {};
  datos.forEach(d => {
    // Usar T00:00:00 para evitar problemas de zona horaria al parsear solo la fecha
    const fecha = new Date(d.fecha.slice(0, 10) + 'T00:00:00');
    let key;

    if (periodo === 'mensual') {
      key = fecha.toISOString().slice(0, 7); // YYYY-MM
    } else if (periodo === 'trimestral') {
      const quarter = Math.floor(fecha.getMonth() / 3) + 1;
      key = `${fecha.getFullYear()}-Q${quarter}`;
    } else if (periodo === 'anual') {
      key = fecha.getFullYear().toString();
    }

    if (!key) return;
    if (!groups[key]) {
      groups[key] = { valores: [], fecha: key };
    }
    groups[key].valores.push(d.valor);
  });

  return Object.values(groups).map(g => {
    // Promedio del período: buena aproximación para tipos de cambio e índices.
    const valorAgregado = g.valores.reduce((a, b) => a + b, 0) / g.valores.length;
    return { fecha: g.fecha, valor: valorAgregado };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ─── EMAE: transformación de lectura ──────────────────────────────────────────
// lectura: 'indice' | 'var-mensual' | 'var-trimestral' | 'var-interanual'

function transformarEmae(data, lectura) {
  if (lectura === 'indice' || !data.length) return data;

  if (lectura === 'var-interanual') {
    return data.slice(12).map((d, i) => ({
      fecha: d.fecha,
      valor: data[i].valor ? +((d.valor / data[i].valor - 1) * 100).toFixed(2) : null,
    })).filter(d => d.valor != null);
  }

  if (lectura === 'var-trimestral') {
    // Promediar a trimestre y luego variación trimestre contra trimestre
    const q = agregarDatos(data, 'trimestral');
    return q.slice(1).map((d, i) => ({
      fecha: d.fecha,
      valor: q[i].valor ? +((d.valor / q[i].valor - 1) * 100).toFixed(2) : null,
    })).filter(d => d.valor != null);
  }

  // var-mensual
  return data.slice(1).map((d, i) => ({
    fecha: d.fecha,
    valor: data[i].valor ? +((d.valor / data[i].valor - 1) * 100).toFixed(2) : null,
  })).filter(d => d.valor != null);
}

// ─── Estadística para el Laboratorio ──────────────────────────────────────────

// Correlación de Pearson entre dos arrays numéricos de igual largo.
// Devuelve null si n < 2 o si alguna serie no tiene varianza (división por cero).
function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma, xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  if (da === 0 || db === 0) return null; // serie constante: sin varianza
  return num / Math.sqrt(da * db);
}

// Correlación cruzada para detectar lead/lag entre dos series alineadas y de
// igual frecuencia. Prueba desfasar en [-maxLag, maxLag] y devuelve el lag que
// maximiza |r|. Convención: lag > 0 significa que `a` ADELANTA a `b` (a se mueve
// antes). minOverlap evita lags con muy pocos puntos en común.
function crossCorrelation(a, b, maxLag = 12, minOverlap = 6) {
  let best = { lag: 0, r: null, n: 0 };
  const lim = Math.min(maxLag, a.length - 1, b.length - 1);
  for (let lag = -lim; lag <= lim; lag++) {
    const xa = [], xb = [];
    for (let i = 0; i < a.length; i++) {
      const j = i + lag;               // a[i] vs b[i+lag]
      if (j >= 0 && j < b.length) { xa.push(a[i]); xb.push(b[j]); }
    }
    if (xa.length < minOverlap) continue;
    const r = pearson(xa, xb);
    if (r == null) continue;
    const mejora = best.r == null || Math.abs(r) > Math.abs(best.r) + 1e-12;
    const empateMasCerca = best.r != null &&
      Math.abs(Math.abs(r) - Math.abs(best.r)) <= 1e-12 &&
      Math.abs(lag) < Math.abs(best.lag);
    if (mejora || empateMasCerca) best = { lag, r, n: xa.length };
  }
  return best;
}

// Normaliza un array numérico según el modo:
//  'niveles'   -> tal cual
//  'variacion' -> variación % punto a punto (devuelve n-1 elementos)
//  'indice'    -> índice base 100 en el primer punto
function normalizar(arr, modo) {
  if (!arr || !arr.length) return [];
  if (modo === 'variacion') {
    const out = [];
    for (let i = 1; i < arr.length; i++) {
      out.push(arr[i - 1] ? +(((arr[i] / arr[i - 1]) - 1) * 100).toFixed(2) : 0);
    }
    return out;
  }
  if (modo === 'indice') {
    const base = arr[0];
    if (!base) return arr.slice();
    return arr.map(v => +((v / base) * 100).toFixed(2));
  }
  return arr.slice(); // niveles
}

// Alinea dos series [{fecha,valor}] por clave de fecha (intersección). Asume que
// ambas ya están a la misma frecuencia (ej: agregarDatos(., 'mensual')).
// Devuelve { fechas:[], a:[números], b:[números], n } con los períodos en común.
function alinearSeries(serieA, serieB) {
  const mapB = new Map(serieB.map(d => [d.fecha, d.valor]));
  const fechas = [], a = [], b = [];
  for (const d of serieA) {
    if (mapB.has(d.fecha)) {
      fechas.push(d.fecha);
      a.push(d.valor);
      b.push(mapB.get(d.fecha));
    }
  }
  return { fechas, a, b, n: fechas.length };
}

// ─── Econometría ──────────────────────────────────────────────────────────────

// logGamma(x) — aproximación de Lanczos (g=7, 9 términos), con reflexión para x<0.5.
function logGamma(x) {
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Reflexión: Γ(x)Γ(1−x) = π / sin(πx)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Beta incompleta regularizada I_x(a,b) — método Numerical Recipes.
function betaInc(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Fracción continua (Lentz modificado).
  function betacf(x, a, b) {
    const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) +
    a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return bt * betacf(x, a, b) / a;
  }
  return 1 - bt * betacf(1 - x, b, a) / b;
}

// p-value BILATERAL de la t de Student.
function pValorT(t, df) {
  if (!isFinite(t)) return 0;
  return betaInc(df / (df + t * t), df / 2, 0.5);
}

// p-value de cola superior de la F.
function pValorF(F, df1, df2) {
  if (F <= 0) return 1;
  if (!isFinite(F)) return 0;
  return betaInc(df2 / (df2 + df1 * F), df2 / 2, df1 / 2);
}

// Regresión lineal MCO simple Y = β₀ + β₁X.
// Devuelve null si n<3 o si X es constante (sxx===0).
function regresionLineal(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;

  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;

  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  if (sxx === 0) return null; // X constante

  const b1 = sxy / sxx;
  const b0 = my - b1 * mx;

  // Residuos explícitos: SSE y numerador de Durbin-Watson.
  let sse = 0, dwNum = 0, ePrev = 0;
  for (let i = 0; i < n; i++) {
    const e = y[i] - (b0 + b1 * x[i]);
    sse += e * e;
    if (i > 0) { const de = e - ePrev; dwNum += de * de; }
    ePrev = e;
  }

  const sst = syy;
  const ssr = Math.max(0, sst - sse);
  const df = n - 2;
  const mse = sse / df;
  const sigma = Math.sqrt(mse);
  const seB1 = Math.sqrt(mse / sxx);
  const seB0 = Math.sqrt(mse * (1 / n + mx * mx / sxx));

  const tDe = (coef, se) => {
    if (se === 0) return coef === 0 ? 0 : (coef > 0 ? Infinity : -Infinity);
    return coef / se;
  };
  const tB0 = tDe(b0, seB0);
  const tB1 = tDe(b1, seB1);
  const pB0 = pValorT(tB0, df);
  const pB1 = pValorT(tB1, df);

  const r2 = sst > 0 ? ssr / sst : null;
  const r2adj = r2 == null ? null : 1 - (1 - r2) * (n - 1) / df;
  const F = mse > 0 ? ssr / mse : Infinity;
  const pF = pValorF(F, 1, df);
  const dw = sse > 0 ? dwNum / sse : null;

  return { n, df, b0, b1, seB0, seB1, tB0, tB1, pB0, pB1,
           r2, r2adj, F, pF, sigma, sst, ssr, sse, dw };
}

// Doble export: en Node se importan; en el browser quedan como globales.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatFecha, formatTickEje, isoHoy, isoHace, agregarDatos, transformarEmae,
                     pearson, crossCorrelation, normalizar, alinearSeries,
                     pValorT, pValorF, regresionLineal };
}
