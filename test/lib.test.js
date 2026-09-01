// Tests de las funciones puras de transformación (lib.js).
// Correr: node --test
const { test } = require('node:test');
const assert = require('node:assert');
const { formatFecha, formatTickEje, isoHace, agregarDatos, transformarEmae,
        pearson, crossCorrelation, normalizar, alinearSeries,
        pValorT, pValorF, regresionLineal } = require('../lib.js');

// ─── formatFecha ──────────────────────────────────────────────────────────────

test('formatFecha: nulo/vacío devuelve guion', () => {
  assert.strictEqual(formatFecha(null), '—');
  assert.strictEqual(formatFecha(''), '—');
});

test('formatFecha: fecha diaria -> dd/mm/aa', () => {
  assert.strictEqual(formatFecha('2026-06-01'), '01/06/26');
});

test('formatFecha: strip de timezone (bug histórico del NaN)', () => {
  // Antes "2026-04-30T00:00:00+00" rompía el parseo
  assert.strictEqual(formatFecha('2026-04-30T00:00:00+00:00'), '30/04/26');
});

test('formatFecha: serie REM se muestra mensual (bug histórico)', () => {
  assert.strictEqual(formatFecha('2026-04-30', { id: 'rem-ipc' }), 'abr 2026');
});

test('formatFecha: serie con mensual:true (EMAE) se muestra mensual', () => {
  assert.strictEqual(formatFecha('2026-03-01', { id: 'emae', mensual: true }), 'mar 2026');
});

test('formatFecha: formato largo de 7 chars -> mes año', () => {
  assert.strictEqual(formatFecha('2025-12'), 'dic 2025');
});

test('formatFecha: trimestre y año se respetan', () => {
  assert.strictEqual(formatFecha('2023-Q1'), '2023 T1');
  assert.strictEqual(formatFecha('2024'), '2024');
});

// ─── formatTickEje ────────────────────────────────────────────────────────────
// Regression: ISSUE-001 — con rangos de valores chicos (ej. variación % diaria,
// o cualquier serie acotada a un período corto) Chart.js elige un paso entre
// ticks menor a 1 (0.5, 0.25...); redondear siempre a 0 decimales hacía que
// ticks distintos (4.5 y 4) se mostraran con la misma etiqueta ("4").
// Found by /qa on 2026-09-01
// Report: .gstack/qa-reports/qa-report-macroar-com-ar-2026-09-01.md

test('formatTickEje: paso menor a 1 muestra decimales (bug de etiquetas duplicadas)', () => {
  const ticks = [{ value: 0 }, { value: 0.5 }];
  assert.strictEqual(formatTickEje(4.5, ticks), '4,5');
  assert.strictEqual(formatTickEje(4, ticks), '4');
  assert.strictEqual(formatTickEje(3.5, ticks), '3,5');
});

test('formatTickEje: paso entero no agrega decimales', () => {
  const ticks = [{ value: 0 }, { value: 10000 }];
  assert.strictEqual(formatTickEje(40000, ticks), '40.000');
});

test('formatTickEje: un solo tick (o ninguno) no rompe', () => {
  assert.strictEqual(formatTickEje(5, [{ value: 5 }]), '5');
  assert.strictEqual(formatTickEje(5, []), '5');
  assert.strictEqual(formatTickEje(5, undefined), '5');
});

// ─── agregarDatos ───────────────────────────────────────────────────────────

const serieMensual = [
  { fecha: '2024-01-01', valor: 100 },
  { fecha: '2024-02-01', valor: 110 },
  { fecha: '2024-03-01', valor: 120 },
  { fecha: '2024-04-01', valor: 130 },
];

test('agregarDatos: diario/mensual_orig no transforma', () => {
  assert.deepStrictEqual(agregarDatos(serieMensual, 'diario'), serieMensual);
  assert.deepStrictEqual(agregarDatos(serieMensual, 'mensual_orig'), serieMensual);
});

test('agregarDatos: trimestral promedia y ordena', () => {
  const q = agregarDatos(serieMensual, 'trimestral');
  assert.strictEqual(q.length, 2);
  assert.strictEqual(q[0].fecha, '2024-Q1');
  assert.strictEqual(q[0].valor, 110);  // (100+110+120)/3
  assert.strictEqual(q[1].fecha, '2024-Q2');
  assert.strictEqual(q[1].valor, 130);  // solo abril
});

