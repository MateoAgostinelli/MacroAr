"""Publica un informe semanal (generado con informes/generar_informe.py y
convertido a PDF con informes/render_pdf.py) en la sección pública /reportes
del sitio.

A diferencia de informes/ (privado, fuera de git — ahí viven los .md fuente,
los informes con nombre de cliente y los PDFs de prueba), lo que este script
genera SÍ se sube al repo público: una página web del informe y su PDF para
descargar, listados en reportes.html. Publicar un informe es una acción
deliberada — no hay nada automático, se corre a mano por cada edición que se
quiera hacer pública.

Uso:
    python publicar_reporte.py informes/2026-08-30-semana-del-2308-al-30082026.md
    python publicar_reporte.py informes/2026-08-30-....md informes/2026-08-30-....pdf

Si no se pasa el PDF, busca uno con el mismo nombre al lado del .md.
"""
import sys
import re
import shutil
from pathlib import Path

import markdown as md

RAIZ = Path(__file__).parent
REPORTES_DIR = RAIZ / "reportes"
REPORTES_HTML = RAIZ / "reportes.html"
SITEMAP_PATH = RAIZ / "sitemap.xml"
BASE_URL = "https://macroar.com.ar"

MARCADOR_INICIO = "<!-- LISTA_INFORMES:INICIO -->"
MARCADOR_FIN = "<!-- LISTA_INFORMES:FIN -->"


def extraer_portada(texto):
    """Misma lógica que informes/render_pdf.py: separa título/metadatos del cuerpo."""
    lineas = texto.splitlines()
    titulo = "Informe"
    meta = []
    corte = -1
    for i, linea in enumerate(lineas):
        if linea.startswith("# ") and titulo == "Informe":
            titulo = linea[2:].strip()
        elif re.match(r"^\*\*[^*]+:\*\*", linea):
            meta.append(linea.strip())
        elif linea.strip() == "---":
            corte = i + 1
            break
    resto = "\n".join(lineas[corte:]) if corte >= 0 else texto
    return titulo, meta, resto


def meta_a_dict(meta_lineas):
    d = {}
    for linea in meta_lineas:
        m = re.match(r"^\*\*([^*]+):\*\*\s*(.*)$", linea.strip())
        if m:
            d[m.group(1).strip().lower()] = m.group(2).strip()
    return d


def primer_parrafo_texto(resto_md):
    """Primer párrafo del cuerpo, sin marcado, para el resumen de la tarjeta."""
    for bloque in resto_md.split("\n\n"):
        bloque = bloque.strip()
        if not bloque or bloque.startswith("#") or bloque.startswith("|"):
            continue
        texto = re.sub(r"[*_`]", "", bloque)
        texto = re.sub(r"\s+", " ", texto).strip()
        if texto:
            return texto[:220].rsplit(" ", 1)[0] + ("…" if len(texto) > 220 else "")
    return ""


def slugify(texto):
    texto = texto.lower().strip()
    texto = re.sub(r"[^\w\s-]", "", texto)
    return re.sub(r"[\s_]+", "-", texto).strip("-")


def construir_pagina_html(titulo, meta_dict, slug, cuerpo_html):
    fecha = meta_dict.get("fecha", "")
    periodo = meta_dict.get("período analizado", meta_dict.get("periodo analizado", ""))
    descripcion = f"{titulo} — Informe semanal de MacroAr, {periodo}.".strip()
    descripcion_html = descripcion.replace('"', "&quot;")

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{titulo} — MacroAr</title>
  <meta name="description" content="{descripcion_html}">
  <link rel="canonical" href="{BASE_URL}/reportes/{slug}">
  <meta name="theme-color" content="#1c3c63">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="MacroAr">
  <meta property="og:locale" content="es_AR">
  <meta property="og:url" content="{BASE_URL}/reportes/{slug}">
  <meta property="og:title" content="{titulo} — MacroAr">
  <meta property="og:description" content="{descripcion_html}">
  <meta property="og:image" content="{BASE_URL}/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{titulo} — MacroAr">
  <meta name="twitter:description" content="{descripcion_html}">
  <meta name="twitter:image" content="{BASE_URL}/og-image.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css">
