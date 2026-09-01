// Editor de gráficos personalizados (MacroAr).
// Reusa de app.js: SERIES, obtenerDatosSerie, charts, descargarPNG.
// De lib.js: agregarDatos, normalizar, formatFecha.
// Todo client-side: el usuario arma un gráfico con hasta 6 series, personaliza
// color/tipo/eje de cada una, y lo comparte vía URL hash.
(function () {
  if (typeof SERIES === 'undefined') return;

  const MAX_SERIES = 6;
  const TIPOS = ['line', 'bar', 'area'];
  const EJES = ['l', 'r'];

  // Universo: todo el catálogo real (acá sí entran las REM: no hay correlación
  // que las invalide, son series como cualquier otra para graficar).
  const UNIVERSO = SERIES.filter(s => !String(s.fuente).startsWith('mock'));

  const contSeries = document.getElementById('ctor-series');
  const btnAdd = document.getElementById('ctor-add');
  const inputTitulo = document.getElementById('ctor-titulo');
  const selFreq = document.getElementById('ctor-freq');
  const grupoModo = document.getElementById('ctor-modo');
  const inputDesde = document.getElementById('ctor-desde');
  const inputHasta = document.getElementById('ctor-hasta');
  const elFresh = document.getElementById('ctor-freshness');
  const btnPng = document.getElementById('ctor-png');
  const btnCsv = document.getElementById('ctor-csv');
  const btnShare = document.getElementById('ctor-share');
  const canvas = document.getElementById('ctor-chart');
  const hintZoom = document.getElementById('ctor-hint-zoom');
  const elInsight = document.getElementById('ctor-insight');
  if (!contSeries || !canvas) return;

  // ── Tooltip arrastrable ──────────────────────────────────────────────────────
  // El tooltip por defecto de Chart.js es semitransparente y sigue al mouse, así
  // que a veces tapa justo la línea que se quiere leer. Se reemplaza por un div
  // propio (fondo sólido, más legible) que además se puede arrastrar con el
  // mouse (cursor de "manito") para sacarlo de en medio; el corrimiento elegido
  // se mantiene mientras se sigue navegando el gráfico.
  let tooltipOffset = { x: 0, y: 0 };
  let arrastrandoTooltip = false;
  let arrastreInicio = null;

  document.addEventListener('mousemove', (e) => {
    if (!arrastrandoTooltip) return;
    tooltipOffset.x = arrastreInicio.offX + (e.clientX - arrastreInicio.x);
    tooltipOffset.y = arrastreInicio.offY + (e.clientY - arrastreInicio.y);
  });
  document.addEventListener('mouseup', () => {
    if (!arrastrandoTooltip) return;
    arrastrandoTooltip = false;
    const el = document.getElementById('ctor-tooltip-el');
    if (el) el.style.cursor = 'grab';
  });

  function renderTooltipExterno(context) {
    const { chart, tooltip } = context;
    let el = document.getElementById('ctor-tooltip-el');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ctor-tooltip-el';
      el.style.cssText = `
        position:absolute; pointer-events:auto; z-index:20; top:0; left:0;
        background:rgba(15,23,42,0.94); color:#fff; border-radius:8px;
        padding:8px 11px; font-family:'Inter',Arial,sans-serif; font-size:12px;
        line-height:1.55; cursor:grab; box-shadow:0 4px 14px rgba(0,0,0,.28);
        white-space:nowrap;
      `;
      chart.canvas.parentNode.appendChild(el);
      el.addEventListener('mousedown', (e) => {
        arrastrandoTooltip = true;
        arrastreInicio = { x: e.clientX, y: e.clientY, offX: tooltipOffset.x, offY: tooltipOffset.y };
        el.style.cursor = 'grabbing';
        e.preventDefault();
      });
    }

    if (tooltip.opacity === 0) { el.style.opacity = '0'; return; }

    let html = '';
    (tooltip.title || []).forEach(t => {
      html += `<div style="font-weight:600;margin-bottom:3px;">${t}</div>`;
    });
    tooltip.dataPoints.forEach((dp, i) => {
      const color = dp.dataset.borderColor || dp.dataset.backgroundColor || '#fff';
      const linea = (tooltip.body[i] && tooltip.body[i].lines[0]) || '';
      html += `<div style="display:flex; align-items:center; gap:6px;">`
        + `<span style="width:9px; height:9px; border-radius:2px; background:${color}; flex:none;"></span>`
        + `<span>${linea}</span></div>`;
    });
    el.innerHTML = html;
    el.style.opacity = '1';
    el.style.left = (tooltip.caretX + tooltipOffset.x) + 'px';
    el.style.top = (tooltip.caretY + tooltipOffset.y) + 'px';
  }

  function mostrarResetZoomCtor() {
    if (hintZoom) { hintZoom.style.transition = 'opacity .4s'; hintZoom.style.opacity = '0'; }
  }

  canvas.addEventListener('dblclick', () => { if (chart) chart.resetZoom(); });
  canvas.addEventListener('mousedown', () => { canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('mouseup', () => { canvas.style.cursor = 'grab'; });

  // Estado. Cada fila: { id, color ('#rrggbb'), tipo ('line'|'bar'|'area'), eje ('l'|'r') }
  let filas = [
    { id: 'tc-oficial', color: null, tipo: 'line', eje: 'l' },
    { id: 'tc-blue', color: null, tipo: 'line', eje: 'l' },
  ];
  let modo = 'niveles';
  let chart = null;
  let ultimoRender = null; // { fechas, columnas } para exportar CSV
  const cache = {};

  // ── Estilos del gráfico ──────────────────────────────────────────────────────
  const ESTILOS = {
    macroar:      { bg: '#ffffff', grid: true,  gridColor: '#f1f5f9',              tick: '#5b6675', texto: '#22384e', width: 2,   points: 0, legend: 'top',    tension: 0.15, font: 12, titleFont: 16 },
    oscuro:       { bg: '#16283c', grid: true,  gridColor: 'rgba(255,255,255,.08)', tick: '#b9c6d4', texto: '#e8eef4', width: 2,   points: 0, legend: 'top',    tension: 0.15, font: 12, titleFont: 16 },
    minimal:      { bg: '#ffffff', grid: false, gridColor: '#f1f5f9',              tick: '#8296a9', texto: '#22384e', width: 1.5, points: 0, legend: 'bottom', tension: 0.25, font: 11, titleFont: 15 },
    presentacion: { bg: '#ffffff', grid: true,  gridColor: '#e5eaef',              tick: '#22384e', texto: '#22384e', width: 3,   points: 0, legend: 'top',    tension: 0.15, font: 14, titleFont: 20 },
  };
  let estilo = 'macroar';
  // Overrides del panel avanzado ('' = usar lo que diga el preset).
  const adv = { grid: '', width: '', points: '', legend: '', suave: '' };
  const selEstilo = document.getElementById('ctor-estilo');
  const panelAdv = document.getElementById('ctor-avanzado');

  function estiloEfectivo() {
    const p = ESTILOS[estilo];
    return {
      ...p,
      grid: adv.grid === '' ? p.grid : adv.grid === '1',
      width: adv.width === '' ? p.width : Number(adv.width),
      points: adv.points === '' ? p.points : Number(adv.points),
      legend: adv.legend === '' ? p.legend : adv.legend,
      tension: adv.suave === '' ? p.tension : Number(adv.suave) / 100,
    };
  }

  function serieDe(id) { return SERIES.find(s => s.id === id); }

  function colorDefault(id) {
    const s = serieDe(id);
    let c = (s && s.color) || '#1c3c63';
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) c = '#1c3c63';
    return c.toLowerCase();
  }

  // ── Estado <-> URL hash ──────────────────────────────────────────────────────
  // Formato: #t=<titulo>&f=<freq>&m=<modo>&d1=<desde>&d2=<hasta>&s=id:rrggbb:tipo:eje,...
  function leerHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.get('t') != null) inputTitulo.value = p.get('t').slice(0, 80);
    if (['original', 'mensual', 'trimestral', 'anual'].includes(p.get('f'))) selFreq.value = p.get('f');
    if (['niveles', 'indice', 'variacion', 'interanual'].includes(p.get('m'))) modo = p.get('m');
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.get('d1') || '')) inputDesde.value = p.get('d1');
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.get('d2') || '')) inputHasta.value = p.get('d2');
    if (p.get('s')) {
      const parseadas = p.get('s').split(',').map(tok => {
        const [id, color, tipo, eje] = tok.split(':');
        if (!UNIVERSO.some(s => s.id === id)) return null;
        return {
          id,
          color: /^[0-9a-f]{6}$/i.test(color || '') ? '#' + color.toLowerCase() : null,
          tipo: TIPOS.includes(tipo) ? tipo : 'line',
          eje: EJES.includes(eje) ? eje : 'l',
        };
      }).filter(Boolean);
      if (parseadas.length) filas = parseadas.slice(0, MAX_SERIES);
    }
    if (ESTILOS[p.get('e')]) estilo = p.get('e');
    if (['1', '0'].includes(p.get('g'))) adv.grid = p.get('g');
    if (['1', '2', '3', '4'].includes(p.get('w'))) adv.width = p.get('w');
    if (['0', '2', '3'].includes(p.get('pt'))) adv.points = p.get('pt');
    if (['top', 'bottom', 'off'].includes(p.get('lg'))) adv.legend = p.get('lg');
    if (['0', '15', '40'].includes(p.get('sv'))) adv.suave = p.get('sv');
    aplicarModoUI();
    aplicarEstiloUI();
  }

  function escribirHash() {
    // En /laboratorio con pestañas, esta herramienta convive con laboratorio.js
    // en la misma página, cada una con su propio estado en la URL (y algunas
    // claves con el mismo nombre pero distinto significado, ej. "f"/"m"). Para
    // que un click en la otra pestaña no borre este link compartible, acá no
    // se toca el hash mientras la pestaña de Gráficos no está activa.
    if (window.__labTabActiva && window.__labTabActiva !== 'graficos') return;
    const p = new URLSearchParams();
    if (inputTitulo.value.trim()) p.set('t', inputTitulo.value.trim());
    p.set('f', selFreq.value);
    p.set('m', modo);
    if (inputDesde.value) p.set('d1', inputDesde.value);
    if (inputHasta.value) p.set('d2', inputHasta.value);
    p.set('s', filas.map(f =>
      `${f.id}:${(f.color || colorDefault(f.id)).slice(1)}:${f.tipo}:${f.eje}`
    ).join(','));
    if (estilo !== 'macroar') p.set('e', estilo);
    if (adv.grid !== '') p.set('g', adv.grid);
    if (adv.width !== '') p.set('w', adv.width);
    if (adv.points !== '') p.set('pt', adv.points);
    if (adv.legend !== '') p.set('lg', adv.legend);
    if (adv.suave !== '') p.set('sv', adv.suave);
    history.replaceState(null, '', '#' + p.toString());
  }

  function aplicarModoUI() {
    grupoModo.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.modo === modo));
  }

  function aplicarEstiloUI() {
    if (selEstilo) selEstilo.value = estilo;
    if (!panelAdv) return;
    panelAdv.querySelectorAll('select[data-adv]').forEach(sel => {
      sel.value = adv[sel.dataset.adv];
    });
    // Si hay algún override activo, dejar el panel abierto al cargar un link.
    if (Object.values(adv).some(v => v !== '')) panelAdv.open = true;
  }

  // ── Filas de serie (UI) ──────────────────────────────────────────────────────
  function opciones(selected) {
    return UNIVERSO.map(s =>
      `<option value="${s.id}"${s.id === selected ? ' selected' : ''}>${s.titulo}</option>`
    ).join('');
  }

  function renderFilas() {
    contSeries.innerHTML = '';
    filas.forEach((f, i) => {
      const row = document.createElement('div');
      row.className = 'ctor-series-row';
      row.innerHTML = `
        <select data-i="${i}" data-campo="id" aria-label="Serie ${i + 1}">${opciones(f.id)}</select>
        <input type="color" data-i="${i}" data-campo="color" value="${f.color || colorDefault(f.id)}" aria-label="Color de la serie ${i + 1}">
        <select data-i="${i}" data-campo="tipo" aria-label="Tipo de gráfico de la serie ${i + 1}">
          <option value="line"${f.tipo === 'line' ? ' selected' : ''}>Línea</option>
          <option value="bar"${f.tipo === 'bar' ? ' selected' : ''}>Barras</option>
          <option value="area"${f.tipo === 'area' ? ' selected' : ''}>Área</option>
        </select>
        <select data-i="${i}" data-campo="eje" aria-label="Eje de la serie ${i + 1}">
          <option value="l"${f.eje === 'l' ? ' selected' : ''}>Eje izq.</option>
          <option value="r"${f.eje === 'r' ? ' selected' : ''}>Eje der.</option>
        </select>
        <button type="button" class="ctor-quitar" data-i="${i}" aria-label="Quitar serie ${i + 1}" ${filas.length <= 1 ? 'disabled' : ''}>✕</button>
      `;
      contSeries.appendChild(row);
    });
    btnAdd.disabled = filas.length >= MAX_SERIES;
    btnAdd.textContent = filas.length >= MAX_SERIES ? `Máximo ${MAX_SERIES} series` : '+ Agregar serie';
  }

  contSeries.addEventListener('change', (e) => {
    const el = e.target.closest('[data-i][data-campo]');
    if (!el) return;
    const i = Number(el.dataset.i);
    const campo = el.dataset.campo;
    if (!filas[i]) return;
    filas[i][campo] = el.value;
    if (campo === 'id') {
      filas[i].color = null; // al cambiar de serie, volver a su color default
      renderFilas();
    }
    actualizar();
  });

  contSeries.addEventListener('click', (e) => {
    const b = e.target.closest('button.ctor-quitar');
    if (!b || filas.length <= 1) return;
    filas.splice(Number(b.dataset.i), 1);
    renderFilas();
    actualizar();
  });

  btnAdd.addEventListener('click', () => {
    if (filas.length >= MAX_SERIES) return;
    // Sugerir una serie que todavía no esté en el gráfico.
    const usadas = new Set(filas.map(f => f.id));
    const libre = UNIVERSO.find(s => !usadas.has(s.id)) || UNIVERSO[0];
    filas.push({ id: libre.id, color: null, tipo: 'line', eje: 'l' });
    renderFilas();
    actualizar();
  });

  // ── Fetch (cacheado) ─────────────────────────────────────────────────────────
  async function datosDe(id) {
    if (cache[id]) return cache[id];
    const datos = await obtenerDatosSerie(serieDe(id), 3650, 120, true);
    cache[id] = datos;
    return datos;
  }

  // ── Brecha / crecimiento acumulado ──────────────────────────────────────────
  // Crecimiento total entre el primer y el último dato del rango elegido (no
  // depende del modo de visualización ni de la frecuencia, siempre se calcula
  // sobre los niveles/tasas crudos). Para series ya en % (serie.variacion,
  // ej. IPC) se compone cada período en vez de restar niveles.
  function crecimientoAcumulado(datos, serie) {
    if (datos.length < 2) return null;
    if (serie.variacion) {
      let compuesto = 1;
      for (const d of datos) compuesto *= (1 + d.valor / 100);
      return (compuesto - 1) * 100;
    }
    const primero = datos[0].valor;
    const ultimo = datos[datos.length - 1].valor;
    if (!primero) return null;
    return (ultimo / primero - 1) * 100;
  }

  function actualizarInsight(crudasFiltradas) {
    const validas = crudasFiltradas.filter(c => c.crecimiento != null);
    if (validas.length < 1) { elInsight.style.display = 'none'; return; }

    const fmt = n => n.toLocaleString('es-AR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    const lineas = validas.map(c => `<strong>${c.serie.titulo}</strong> acumuló ${fmt(c.crecimiento)}%`);

    let brechaTxt = '';
    if (validas.length === 2) {
      const [a, b] = validas;
      const idxA = 100 + a.crecimiento;
      const idxB = 100 + b.crecimiento;
      if (idxB > 0) {
        const brecha = (idxA / idxB - 1) * 100;
        const [mayor, menor] = idxA >= idxB ? [a, b] : [b, a];
        brechaTxt = ` — <strong>${mayor.serie.titulo}</strong> le sacó una brecha acumulada de <strong>${fmt(Math.abs(brecha))}%</strong> a <strong>${menor.serie.titulo}</strong> en el período elegido.`;
      }
    }

    elInsight.innerHTML = lineas.join(' · ') + brechaTxt;
    elInsight.style.display = '';
  }

  // ── Frescura ─────────────────────────────────────────────────────────────────
  function frescuraTexto(serie, datos) {
    if (!datos.length) return '';
    const ultima = datos[datos.length - 1].fecha;
    const dias = Math.floor((Date.now() - new Date(ultima.slice(0, 10) + 'T00:00:00').getTime()) / 86400000);
    return `${serie.titulo}: ${formatFecha(ultima, serie)}${dias > 75 ? ' ⚠️' : ''}`;
  }

  // ── Pipeline y render ────────────────────────────────────────────────────────
  let pidiendo = 0;
  async function actualizar() {
    escribirHash();
    const ticket = ++pidiendo;
    elFresh.textContent = 'Cargando datos…';
    try {
      const crudas = await Promise.all(filas.map(f => datosDe(f.id)));
      if (ticket !== pidiendo) return;

      const desde = inputDesde.value || null;
      const hasta = inputHasta.value || null;
      const freq = selFreq.value;

      // Por serie: filtrar rango → agregar → normalizar (manteniendo sus fechas).
      const crecimientos = [];
      const procesadas = filas.map((f, idx) => {
        const serie = serieDe(f.id);
        let datos = crudas[idx].map(d => ({ fecha: d.fecha, valor: d.valor }));
        if (desde) datos = datos.filter(d => d.fecha >= desde);
        if (hasta) datos = datos.filter(d => d.fecha <= hasta);
        crecimientos.push({ serie, crecimiento: crecimientoAcumulado(datos, serie) });

        let fechas, valores;
        if (modo === 'interanual') {
          // Unidad común (% vs. mismo período del año anterior) para poder
          // comparar series nominales (índices/niveles) con series de precios.
          // - Índices y niveles: ratio contra k períodos atrás.
          // - Variaciones mensuales (serie.variacion, ej. IPC): composición de k períodos.
          // - Tasas ya en % (BADLAR, desocupación...): se muestran tal cual.
          const freqEf = freq === 'original' ? 'mensual' : freq;
          const agg = agregarDatos(datos, freqEf);
          const k = { mensual: 12, trimestral: 4, anual: 1 }[freqEf];
          const vs = agg.map(d => d.valor);
          fechas = []; valores = [];
          if (serie.variacion) {
            for (let i = k - 1; i < agg.length; i++) {
              let comp = 1;
              for (let j = i - k + 1; j <= i; j++) comp *= 1 + vs[j] / 100;
              fechas.push(agg[i].fecha);
              valores.push((comp - 1) * 100);
            }
          } else if ((serie.unidad || '').includes('%')) {
            fechas = agg.map(d => d.fecha);
            valores = vs.slice();
          } else {
            for (let i = k; i < agg.length; i++) {
              if (vs[i - k]) {
                fechas.push(agg[i].fecha);
                valores.push((vs[i] / vs[i - k] - 1) * 100);
              }
            }
          }
        } else {
          if (freq !== 'original') datos = agregarDatos(datos, freq);
          fechas = datos.map(d => d.fecha);
          valores = normalizar(datos.map(d => d.valor), modo);
          if (modo === 'variacion') fechas = fechas.slice(1);
        }
        return { fila: f, serie, fechas, valores };
      });

      // Unión ordenada de fechas de todas las series.
      const setFechas = new Set();
      procesadas.forEach(p => p.fechas.forEach(fe => setFechas.add(fe)));
      const fechas = [...setFechas].sort();
      if (!fechas.length) {
        elFresh.textContent = 'No hay datos en el rango elegido.';
        if (chart) { chart.destroy(); chart = null; }
        ultimoRender = null;
        return;
      }

      const idxFecha = new Map(fechas.map((fe, i) => [fe, i]));
      const columnas = procesadas.map(p => {
        const col = new Array(fechas.length).fill(null);
        p.fechas.forEach((fe, i) => { col[idxFecha.get(fe)] = p.valores[i]; });
        return { serie: p.serie, fila: p.fila, valores: col };
      });

      const st = estiloEfectivo();
      const usaDerecho = filas.some(f => f.eje === 'r');
      const datasets = columnas.map(c => {
        const color = c.fila.color || colorDefault(c.fila.id);
        const base = {
          label: c.serie.titulo,
          data: c.valores,
          yAxisID: c.fila.eje === 'r' ? 'y2' : 'y',
          spanGaps: true,
        };
        if (c.fila.tipo === 'bar') {
          return { ...base, type: 'bar', backgroundColor: color + 'cc', borderColor: color, borderWidth: 1 };
        }
        if (c.fila.tipo === 'area') {
          return { ...base, type: 'line', borderColor: color, backgroundColor: color + '33', fill: true, borderWidth: st.width, pointRadius: st.points, tension: st.tension };
        }
        return { ...base, type: 'line', borderColor: color, backgroundColor: 'transparent', borderWidth: st.width, pointRadius: st.points, tension: st.tension };
      });

      // Título de cada eje Y: qué serie(s) usan ese eje y en qué unidad, para
      // poder identificarlas sin ambigüedad cuando hay eje izq. y der. a la vez.
      // Si el eje lo usa una sola serie, el título se pinta de su color.
      function tituloEje(lado) {
        const cols = columnas.filter(c => c.fila.eje === lado);
        if (!cols.length) return { text: '', color: st.texto };
        const nombres = cols.map(c => c.serie.titulo).join(' · ');
        let unidadTxt;
        if (modo === 'indice') unidadTxt = 'índice base 100';
        else if (modo === 'variacion') unidadTxt = '% variación';
        else if (modo === 'interanual') unidadTxt = '% var. interanual';
        else {
          const unidades = [...new Set(cols.map(c => c.serie.unidad).filter(Boolean))];
          unidadTxt = unidades.length === 1 ? unidades[0] : '';
        }
        const text = unidadTxt ? `${nombres} (${unidadTxt})` : nombres;
        const color = cols.length === 1 ? (cols[0].fila.color || colorDefault(cols[0].fila.id)) : st.texto;
        return { text, color };
      }
      const tituloIzq = tituloEje('l');
      const tituloDer = usaDerecho ? tituloEje('r') : null;

      const ejeBase = {
        ticks: { color: st.tick, font: { size: st.font } },
        grid: { display: st.grid, color: st.gridColor },
        border: { color: st.gridColor },
      };
      const escalas = {
        x: {
          ...ejeBase,
          ticks: { ...ejeBase.ticks, maxTicksLimit: 12 },
          title: { display: true, text: 'Fecha', color: st.texto, font: { size: st.font, weight: '600' } },
        },
        y: {
          ...ejeBase,
          position: 'left',
          title: { display: !!tituloIzq.text, text: tituloIzq.text, color: tituloIzq.color, font: { size: st.font, weight: '600' } },
        },
      };
      if (usaDerecho) {
        escalas.y2 = {
          ...ejeBase,
          position: 'right',
          grid: { display: false },
          title: { display: !!tituloDer.text, text: tituloDer.text, color: tituloDer.color, font: { size: st.font, weight: '600' } },
        };
      }

      // El fondo se pinta sobre el canvas mismo (no solo CSS) para que el PNG
      // exportado conserve el tema (ej. fondo oscuro).
      const bgPlugin = {
        id: 'ctorBg',
        beforeDraw(c) {
          const ctx = c.ctx;
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.fillStyle = st.bg;
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.restore();
        },
      };

      if (chart) chart.destroy();
      chart = new Chart(canvas.getContext('2d'), {
        data: { labels: fechas, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: st.legend !== 'off',
              position: st.legend === 'off' ? 'top' : st.legend,
              labels: { color: st.texto, font: { size: st.font } },
            },
            title: {
              display: !!inputTitulo.value.trim(),
              text: inputTitulo.value.trim(),
              color: st.texto,
              font: { size: st.titleFont, weight: '600' },
            },
            tooltip: {
              enabled: false,
              external: renderTooltipExterno,
            },
            zoom: {
              zoom: {
                wheel: { enabled: true, speed: 0.12 },
                pinch: { enabled: true },
                mode: 'x',
                onZoomComplete: mostrarResetZoomCtor,
              },
              pan: {
                enabled: true,
                mode: 'x',
                onPanComplete: mostrarResetZoomCtor,
              },
              limits: { x: { min: 'original', max: 'original' } },
            },
          },
          scales: escalas,
        },
        plugins: [bgPlugin],
      });
      charts['ctor'] = chart; // registrar para descargarPNG (app.js)
      canvas.parentElement.style.background = st.bg; // el wrap acompaña el tema
      canvas.style.cursor = 'grab';
      // Nuevo gráfico → el hint de zoom vuelve a mostrarse hasta el próximo zoom/pan.
      if (hintZoom) { hintZoom.style.transition = ''; hintZoom.style.opacity = ''; }

      ultimoRender = { fechas, columnas };
      elFresh.textContent = 'Última actualización — ' +
        procesadas.map(p => frescuraTexto(p.serie, cache[p.fila.id])).join(' · ');
      actualizarInsight(crecimientos);
    } catch (err) {
      if (ticket !== pidiendo) return;
      elFresh.textContent = 'No se pudieron cargar los datos. Probá de nuevo en un momento.';
      elInsight.style.display = 'none';
    }
  }

  // ── Exportar ─────────────────────────────────────────────────────────────────
  btnPng.addEventListener('click', () => {
    if (!chart) return;
    descargarPNG('ctor', inputTitulo.value.trim() || 'grafico-personalizado');
  });

  btnCsv.addEventListener('click', () => {
    if (!ultimoRender) return;
    const { fechas, columnas } = ultimoRender;
    const esc = t => /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    const header = ['fecha', ...columnas.map(c => esc(c.serie.titulo))].join(',');
    const lineas = fechas.map((fe, i) =>
      [fe, ...columnas.map(c => c.valores[i] == null ? '' : c.valores[i])].join(','));
    const csv = [header, ...lineas].join('\n');
    const link = document.createElement('a');
    const slug = (inputTitulo.value.trim() || 'grafico-personalizado')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    link.download = `macroar-${slug}.csv`;
    link.href = 'data:text/csv;charset=utf-8,﻿' + encodeURIComponent(csv);
    link.click();
  });

  btnShare.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      const txt = btnShare.textContent;
      btnShare.textContent = '✓ Enlace copiado';
      setTimeout(() => { btnShare.textContent = txt; }, 1800);
    } catch { /* sin clipboard: el usuario puede copiar la URL a mano */ }
  });

  // ── Eventos globales ─────────────────────────────────────────────────────────
  [selFreq, inputDesde, inputHasta].forEach(el => el.addEventListener('change', actualizar));
  let tituloTimer = null;
  inputTitulo.addEventListener('input', () => {
    clearTimeout(tituloTimer);
    tituloTimer = setTimeout(actualizar, 400); // debounce: no redibujar por tecla
  });
  grupoModo.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-modo]');
    if (!b) return;
    modo = b.dataset.modo;
    aplicarModoUI();
    actualizar();
  });
  if (selEstilo) selEstilo.addEventListener('change', () => {
    estilo = selEstilo.value;
    actualizar();
  });
  if (panelAdv) panelAdv.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-adv]');
    if (!sel) return;
    adv[sel.dataset.adv] = sel.value;
    actualizar();
  });

  // escribirHash() usa replaceState (no dispara hashchange) → sin loop.
  window.addEventListener('hashchange', () => { leerHash(); renderFilas(); actualizar(); });

  leerHash();
  renderFilas();
  actualizar();
})();