test('agregarDatos: anual promedia el año', () => {
  const a = agregarDatos(serieMensual, 'anual');
  assert.strictEqual(a.length, 1);
  assert.strictEqual(a[0].fecha, '2024');
  assert.strictEqual(a[0].valor, 115);  // (100+110+120+130)/4
});

// ─── transformarEmae ──────────────────────────────────────────────────────────

const indice = [
  { fecha: '2024-01-01', valor: 100 },
  { fecha: '2024-02-01', valor: 110 },
  { fecha: '2024-03-01', valor: 121 },
];

test('transformarEmae: indice devuelve la serie tal cual', () => {
  assert.deepStrictEqual(transformarEmae(indice, 'indice'), indice);
});

test('transformarEmae: var-mensual calcula el cambio % mes a mes', () => {
  const v = transformarEmae(indice, 'var-mensual');
  assert.strictEqual(v.length, 2);
  assert.strictEqual(v[0].valor, 10);   // 110/100 - 1
  assert.strictEqual(v[1].valor, 10);   // 121/110 - 1
});

test('transformarEmae: var-interanual usa el dato de 12 meses atrás', () => {
  const doceMeses = Array.from({ length: 13 }, (_, i) => ({
    fecha: `2024-${String(i + 1).padStart(2, '0')}-01`,
    valor: 100 + i * 10,
  }));
  const v = transformarEmae(doceMeses, 'var-interanual');
  assert.strictEqual(v.length, 1);
  assert.strictEqual(v[0].valor, 120);  // 220/100 - 1
});

test('transformarEmae: serie vacía no rompe', () => {
  assert.deepStrictEqual(transformarEmae([], 'var-mensual'), []);
});

// ─── isoHace ────────────────────────────────────────────────────────────────

test('isoHace: devuelve formato YYYY-MM-DD', () => {
  assert.match(isoHace(30), /^\d{4}-\d{2}-\d{2}$/);
});

// ─── pearson ──────────────────────────────────────────────────────────────────

test('pearson: correlación perfecta positiva = 1', () => {
  assert.strictEqual(pearson([1, 2, 3], [2, 4, 6]), 1);
});

test('pearson: correlación perfecta negativa = -1', () => {
  assert.strictEqual(pearson([1, 2, 3], [3, 2, 1]), -1);
});

test('pearson: serie constante (varianza 0) devuelve null', () => {
  assert.strictEqual(pearson([1, 1, 1], [1, 2, 3]), null);
});

test('pearson: n < 2 devuelve null', () => {
  assert.strictEqual(pearson([5], [5]), null);
});

// ─── normalizar ───────────────────────────────────────────────────────────────

test('normalizar: niveles devuelve copia igual', () => {
  assert.deepStrictEqual(normalizar([50, 100, 150], 'niveles'), [50, 100, 150]);
});

test('normalizar: indice base 100 en el primer punto', () => {
  assert.deepStrictEqual(normalizar([50, 100, 150], 'indice'), [100, 200, 300]);
});

test('normalizar: variacion % pierde el primer punto (n-1)', () => {
  assert.deepStrictEqual(normalizar([100, 110, 99], 'variacion'), [10, -10]);
});

test('normalizar: array vacío no rompe', () => {
  assert.deepStrictEqual(normalizar([], 'indice'), []);
});

// ─── alinearSeries ────────────────────────────────────────────────────────────

test('alinearSeries: intersecta por clave de fecha', () => {
  const A = [{ fecha: '2024-01', valor: 1 }, { fecha: '2024-02', valor: 2 }, { fecha: '2024-03', valor: 3 }];
  const B = [{ fecha: '2024-02', valor: 20 }, { fecha: '2024-03', valor: 30 }, { fecha: '2024-04', valor: 40 }];
  const r = alinearSeries(A, B);
  assert.deepStrictEqual(r.fechas, ['2024-02', '2024-03']);
  assert.deepStrictEqual(r.a, [2, 3]);
  assert.deepStrictEqual(r.b, [20, 30]);
  assert.strictEqual(r.n, 2);
});

