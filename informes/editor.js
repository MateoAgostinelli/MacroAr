// Editor de informes MacroAr — abre el .md generado por generar_informe.py,
// lo muestra editable con el estilo real del PDF (estilo-macroar.css) y permite
// re-exportarlo como .md o imprimirlo/guardarlo como PDF (Ctrl+P nativo del
// navegador ya respeta el @page A4 de estilo-macroar.css).
// Herramienta 100% client-side, sin backend: no hay guardado remoto ni multiusuario.
(function () {
  const elArchivo = document.getElementById('ed-archivo');
  const elTitulo = document.getElementById('ed-titulo');
  const elMeta = document.getElementById('ed-meta');
  const elFechaCab = document.getElementById('ed-fecha-cab');
  const elCuerpo = document.getElementById('ed-cuerpo');
  const elPieTitulo = document.getElementById('ed-pie-titulo');
  const inputCargar = document.getElementById('ed-cargar');

  let nombreBase = 'informe';

  const turndownService = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', hr: '---' });
  if (window.turndownPluginGfm) {
    turndownService.use([turndownPluginGfm.gfm]);
  }
  marked.setOptions({ gfm: true, breaks: false });

  // ── Parseo del .md (misma lógica que informes/render_pdf.py) ───────────────
  function extraerPortada(texto) {
    const lineas = texto.split(/\r?\n/);
    let titulo = 'Informe';
    const meta = [];
    let corte = -1;
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      if (linea.startsWith('# ') && titulo === 'Informe') {
        titulo = linea.slice(2).trim();
      } else if (/^\*\*[^*]+:\*\*/.test(linea)) {
        meta.push(linea.trim());
      } else if (linea.trim() === '---') {
        corte = i + 1;
        break;
      }
    }
    const resto = corte >= 0 ? lineas.slice(corte).join('\n') : texto;
    return { titulo, meta, resto };
  }

  function metaADict(metaLineas) {
    const dict = {};
    for (const linea of metaLineas) {
      const m = linea.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
      if (m) dict[m[1].trim().toLowerCase()] = m[2].trim();
    }
    return dict;
  }

  function renderMetaHtml(metaLineas) {
    return metaLineas
      .map((linea) => {
        const m = linea.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
        return m ? `<div><strong>${m[1]}:</strong> ${m[2]}</div>` : null;
      })
      .filter(Boolean)
      .join('\n');
  }

  function cargarMarkdown(texto, base) {
    const { titulo, meta, resto } = extraerPortada(texto);
    const metaDict = metaADict(meta);
    elTitulo.textContent = titulo;
    elPieTitulo.textContent = titulo;
    elMeta.innerHTML = renderMetaHtml(meta) || '<div><strong>Cliente:</strong> —</div>';
    elFechaCab.textContent = metaDict.fecha || '';
    elCuerpo.innerHTML = marked.parse(resto);
    nombreBase = base;
    elArchivo.textContent = `Editando: ${base}.md`;
  }

  inputCargar.addEventListener('change', () => {
    const file = inputCargar.files[0];
    if (!file) return;
    const lector = new FileReader();
    lector.onload = () => cargarMarkdown(String(lector.result), file.name.replace(/\.(md|markdown)$/i, ''));
    lector.readAsText(file, 'utf-8');
  });

  // ── Toolbar de formato (execCommand: alcanza para un editor de uso personal) ─
  document.querySelectorAll('.editor-toolbar button[data-cmd]').forEach((btn) => {
    btn.addEventListener('click', () => document.execCommand(btn.dataset.cmd, false, null));
  });
  document.querySelectorAll('.editor-toolbar button[data-block]').forEach((btn) => {
    btn.addEventListener('click', () => document.execCommand('formatBlock', false, btn.dataset.block));
  });

  document.getElementById('ed-link').addEventListener('click', () => {
    const url = prompt('URL del enlace:', 'https://');
    if (url) document.execCommand('createLink', false, url);
  });

  document.getElementById('ed-hr').addEventListener('click', () => {
    document.execCommand('insertHorizontalRule', false, null);
  });

  // ── Insertar imagen propia (gráfico armado en /editor, Excel, etc.) ─────────
  // Se embebe como data: URI directamente en el HTML/Markdown — no depende de
  // un servidor ni de subir el archivo a ningún lado, es lo más simple para un
  // informe que se genera y se descarga localmente.
  let rangoImagenGuardado = null;
  const inputImagen = document.getElementById('ed-img-input');
  const btnImagen = document.getElementById('ed-img');

  btnImagen.addEventListener('mousedown', () => {
    const sel = window.getSelection();
    rangoImagenGuardado = (sel.rangeCount && elCuerpo.contains(sel.anchorNode))
      ? sel.getRangeAt(0).cloneRange()
      : null;
  });
  btnImagen.addEventListener('click', () => inputImagen.click());

  inputImagen.addEventListener('change', () => {
    const file = inputImagen.files[0];
    if (!file) return;
    const lector = new FileReader();
    lector.onload = () => {
      elCuerpo.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      if (rangoImagenGuardado) {
        sel.addRange(rangoImagenGuardado);
      } else {
        const r = document.createRange();
        r.selectNodeContents(elCuerpo);
        r.collapse(false); // sin selección previa: insertar al final
        sel.addRange(r);
      }
      document.execCommand('insertHTML', false, `<img src="${lector.result}" alt="${file.name.replace(/\.[^.]+$/, '')}"><p></p>`);
      inputImagen.value = ''; // permite volver a subir el mismo archivo si hace falta
    };
    lector.readAsDataURL(file);
  });

  // ── Agrandar / achicar / mover la imagen insertada ──────────────────────────
  // Al hacer clic sobre una imagen del cuerpo aparece un toolbar flotante con
  // controles de tamaño (ancho en % del cuerpo, se mantiene la relación de
  // aspecto) y de posición (sube/baja como bloque entero en el documento).
  let imgSel = null;
  let toolbarImg = null;

  function crearToolbarImg() {
    const tb = document.createElement('div');
    tb.id = 'ed-img-toolbar';
    tb.style.cssText = `
      position:fixed; z-index:30; display:none; gap:2px;
      background:#16283c; border-radius:8px; padding:4px;
      box-shadow:0 4px 14px rgba(0,0,0,.28); font-family:'Inter',Arial,sans-serif;
    `;
    tb.innerHTML = `
      <button type="button" data-act="achicar" title="Achicar">－</button>
      <button type="button" data-act="agrandar" title="Agrandar">＋</button>
      <button type="button" data-act="subir" title="Mover arriba">▲</button>
      <button type="button" data-act="bajar" title="Mover abajo">▼</button>
    `;
    tb.querySelectorAll('button').forEach((b) => {
      b.style.cssText = 'background:rgba(255,255,255,.1); border:none; color:#fff; width:28px; height:28px; border-radius:5px; cursor:pointer; font-size:14px; line-height:1;';
      b.addEventListener('mousedown', (e) => e.preventDefault()); // no perder la imagen seleccionada
      b.addEventListener('click', () => accionImg(b.dataset.act));
    });
    document.body.appendChild(tb);
    return tb;
  }

  // Tirador en la esquina inferior derecha para redimensionar arrastrando con
  // el mouse (además de los botones － / ＋, para ajuste fino directo).
  let handleResize = null;
  let arrastrandoResize = false;
  let resizeInicio = null;

  function crearHandleResize() {
    const h = document.createElement('div');
    h.id = 'ed-img-resize-handle';
    h.style.cssText = `
      position:fixed; z-index:31; display:none; width:14px; height:14px;
      border-radius:3px; background:#74ACDF; border:2px solid #16283c;
      cursor:nwse-resize;
    `;
    h.addEventListener('mousedown', (e) => {
      if (!imgSel) return;
      arrastrandoResize = true;
      const r = imgSel.getBoundingClientRect();
      resizeInicio = { x: e.clientX, anchoInicial: r.width, anchoCuerpo: elCuerpo.getBoundingClientRect().width };
      e.preventDefault();
      e.stopPropagation();
    });
    document.body.appendChild(h);
    return h;
  }

  document.addEventListener('mousemove', (e) => {
    if (!arrastrandoResize || !imgSel || !resizeInicio) return;
    const nuevoAncho = Math.max(30, resizeInicio.anchoInicial + (e.clientX - resizeInicio.x));
    const pct = Math.max(10, Math.min(100, (nuevoAncho / resizeInicio.anchoCuerpo) * 100));
    imgSel.style.width = pct + '%';
    imgSel.style.height = 'auto';
    posicionarControlesImg();
  });
  document.addEventListener('mouseup', () => {
    arrastrandoResize = false;
    resizeInicio = null;
  });
  window.addEventListener('resize', () => { if (imgSel) posicionarControlesImg(); });

  function posicionarControlesImg() {
    if (!imgSel) return;
    const r = imgSel.getBoundingClientRect();
    if (toolbarImg) {
      toolbarImg.style.display = 'flex';
      toolbarImg.style.left = Math.max(4, r.left) + 'px';
      toolbarImg.style.top = Math.max(4, r.top - 36) + 'px';
    }
    if (handleResize) {
      handleResize.style.display = 'block';
      handleResize.style.left = (r.right - 7) + 'px';
      handleResize.style.top = (r.bottom - 7) + 'px';
    }
  }

  function seleccionarImg(img) {
    if (imgSel) imgSel.classList.remove('ed-img-selected');
    imgSel = img;
    imgSel.classList.add('ed-img-selected');
    if (!toolbarImg) toolbarImg = crearToolbarImg();
    if (!handleResize) handleResize = crearHandleResize();
    posicionarControlesImg();

    // Selección real del nodo (no solo el resaltado visual): así el navegador
    // sabe qué borrar si el usuario aprieta Backspace/Delete.
    const range = document.createRange();
    range.selectNode(img);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Backspace/Delete sobre una imagen seleccionada: se borra directo en vez
  // de depender de que el navegador interprete bien la selección del nodo
  // (inconsistente entre navegadores para elementos que no son texto).
  elCuerpo.addEventListener('keydown', (e) => {
    if (!imgSel) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const img = imgSel;
      deseleccionarImg();
      img.remove();
    }
  });

  function deseleccionarImg() {
    if (imgSel) imgSel.classList.remove('ed-img-selected');
    imgSel = null;
    if (toolbarImg) toolbarImg.style.display = 'none';
    if (handleResize) handleResize.style.display = 'none';
  }

  // Sube el <img> al nivel de bloque directo del cuerpo (si estaba metido
  // dentro de un párrafo de texto) para poder reordenarlo como una unidad.
  function extraerComoBloque(img) {
    if (img.parentNode === elCuerpo) return img;
    let contenedor = img;
    while (contenedor.parentNode && contenedor.parentNode !== elCuerpo) contenedor = contenedor.parentNode;
    img.remove();
    contenedor.after(img);
    return img;
  }

  function accionImg(accion) {
    if (!imgSel) return;
    if (accion === 'achicar' || accion === 'agrandar') {
      const pctActual = parseFloat(imgSel.style.width)
        || Math.round((imgSel.getBoundingClientRect().width / elCuerpo.getBoundingClientRect().width) * 100);
      const pctNuevo = Math.max(15, Math.min(100, pctActual + (accion === 'agrandar' ? 10 : -10)));
      imgSel.style.width = pctNuevo + '%';
      imgSel.style.height = 'auto';
    } else {
      const bloque = extraerComoBloque(imgSel);
      const hermano = accion === 'subir' ? bloque.previousElementSibling : bloque.nextElementSibling;
      if (hermano) {
        if (accion === 'subir') bloque.parentNode.insertBefore(bloque, hermano);
        else bloque.parentNode.insertBefore(hermano, bloque);
      }
    }
    posicionarControlesImg();
  }

  elCuerpo.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG') seleccionarImg(e.target);
    else deseleccionarImg();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('#ed-cuerpo') || e.target.closest('#ed-img-toolbar')) return;
    deseleccionarImg();
  });
  window.addEventListener('scroll', deseleccionarImg, true);

  document.getElementById('ed-tabla').addEventListener('click', () => {
    const tablaHtml = `
      <table>
        <thead><tr><th>Indicador</th><th>Valor</th><th>Variación</th><th>Fecha</th><th>Fuente</th></tr></thead>
        <tbody>
          <tr><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
        </tbody>
      </table>
      <p></p>`;
    document.execCommand('insertHTML', false, tablaHtml);
  });

  document.getElementById('ed-fila').addEventListener('click', () => {
    const sel = window.getSelection();
    let nodo = sel && sel.anchorNode;
    while (nodo && nodo.nodeType !== 1) nodo = nodo.parentNode;
    const tabla = nodo ? nodo.closest('table') : elCuerpo.querySelector('table:last-of-type');
    if (!tabla) return;
    const filas = tabla.querySelectorAll('tbody tr');
    const ultima = filas[filas.length - 1];
    if (!ultima) return;
    const nueva = ultima.cloneNode(true);
    nueva.querySelectorAll('td').forEach((td) => { td.textContent = '—'; });
    ultima.parentNode.appendChild(nueva);
  });

  // ── Exportar ────────────────────────────────────────────────────────────────
  function descargarTexto(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nombre;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  document.getElementById('ed-md').addEventListener('click', () => {
    const titulo = elTitulo.textContent.trim() || 'Informe';
    const metaLineas = [...elMeta.querySelectorAll('div')]
      .map((div) => {
        const strong = div.querySelector('strong');
        if (!strong) return null;
        const clave = strong.textContent.replace(/:$/, '').trim();
        const valor = div.textContent.slice(strong.textContent.length).trim();
        return `**${clave}:** ${valor}`;
      })
      .filter(Boolean)
      .join('\n');
    const cuerpoMd = turndownService.turndown(elCuerpo.innerHTML);
    const md = `# ${titulo}\n\n${metaLineas}\n\n---\n\n${cuerpoMd}\n`;
    descargarTexto(`${nombreBase}.md`, md, 'text/markdown;charset=utf-8');
  });

  document.getElementById('ed-pdf').addEventListener('click', () => window.print());
})();
