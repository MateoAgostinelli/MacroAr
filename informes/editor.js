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
