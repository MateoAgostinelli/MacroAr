#!/usr/bin/env node
// Genera una página estática por indicador en indicador/<slug>.html con SEO
// horneado (título, descripción, canonical, Open Graph) y regenera sitemap.xml.
//
// Fuente de verdad: el array SERIES de app.js (no se duplica nada).
// Correr cada vez que se agreguen o cambien indicadores:
//     node generar-paginas.js

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BASE_URL = 'https://macroar.com.ar';

// ── 1. Extraer SERIES de app.js (es un literal de datos puro) ────────────────
function leerSeries() {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const m = src.match(/const SERIES = (\[[\s\S]*?\n\]);/);
  if (!m) throw new Error('No se encontró el array SERIES en app.js');
  // El literal es data pura (sin llamadas a funciones) → evaluarlo es seguro.
  return eval(m[1]);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 2. Plantilla de cada página de indicador ─────────────────────────────────
function plantilla(serie) {
  const slug   = serie.slug || serie.id;
  const url    = `${BASE_URL}/indicador/${slug}`;
  const titulo = `${serie.titulo} — MacroAr`;
  const desc   = serie.descripcion
    || `${serie.titulo} de Argentina: serie histórica con gráfico interactivo y datos para descargar.`;
  const t = escapeHtml(titulo), d = escapeHtml(desc);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t}</title>
  <meta name="description" content="${d}">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#1c3c63">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="MacroAr">
  <meta property="og:locale" content="es_AR">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${t}">
  <meta property="og:description" content="${d}">
  <meta property="og:image" content="${BASE_URL}/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${t}">
  <meta name="twitter:description" content="${d}">
  <meta name="twitter:image" content="${BASE_URL}/og-image.png">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Dataset","name":${JSON.stringify(serie.titulo)},"description":${JSON.stringify(desc)},"url":${JSON.stringify(url)},"publisher":{"@type":"Organization","name":"MacroAr","url":"${BASE_URL}"},"spatialCoverage":"Argentina","inLanguage":"es-AR"}</script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>
</head>
<body class="page-detalle" data-serie-id="${escapeHtml(serie.id)}">

  <!-- Navbar -->
  <nav class="navbar">
    <div class="nav-inner">
      <a href="/" class="nav-logo" aria-label="MacroAr — ir al inicio">Macro<span>Ar</span></a>
      <div class="nav-links">
        <a href="/datos">Datos</a>
        <a href="/reportes">Informes</a>
        <a href="/contacto">Contacto</a>
      </div>
      <div class="nav-actions"><a class="nav-cta" href="/laboratorio">Laboratorio</a></div>
      <button class="nav-burger" aria-label="Abrir menú" aria-expanded="false" aria-controls="nav-mobile">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>
  <nav class="nav-mobile" id="nav-mobile" aria-label="Menú mobile">
    <a href="/datos">Datos</a>
    <a href="/reportes">Informes</a>
    <a href="/contacto">Contacto</a>
    <a href="/laboratorio" class="nav-mobile-cta">Laboratorio</a>
  </nav>

  <!-- Contenedor principal de la vista detallada -->
  <main class="detalle-container" id="detalle-container">
    <a href="/datos" class="btn-back" id="btn-back">← Volver atrás</a>
    <div id="detalle-content">
      <h1 class="detalle-titulo-static">${escapeHtml(serie.titulo)}</h1>
      <p class="detalle-desc-static">${escapeHtml(desc)}</p>
    </div>
  </main>

  <!-- Footer -->
  <footer id="fuentes">
    <div class="footer-inner">
      <div class="footer-logo">Macro<span>Ar</span></div>
      <p class="footer-desc">Visualización de datos macroeconómicos de Argentina.</p>
      <div class="footer-links">
        <a href="/laboratorio">Laboratorio</a>
        <a href="/contacto">Contacto</a>
        <a href="https://www.bcra.gob.ar" target="_blank">BCRA</a>
        <a href="https://apis.datos.gob.ar/series" target="_blank">datos.gob.ar</a>
        <a href="https://www.indec.gob.ar" target="_blank">INDEC</a>
      </div>
    </div>
  </footer>

  <script src="/lib.js"></script>
  <script src="/app.js"></script>
</body>
</html>
`;
}

// ── 3. Generar páginas ───────────────────────────────────────────────────────
const SERIES = leerSeries();
const dir = path.join(ROOT, 'indicador');
fs.mkdirSync(dir, { recursive: true });

const slugs = [];
for (const serie of SERIES) {
  const slug = serie.slug || serie.id;
  slugs.push(slug);
  fs.writeFileSync(path.join(dir, `${slug}.html`), plantilla(serie), 'utf8');
}

// ── 4. Regenerar sitemap.xml ─────────────────────────────────────────────────
const hoy = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${BASE_URL}/`,            freq: 'daily',   prio: '1.0' },
  { loc: `${BASE_URL}/datos`,       freq: 'daily',   prio: '0.8' },
  { loc: `${BASE_URL}/laboratorio`, freq: 'weekly',  prio: '0.7' },
  { loc: `${BASE_URL}/editor`, freq: 'weekly',  prio: '0.7' },
  { loc: `${BASE_URL}/reportes`, freq: 'weekly',  prio: '0.7' },
  { loc: `${BASE_URL}/contacto`,    freq: 'monthly', prio: '0.5' },
  ...slugs.map(s => ({ loc: `${BASE_URL}/indicador/${s}`, freq: 'daily', prio: '0.7' })),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${hoy}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.prio}</priority>
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');

console.log(`✓ Generadas ${slugs.length} páginas en indicador/`);
console.log(`✓ sitemap.xml actualizado (${urls.length} URLs)`);
