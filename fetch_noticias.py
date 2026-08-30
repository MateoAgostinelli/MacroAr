"""
Trae noticias económicas de medios con RSS público (o, cuando el medio no
tiene RSS funcional, parseando el JSON embebido de su página) y las guarda
como JSON local en data/noticias/, para que agente_macro.py las pueda usar
como fuente de contexto (tool buscar_noticias).

A diferencia de los fetchers de series, cada fuente solo trae los últimos
~15-30 ítems: cada corrida hace merge con lo ya guardado (dedup por link) y
poda lo de más de PODA_DIAS, así con corridas diarias se arma un historial.

Uso:
    python fetch_noticias.py

Pensado para correr en GitHub Actions (update-noticias.yml).
"""
import re
import sys
import json
import os
import datetime
import email.utils
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')

OUTPUT_DIR = os.path.join('data', 'noticias')
os.makedirs(OUTPUT_DIR, exist_ok=True)

PODA_DIAS = 120

FUENTES = {
    'ambito': 'https://www.ambito.com/rss/pages/economia.xml',
    'infobae': 'https://www.infobae.com/arc/outboundfeeds/rss/category/economia/',
    'urgente24': 'https://urgente24.com/rss/pages/economia.xml',
}

# Página 12 no tiene ningún feed RSS funcional al día de hoy (todos sus
# /rss/secciones/*/notas, incluida la portada, devuelven 404): se arma la
# noticia leyendo el JSON de Arc Publishing (Fusion.globalContent) que la
# propia página de la sección trae embebido en un <script>.
PAGINAS_HTML = {
    'pagina12': 'https://www.pagina12.com.ar/secciones/economia',
}


def _fecha_iso(pub_date: str) -> str:
    try:
        dt = email.utils.parsedate_to_datetime(pub_date)
        return dt.date().isoformat()
    except (TypeError, ValueError):
        return datetime.date.today().isoformat()


def _texto(item, tag):
    el = item.find(tag)
    return (el.text or '').strip() if el is not None else ''


def fetch_rss(fuente, url):
    print(f"Trayendo noticias de {fuente}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        xml_bytes = r.read()
    root = ET.fromstring(xml_bytes)

    nuevos = []
    for item in root.iterfind('.//item'):
        titulo = _texto(item, 'title')
        link = _texto(item, 'link')
        if not titulo or not link:
            continue
        resumen = _texto(item, 'description')
        if len(resumen) > 280:
            resumen = resumen[:277] + '...'
        nuevos.append({
            'fecha': _fecha_iso(_texto(item, 'pubDate')),
            'titulo': titulo,
            'resumen': resumen,
            'link': link,
            'fuente': fuente,
        })
    return nuevos


def fetch_arc_json(fuente, url):
    """Lee el JSON `Fusion.globalContent` embebido en la página de sección
    (formato Arc Publishing, usado por Página 12). Cada item trae fecha
    ISO y URL canónica relativa, no hace falta parsear RSS ni HTML visual."""
    print(f"Trayendo noticias de {fuente}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        html = r.read().decode('utf-8', errors='replace')

    m = re.search(r'Fusion\.globalContent\s*=\s*(\{.*?\});', html, re.S)
    if not m:
        raise ValueError('no se encontró Fusion.globalContent en la página')
    data = json.loads(m.group(1))

    origen = '{uri.scheme}://{uri.netloc}'.format(uri=urllib.parse.urlsplit(url))
    nuevos = []
    for it in data.get('content_elements', []):
        titulo = (it.get('headlines') or {}).get('basic', '').strip()
        ruta = it.get('canonical_url', '')
        if not titulo or not ruta:
            continue
        resumen = (it.get('description') or {}).get('basic', '').strip()
        if len(resumen) > 280:
            resumen = resumen[:277] + '...'
        fecha_raw = it.get('display_date') or it.get('first_publish_date') or ''
        fecha = fecha_raw[:10] if fecha_raw else datetime.date.today().isoformat()
        nuevos.append({
            'fecha': fecha,
            'titulo': titulo,
            'resumen': resumen,
            'link': origen + ruta,
            'fuente': fuente,
        })
    return nuevos


def merge_y_guardar(fuente, nuevos):
    ruta = os.path.join(OUTPUT_DIR, f'{fuente}.json')
    existentes = []
    if os.path.exists(ruta):
        with open(ruta, 'r', encoding='utf-8') as f:
            existentes = json.load(f)

    por_link = {n['link']: n for n in existentes}
    for n in nuevos:
        por_link[n['link']] = n  # los nuevos pisan (por si cambió el resumen)

    limite = (datetime.date.today() - datetime.timedelta(days=PODA_DIAS)).isoformat()
    combinados = [n for n in por_link.values() if n['fecha'] >= limite]
    combinados.sort(key=lambda n: n['fecha'], reverse=True)

    with open(ruta, 'w', encoding='utf-8') as f:
        json.dump(combinados, f, ensure_ascii=False, indent=2)
    print(f"✅ {fuente}: {len(combinados)} noticias guardadas en {ruta}")


if __name__ == "__main__":
    ok = 0
    for fuente, url in FUENTES.items():
        try:
            nuevos = fetch_rss(fuente, url)
            merge_y_guardar(fuente, nuevos)
            ok += 1
        except Exception as e:
            print(f"❌ Error al traer {fuente}: {e}")

    for fuente, url in PAGINAS_HTML.items():
        try:
            nuevos = fetch_arc_json(fuente, url)
            merge_y_guardar(fuente, nuevos)
            ok += 1
        except Exception as e:
            print(f"❌ Error al traer {fuente}: {e}")

    if ok == 0:
        sys.exit(1)
