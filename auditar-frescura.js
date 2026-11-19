// Auditoría de frescura de todos los indicadores de SERIES (app.js).
// Para cada serie consulta su fuente real y verifica que el último dato no sea
// más viejo de lo esperable según su frecuencia. Sale con código 1 si alguna
// está atrasada o rota, para que el workflow quede en rojo y avise por mail.
//
// Uso: node auditar-frescura.js
// Corre solo cada semana vía .github/workflows/auditar-frescura.yml.

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const SERIES = eval(src.match(/const SERIES = (\[[\s\S]*?\n\]);/)[1]);

// Edad máxima tolerada (días desde el inicio del último período informado).
// Contempla el rezago normal de publicación de cada fuente: p. ej. el EMAE de
// agosto sale a fines de octubre, y la EPH del 2º trimestre recién en diciembre.
const MAX_DIAS = { diaria: 10, mensual: 125, trimestral: 280 };
const MAX_DIAS_REM = 70; // el REM sale en la primera semana de cada mes

const getJson = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': 'MacroAr-auditoria' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// Devuelve las fechas (YYYY-MM-DD, ordenadas) de la serie en su fuente.
let _blue = null;
async function fechasDeFuente(s) {
  switch (s.fuente) {
    case 'bluelytics': {
      _blue = _blue || await getJson('https://api.bluelytics.com.ar/v2/evolution.json');
      return _blue.filter(d => String(d.source).toLowerCase() === String(s.tipo_tc).toLowerCase()).map(d => d.date);
    }
    case 'bcra': {
      const d = await getJson(`https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${s.serieId}?limit=3`);
      return d.results[0].detalle.map(x => x.fecha);
    }
    case 'argentinadatos':
      return (await getJson(`https://api.argentinadatos.com/v1/${s.serieId}`)).map(x => x.fecha);
    case 'emae': {
      const d = await getJson(`https://apis.datos.gob.ar/series/api/series/?ids=${s.seriesEmae.desest}&limit=3&sort=desc&format=json`);
      return d.data.map(x => x[0]);
    }
    case 'local': {
      const js = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', `${s.serieId}.json`), 'utf8'));
      if (js.publicacion) return [js.publicacion]; // REM: lo que importa es la edición
      return (Array.isArray(js) ? js : js.datos).map(x => x.fecha);
    }
    default: {
      const d = await getJson(`https://apis.datos.gob.ar/series/api/series/?ids=${s.serieId}&limit=3&sort=desc&format=json`);
      return d.data.map(x => x[0]);
    }
  }
}

function frecuencia(fechas) {
  if (fechas.length < 2) return 'mensual';
  const [a, b] = fechas.slice(-2).map(f => new Date(f));
  const gap = (b - a) / 864e5;
  return gap <= 7 ? 'diaria' : gap <= 45 ? 'mensual' : 'trimestral';
}

(async () => {
  const hoy = new Date();
  const problemas = [];

  // Dos indicadores distintos leyendo la misma variable casi siempre es un error de ID.
  const vistos = new Map();
  for (const s of SERIES) {
    if (s.serieId == null) continue;
    // Misma variable con distinto cálculo (ej. IPIM mensual e interanual) es válido.
    const clave = `${s.fuente}:${s.serieId}${s.interanual ? ':ia' : ''}`;
    if (vistos.has(clave)) problemas.push(`${s.id}: usa la misma fuente que ${vistos.get(clave)} (${clave})`);
    else vistos.set(clave, s.id);
  }

  const filas = await Promise.all(SERIES.map(async (s) => {
    if (s.discontinuada) return [s.id, '—', 'ok']; // ya no se publica: no se espera que avance
    try {
      // Puede haber fechas futuras (la UVA se publica por adelantado): cuentan como al día.
      const fechas = (await fechasDeFuente(s)).map(f => String(f).split('T')[0]).sort();
      if (!fechas.length) return [s.id, '—', 'SIN DATOS'];
      const ultima = fechas[fechas.length - 1];
      const esRem = s.fuente === 'local' && s.id.startsWith('rem-');
      const frec = esRem ? 'REM' : frecuencia(fechas);
      const max = esRem ? MAX_DIAS_REM : MAX_DIAS[frec];
      const edad = Math.floor((hoy - new Date(ultima)) / 864e5);
      return [s.id, ultima, edad > max ? `ATRASADA (${edad} días, máx ${max}, ${frec})` : 'ok'];
    } catch (e) {
      return [s.id, '—', `ERROR ${e.message}`];
    }
  }));

  for (const [id, ultima, estado] of filas) {
    console.log(`${estado === 'ok' ? '✅' : '❌'} ${id.padEnd(22)} ${ultima.padEnd(11)} ${estado}`);
    if (estado !== 'ok') problemas.push(`${id}: ${estado}`);
  }

  if (problemas.length) {
    console.log(`\n${problemas.length} problema(s):\n- ${problemas.join('\n- ')}`);
    process.exit(1);
  }
  console.log('\nTodos los indicadores están al día.');
})();