test('alinearSeries: sin períodos en común devuelve n=0', () => {
  const A = [{ fecha: '2024-01', valor: 1 }];
  const B = [{ fecha: '2025-01', valor: 9 }];
  assert.strictEqual(alinearSeries(A, B).n, 0);
});

// ─── crossCorrelation ─────────────────────────────────────────────────────────

test('crossCorrelation: detecta que A adelanta a B en 1 período (lag>0)', () => {
  // Patrón distintivo (no lineal) para que el pico de correlación sea único.
  // B es A desplazada: B[i] = A[i-1]  =>  A[i] correlaciona con B[i+1]  => lag = 1
  const a = [2, 5, 1, 8, 3, 9, 4, 7, 6, 0];
  const b = [99, 2, 5, 1, 8, 3, 9, 4, 7, 6];
  const r = crossCorrelation(a, b, 6, 4);
  assert.strictEqual(r.lag, 1);
  assert.ok(Math.abs(r.r - 1) < 1e-9, `r debería ser ~1, fue ${r.r}`);
});

test('crossCorrelation: series sincronizadas dan lag 0', () => {
  const a = [2, 5, 1, 8, 3, 9, 4, 7];
  const b = a.map(v => v * 2);
  assert.strictEqual(crossCorrelation(a, b, 4, 4).lag, 0);
});

// ─── regresionLineal ──────────────────────────────────────────────────────────

test('regresionLineal: recta perfecta y=1+2x recupera coeficientes y R²=1', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8];
  const y = x.map(v => 1 + 2 * v);
  const reg = regresionLineal(x, y);
  assert.ok(Math.abs(reg.b0 - 1) < 1e-9, `b0=${reg.b0}`);
  assert.ok(Math.abs(reg.b1 - 2) < 1e-9, `b1=${reg.b1}`);
  assert.ok(Math.abs(reg.r2 - 1) < 1e-12, `r2=${reg.r2}`);
  assert.ok(reg.pB1 < 1e-9, `pB1=${reg.pB1}`);
});

test('regresionLineal: identidades algebraicas con datos ruidosos', () => {
  const x = [2, 5, 1, 8, 3, 9, 4, 7, 6, 10];
  const y = [3, 7, 2, 9, 5, 11, 4, 8, 8, 12];
  const reg = regresionLineal(x, y);
  assert.ok(Math.abs(reg.F - reg.tB1 * reg.tB1) < 1e-8, `F=${reg.F} tB1²=${reg.tB1 ** 2}`);
  const r = pearson(x, y);
  assert.ok(Math.abs(reg.r2 - r * r) < 1e-10, `r2=${reg.r2} r²=${r * r}`);
  assert.ok(Math.abs(reg.sst - (reg.ssr + reg.sse)) < 1e-8, `sst=${reg.sst} ssr+sse=${reg.ssr + reg.sse}`);
});

test('regresionLineal: X constante devuelve null', () => {
  assert.strictEqual(regresionLineal([5, 5, 5, 5], [1, 2, 3, 4]), null);
});

test('regresionLineal: n<3 devuelve null', () => {
  assert.strictEqual(regresionLineal([1, 2], [3, 4]), null);
});

// ─── pValorT / pValorF ──────────────────────────────────────────────────────────

test('pValorT: df=1 (Cauchy) en t=1 -> p bilateral 0.5', () => {
  assert.ok(Math.abs(pValorT(1, 1) - 0.5) < 1e-9, `p=${pValorT(1, 1)}`);
});

test('pValorT: df=2 forma cerrada en t=√2', () => {
  const esperado = (2 - Math.SQRT2) / 2;
  assert.ok(Math.abs(pValorT(Math.SQRT2, 2) - esperado) < 1e-9, `p=${pValorT(Math.SQRT2, 2)}`);
});

test('pValorF: identidad F(t²,1,df) = t bilateral', () => {
  for (const [t, df] of [[1.5, 8], [2.3, 20]]) {
    const dif = Math.abs(pValorF(t * t, 1, df) - pValorT(t, df));
    assert.ok(dif < 1e-9, `t=${t} df=${df} dif=${dif}`);
  }
});
