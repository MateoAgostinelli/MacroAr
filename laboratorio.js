// Laboratorio de correlaciones (MacroAr).
// Reusa de app.js: SERIES, obtenerDatosSerie. De lib.js: agregarDatos, pearson,
// crossCorrelation, normalizar, alinearSeries, formatFecha.
// Todo client-side: elige 2 series, las lleva a una frecuencia común, alinea por
// fecha, normaliza, y calcula correlación + lead/lag.
(function () {
  if (typeof SERIES === 'undefined') return;

  // Universo del lab: datos realizados. Excluimos REM (proyecciones) y mocks.
  const UNIVERSO = SERIES.filter(s => !s.id.startsWith('rem-') && !String(s.fuente).startsWith('mock'));

  const selA = document.getElementById('serie-a');
  const selB = document.getElementById('serie-b');
  const selFreq = document.getElementById('lab-freq');
  const grupoModo = document.getElementById('lab-modo');
  const elInsight = document.getElementById('lab-insight');
  const elFresh = document.getElementById('lab-freshness');
  const btnShare = document.getElementById('lab-share');
  const canvas = document.getElementById('lab-chart');
  const hintZoom = document.getElementById('lab-hint-zoom');
  if (!selA || !selB) return;

  function mostrarResetZoomLab() {
    if (hintZoom) { hintZoom.style.transition = 'opacity .4s'; hintZoom.style.opacity = '0'; }
  }
  canvas.addEventListener('dblclick', () => { if (chart) chart.resetZoom(); });
  canvas.addEventListener('mousedown', () => { canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('mouseup', () => { canvas.style.cursor = 'grab'; });

  let modo = 'indice';
  let chart = null;
  let dirReg = 'ba';
  let scatter = null;
  let ultimo = null;
  const cache = {}; // datos crudos por serie.id (evita re-fetch)

  const elRegOut = document.getElementById('lab-reg-out');
  const grupoDir = document.getElementById('lab-reg-dir');
  const wrapScatter = document.getElementById('lab-scatter-wrap');
  const canvasScatter = document.getElementById('lab-scatter');

  const PERIODO_LABEL = { mensual: 'meses', trimestral: 'trimestres', anual: 'años' };
  const MIN_N = { mensual: 12, trimestral: 6, anual: 4 };

  // ── Poblar selects ───────────────────────────────────────────────────────────
  function opciones(selected) {
    return UNIVERSO.map(s =>
      `<option value="${s.id}"${s.id === selected ? ' selected' : ''}>${s.titulo}</option>`
    ).join('');
  }
  selA.innerHTML = opciones('tc-blue');
  selB.innerHTML = opciones('inflacion');

  // ── Estado <-> URL hash ──────────────────────────────────────────────────────
  function leerHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('a') && UNIVERSO.some(s => s.id === p.get('a'))) selA.value = p.get('a');
    if (p.get('b') && UNIVERSO.some(s => s.id === p.get('b'))) selB.value = p.get('b');
    if (['mensual', 'trimestral', 'anual'].includes(p.get('f'))) selFreq.value = p.get('f');
    if (['indice', 'niveles', 'variacion'].includes(p.get('m'))) modo = p.get('m');
    if (['ba', 'ab'].includes(p.get('d'))) dirReg = p.get('d');
    aplicarModoUI();
    aplicarDirUI();
  }
  function escribirHash() {
    // En /laboratorio con pestañas (Correlaciones + Gráficos, este último con
    // editor.js) las dos herramientas comparten página pero cada una escribe
    // su propio estado en la URL — si las dos pisaran el hash con new
    // URLSearchParams() vacío, cada click en una pestaña borraría el link
    // compartible de la otra. Por eso: mientras la pestaña de Gráficos está
    // activa, esta función no toca el hash en absoluto.
    if (window.__labTabActiva && window.__labTabActiva !== 'correlaciones') return;
    const p = new URLSearchParams({ a: selA.value, b: selB.value, f: selFreq.value, m: modo, d: dirReg });
    history.replaceState(null, '', '#' + p.toString());
  }
  function aplicarModoUI() {
    grupoModo.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.modo === modo));
  }
  function aplicarDirUI() {
    grupoDir.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.dir === dirReg));
  }

  // ── Fetch (cacheado) ─────────────────────────────────────────────────────────
  async function datosDe(id) {
    if (cache[id]) return cache[id];
    const serie = SERIES.find(s => s.id === id);
    const datos = await obtenerDatosSerie(serie, 3650, 120, true);
    cache[id] = datos;
    return datos;
  }

  // ── Frescura ─────────────────────────────────────────────────────────────────
  function diasDesde(fechaStr) {
    const f = new Date(fechaStr.slice(0, 10) + 'T00:00:00');
    return Math.floor((Date.now() - f.getTime()) / 86400000);
  }
  function frescuraTexto(serie, datos) {
    if (!datos.length) return '';
    const ultima = datos[datos.length - 1].fecha;
    const dias = diasDesde(ultima);
    const viejo = dias > 75;
    return `${serie.titulo}: ${formatFecha(ultima, serie)}${viejo ? ' ⚠️' : ''}`;
  }

  // ── Insight en castellano ────────────────────────────────────────────────────
  function fuerza(r) {
    const a = Math.abs(r);
    if (a >= 0.7) return 'fuerte';
    if (a >= 0.4) return 'moderada';
    return 'débil';
  }
  function generarInsight(sA, sB, r, lag, n, freq, maxLag) {
    const per = PERIODO_LABEL[freq];
    if (n < MIN_N[freq]) {
      return `Pocos ${per} en común (n=${n}). El resultado es apenas orientativo: hace falta más historia compartida para una conclusión confiable.`;
    }
    const signo = r >= 0 ? 'positiva' : 'negativa';
    let txt = `En los ${n} ${per} en común, <strong>${sA.titulo}</strong> y <strong>${sB.titulo}</strong> muestran una correlación ${fuerza(r)} ${signo} (r = ${r.toFixed(2)}).`;
    // Solo afirmamos lead/lag si ESE desfasaje tiene al menos correlación moderada
    // y NO cae en el borde del rango (un pico en el extremo suele ser artefacto).
    if (lag.lag !== 0 && lag.r != null && Math.abs(lag.r) >= 0.4 && Math.abs(lag.lag) < maxLag) {
      const lider = lag.lag > 0 ? sA : sB;
      txt += ` Además, <strong>${lider.titulo}</strong> tendió a moverse ~${Math.abs(lag.lag)} ${per} antes (correlación ${fuerza(lag.r)} con ese desfasaje).`;
    } else if (Math.abs(r) >= 0.4) {
      txt += ' Se movieron de forma sincronizada.';
    }
    return txt;
  }

  // ── Regresión lineal (MCO) ────────────────────────────────────────────────────
  function fmt(v) {
    return !isFinite(v) ? '∞' : String(Number(v.toPrecision(4)));
  }
  function pTxt(p) {
    if (p == null || !isFinite(p)) return '—';
    if (p < 1e-4) return '<0.0001';
    return p.toFixed(4);
  }
  function stars(p) {
    if (p == null || !isFinite(p)) return '';
    return p < 0.01 ? '***' : p < 0.05 ? '**' : p < 0.1 ? '*' : '';
  }
  const MODO_LABEL = { indice: 'índice base 100', niveles: 'niveles', variacion: 'variación % período a período' };

  function limpiarRegresion() {
    if (elRegOut) elRegOut.innerHTML = '';
    if (scatter) { scatter.destroy(); scatter = null; }
    if (wrapScatter) wrapScatter.style.display = 'none';
    ultimo = null;
  }

  function renderRegresion() {
    if (!ultimo) return;
    const { sA, sB, normA, normB, freq } = ultimo;
    const yEsB = dirReg === 'ba';
    const sX = yEsB ? sA : sB;
    const sY = yEsB ? sB : sA;
    const x = yEsB ? normA : normB;
    const yv = yEsB ? normB : normA;

    const reg = regresionLineal(x, yv);
    if (!reg) {
      elRegOut.innerHTML = '<p class="lab-reg-warning">No se puede estimar la regresión con estos datos (hacen falta al menos 3 puntos y variación en X).</p>';
      if (scatter) { scatter.destroy(); scatter = null; }
      wrapScatter.style.display = 'none';
      return;
    }

    const signo1 = reg.b1 >= 0 ? '+' : '−';
    let html = '';

    if (modo !== 'variacion') {
      html += `<p class="lab-reg-warning">⚠️ Estás corriendo la regresión sobre ${modo === 'indice' ? 'índice base 100' : 'niveles'}: con series con tendencia el ajuste puede ser espurio (R² alto sin relación real). Para una lectura más robusta usá <strong>Variación %</strong>.</p>`;
    }

    html += `<p class="lab-reg-eq">${sY.titulo} = ${fmt(reg.b0)} ${signo1} ${fmt(Math.abs(reg.b1))} × ${sX.titulo}</p>`;
    html += `<p class="lab-reg-stats" style="margin-top:-.5rem">Datos: ${MODO_LABEL[modo]}.</p>`;

    // Tabla de coeficientes.
    html += '<table class="lab-table"><thead><tr>' +
      '<th>Variable</th><th class="num">Coeficiente</th><th class="num">Error est.</th>' +
      '<th class="num">t</th><th class="num">p-valor</th><th></th></tr></thead><tbody>';
    html += `<tr><td>Constante (β₀)</td><td class="num">${fmt(reg.b0)}</td><td class="num">${fmt(reg.seB0)}</td>` +
      `<td class="num">${fmt(reg.tB0)}</td><td class="num">${pTxt(reg.pB0)}</td><td class="lab-sig">${stars(reg.pB0)}</td></tr>`;
    html += `<tr><td>${sX.titulo} (β₁)</td><td class="num">${fmt(reg.b1)}</td><td class="num">${fmt(reg.seB1)}</td>` +
      `<td class="num">${fmt(reg.tB1)}</td><td class="num">${pTxt(reg.pB1)}</td><td class="lab-sig">${stars(reg.pB1)}</td></tr>`;
    html += '</tbody></table>';

    // Tabla ANOVA.
    html += '<table class="lab-table"><thead><tr>' +
      '<th>Fuente</th><th class="num">SC</th><th class="num">gl</th><th class="num">CM</th>' +
      '<th class="num">F</th><th class="num">p</th></tr></thead><tbody>';
    html += `<tr><td>Regresión</td><td class="num">${fmt(reg.ssr)}</td><td class="num">1</td><td class="num">${fmt(reg.ssr)}</td>` +
      `<td class="num">${fmt(reg.F)}</td><td class="num">${pTxt(reg.pF)}</td></tr>`;
    html += `<tr><td>Residuos</td><td class="num">${fmt(reg.sse)}</td><td class="num">${reg.df}</td><td class="num">${fmt(reg.sigma * reg.sigma)}</td>` +
      '<td class="num">—</td><td class="num">—</td></tr>';
    html += `<tr><td>Total</td><td class="num">${fmt(reg.sst)}</td><td class="num">${reg.n - 1}</td>` +
      '<td class="num">—</td><td class="num">—</td><td class="num">—</td></tr>';
    html += '</tbody></table>';

    // Línea de stats.
    let dwTxt;
    if (reg.dw == null) dwTxt = '—';
    else {
      let lectura = ' (sin autocorrelación marcada)';
      if (reg.dw < 1.5) lectura = ' (posible autocorrelación positiva)';
      else if (reg.dw > 2.5) lectura = ' (posible autocorrelación negativa)';
      dwTxt = fmt(reg.dw) + lectura;
    }
    html += `<p class="lab-reg-stats">R² = ${reg.r2 == null ? '—' : fmt(reg.r2)} · ` +
      `R² ajustado = ${reg.r2adj == null ? '—' : fmt(reg.r2adj)} · ` +
      `σ̂ = ${fmt(reg.sigma)} · n = ${reg.n} · Durbin-Watson = ${dwTxt}</p>`;

    // Interpretación.
    let interp = `${sX.titulo} explica el ${(reg.r2 * 100).toFixed(1)}% de la variación de ${sY.titulo} en la muestra (n=${reg.n}). `;
    if (reg.pB1 < 0.01) interp += `La relación es estadísticamente significativa al 1% (p ${pTxt(reg.pB1)}).`;
    else if (reg.pB1 < 0.05) interp += `La relación es estadísticamente significativa al 5% (p ${pTxt(reg.pB1)}).`;
    else if (reg.pB1 < 0.1) interp += `La relación es estadísticamente significativa al 10% (p ${pTxt(reg.pB1)}).`;
    else interp += `La relación NO es estadísticamente significativa (p = ${pTxt(reg.pB1)}): con estos datos no se puede afirmar una relación lineal entre ambas.`;
    if (reg.n < MIN_N[freq]) {
      interp += ` Ojo: la muestra es chica (n=${reg.n}), así que tomá estos resultados como orientativos.`;
    }
    html += `<p class="lab-reg-interp">${interp}</p>`;

    html += '<p class="lab-sig-legend">*** p&lt;0.01 · ** p&lt;0.05 · * p&lt;0.1</p>';

    elRegOut.innerHTML = html;

    // Scatter con recta MCO.
    wrapScatter.style.display = '';
    if (scatter) scatter.destroy();
    const puntos = [];
    for (let i = 0; i < Math.min(x.length, yv.length); i++) puntos.push({ x: x[i], y: yv[i] });
    let xmin = Infinity, xmax = -Infinity;
    for (let i = 0; i < puntos.length; i++) {
      if (puntos[i].x < xmin) xmin = puntos[i].x;
      if (puntos[i].x > xmax) xmax = puntos[i].x;
    }
    scatter = new Chart(canvasScatter.getContext('2d'), {
      data: {
        datasets: [
          {
            type: 'scatter',
            label: 'Observaciones',
            data: puntos,
            backgroundColor: sY.color + '99',
            pointRadius: 3,
          },
          {
            type: 'line',
            label: 'Recta MCO',
            data: [
              { x: xmin, y: reg.b0 + reg.b1 * xmin },
              { x: xmax, y: reg.b0 + reg.b1 * xmax },
            ],
            borderColor: '#1c3c63',
            borderWidth: 2,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: sX.titulo } },
          y: { title: { display: true, text: sY.titulo } },
        },
        plugins: { legend: { position: 'top' } },
      },
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function dibujar(fechas, sA, datosA, sB, datosB) {
    if (chart) chart.destroy();
    chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: fechas,
        datasets: [
          { label: sA.titulo, data: datosA, borderColor: sA.color, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.15 },
          { label: sB.titulo, data: datosB, borderColor: sB.color, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.15 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
          zoom: {
            zoom: {
              wheel: { enabled: true, speed: 0.12 },
              pinch: { enabled: true },
              mode: 'x',
              onZoomComplete: mostrarResetZoomLab,
            },
            pan: {
              enabled: true,
              mode: 'x',
              onPanComplete: mostrarResetZoomLab,
            },
            limits: { x: { min: 'original', max: 'original' } },
          },
        },
        scales: { x: { ticks: { maxTicksLimit: 12 } } },
      },
    });
    canvas.style.cursor = 'grab';
    // Nuevo gráfico → el hint de zoom vuelve a mostrarse hasta el próximo zoom/pan.
    if (hintZoom) { hintZoom.style.transition = ''; hintZoom.style.opacity = ''; }
  }

  // ── Pipeline principal ───────────────────────────────────────────────────────
  let pidiendo = 0;
  async function actualizar() {
    escribirHash();
    const idA = selA.value, idB = selB.value, freq = selFreq.value;
    const sA = SERIES.find(s => s.id === idA), sB = SERIES.find(s => s.id === idB);

    if (idA === idB) {
      elInsight.textContent = 'Elegí dos series distintas para comparar.';
      elFresh.textContent = '';
      if (chart) { chart.destroy(); chart = null; }
      limpiarRegresion();
      return;
    }

    const ticket = ++pidiendo;
    elInsight.textContent = 'Cargando datos…';
    try {
      const [rawA, rawB] = await Promise.all([datosDe(idA), datosDe(idB)]);
      if (ticket !== pidiendo) return; // llegó una petición más nueva

      const mA = agregarDatos(rawA.map(d => ({ fecha: d.fecha, valor: d.valor })), freq);
      const mB = agregarDatos(rawB.map(d => ({ fecha: d.fecha, valor: d.valor })), freq);
      const al = alinearSeries(mA, mB);

      elFresh.textContent = 'Última actualización — ' + [frescuraTexto(sA, rawA), frescuraTexto(sB, rawB)].join(' · ');

      if (al.n === 0) {
        elInsight.textContent = 'No hay períodos en común entre estas dos series.';
        if (chart) { chart.destroy(); chart = null; }
        limpiarRegresion();
        return;
      }

      let normA = normalizar(al.a, modo);
      let normB = normalizar(al.b, modo);
      let fechas = al.fechas;
      if (modo === 'variacion') fechas = al.fechas.slice(1); // variación pierde el primer punto

      const maxLag = freq === 'mensual' ? 12 : 6;
      const r = pearson(normA, normB);
      const lag = crossCorrelation(normA, normB, maxLag, Math.max(4, Math.floor(MIN_N[freq] / 2)));

      dibujar(fechas, sA, normA, sB, normB);

      if (r == null) {
        elInsight.textContent = 'Alguna de las series no tiene variación en el período: no se puede calcular la correlación.';
      } else {
        elInsight.innerHTML = generarInsight(sA, sB, r, lag, normA.length, freq, maxLag);
      }

      ultimo = { sA, sB, normA, normB, freq };
      renderRegresion();
    } catch (err) {
      if (ticket !== pidiendo) return;
      elInsight.textContent = 'No se pudieron cargar los datos. Probá de nuevo en un momento.';
    }
  }

  // ── Eventos ──────────────────────────────────────────────────────────────────
  [selA, selB, selFreq].forEach(el => el.addEventListener('change', actualizar));
  grupoModo.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-modo]');
    if (!b) return;
    modo = b.dataset.modo;
    aplicarModoUI();
    actualizar();
  });
  grupoDir.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-dir]');
    if (!b) return;
    dirReg = b.dataset.dir;
    aplicarDirUI();
    escribirHash();
    renderRegresion();
  });
  btnShare.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      const txt = btnShare.textContent;
      btnShare.textContent = '✓ Enlace copiado';
      setTimeout(() => { btnShare.textContent = txt; }, 1800);
    } catch { /* sin clipboard: el usuario puede copiar la URL a mano */ }
  });

  // Link compartido abierto estando ya en la página (back/forward o pegar URL).
  // escribirHash() usa replaceState, que NO dispara hashchange → sin loop.
  window.addEventListener('hashchange', () => { leerHash(); actualizar(); });

  leerHash();
  actualizar();
})();