</head>
<body class="page-reportes">

  <!-- Navbar -->
  <nav class="navbar">
    <div class="nav-inner">
      <span class="nav-logo">Macro<span>Ar</span></span>
      <div class="nav-links">
        <a href="/">Inicio</a>
        <a href="/datos">Datos</a>
        <a href="/reportes" style="color: var(--teal-dark); font-weight: 600;">Informes</a>
        <a href="/contacto">Contacto</a>
      </div>
      <div class="nav-actions"><a class="nav-cta" href="/laboratorio">Laboratorio</a></div>
      <button class="nav-burger" aria-label="Abrir menú" aria-expanded="false" aria-controls="nav-mobile">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>
  <nav class="nav-mobile" id="nav-mobile" aria-label="Menú mobile">
    <a href="/">Inicio</a>
    <a href="/datos">Datos</a>
    <a href="/reportes">Informes</a>
    <a href="/contacto">Contacto</a>
    <a href="/laboratorio" class="nav-mobile-cta">Laboratorio</a>
  </nav>

  <main class="reporte-detalle">
    <a href="/reportes" class="btn-back" id="btn-back">← Volver a Informes</a>
    <h1 style="font-family:'Poppins',sans-serif; font-size:1.8rem; color:var(--navy); margin:1.25rem 0 0.5rem;">{titulo}</h1>
    <div class="reporte-meta-top">
      <span><strong>Fecha:</strong> {fecha}</span>
      <span><strong>Período analizado:</strong> {periodo}</span>
    </div>
    <a class="reporte-descarga" href="/reportes/{slug}.pdf" download>⬇ Descargar PDF</a>

    <div class="reporte-cuerpo">
{cuerpo_html}
    </div>
  </main>

  <!-- Footer -->
  <footer id="fuentes">
    <div class="footer-inner">
      <div class="footer-logo">Macro<span>Ar</span></div>
      <p class="footer-desc">Visualización de datos macroeconómicos de Argentina.</p>
      <div class="footer-links">
        <a href="/reportes">Informes</a>
        <a href="/laboratorio">Laboratorio</a>
        <a href="/contacto">Contacto</a>
        <a href="https://www.bcra.gob.ar" target="_blank">BCRA</a>
        <a href="https://apis.datos.gob.ar/series" target="_blank">datos.gob.ar</a>
        <a href="https://www.indec.gob.ar" target="_blank">INDEC</a>
      </div>
    </div>
  </footer>

</body>
</html>
"""


def construir_tarjeta(titulo, meta_dict, slug, resumen):
    fecha = meta_dict.get("fecha", "")
    periodo = meta_dict.get("período analizado", meta_dict.get("periodo analizado", ""))
    return f"""      <a class="reporte-card" href="/reportes/{slug}">
        <span class="reporte-fecha">{periodo or fecha}</span>
        <h2>{titulo}</h2>
        <p>{resumen}</p>
        <span class="reporte-link">Leer informe</span>
      </a>
"""


def actualizar_listado(tarjeta_html):
    texto = REPORTES_HTML.read_text(encoding="utf-8")
    ini = texto.index(MARCADOR_INICIO) + len(MARCADOR_INICIO)
    fin = texto.index(MARCADOR_FIN)
    contenido_actual = texto[ini:fin]
    # La primera vez, reemplaza el mensaje de "todavía no hay informes".
    if 'class="reportes-vacio"' in contenido_actual:
        contenido_actual = ""
    nuevo_contenido = "\n" + tarjeta_html + contenido_actual
    texto = texto[:ini] + nuevo_contenido + texto[fin:]
    REPORTES_HTML.write_text(texto, encoding="utf-8")


def actualizar_sitemap(slug):
    texto = SITEMAP_PATH.read_text(encoding="utf-8")
    nueva_url = f"  <url><loc>{BASE_URL}/reportes/{slug}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n"
    if f"/reportes/{slug}<" in texto:
        return  # ya está
    texto = texto.replace("</urlset>", nueva_url + "</urlset>")
    SITEMAP_PATH.write_text(texto, encoding="utf-8")


def main():
    if len(sys.argv) < 2:
        print("Uso: python publicar_reporte.py <informe.md> [informe.pdf]", file=sys.stderr)
        sys.exit(1)

    md_path = Path(sys.argv[1]).resolve()
    if not md_path.exists():
        print(f"No existe: {md_path}", file=sys.stderr)
        sys.exit(1)

    pdf_path = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else md_path.with_suffix(".pdf")
    if not pdf_path.exists():
        print(f"No existe el PDF: {pdf_path}. Generalo con informes/render_pdf.py o pasalo como segundo argumento.", file=sys.stderr)
        sys.exit(1)

    texto = md_path.read_text(encoding="utf-8")
    titulo, meta_lineas, resto = extraer_portada(texto)
    meta_dict = meta_a_dict(meta_lineas)
    resumen = primer_parrafo_texto(resto)
    cuerpo_html = md.markdown(resto, extensions=["tables", "sane_lists", "fenced_code"])

    slug = slugify(md_path.stem)

    REPORTES_DIR.mkdir(exist_ok=True)
    pagina_html = construir_pagina_html(titulo, meta_dict, slug, cuerpo_html)
    (REPORTES_DIR / f"{slug}.html").write_text(pagina_html, encoding="utf-8")
    shutil.copyfile(pdf_path, REPORTES_DIR / f"{slug}.pdf")

    tarjeta = construir_tarjeta(titulo, meta_dict, slug, resumen)
    actualizar_listado(tarjeta)
    actualizar_sitemap(slug)

    print(f"Publicado: reportes/{slug}.html")
    print(f"PDF copiado a: reportes/{slug}.pdf")
    print("Actualizado: reportes.html, sitemap.xml")
    print()
    print("Revisá el resultado y avisame para comitear y pushear.")


if __name__ == "__main__":
    main()
