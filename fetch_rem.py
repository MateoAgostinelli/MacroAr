"""
fetch_rem.py — Trae las series del REM (Relevamiento de Expectativas de Mercado)
del BCRA directo de la web.

El BCRA publica cada mes un Excel "tablas-relevamiento-expectativas-mercado-MMM-AAAA.xlsx".
El Excel tiene cada variable en su propia sección stacked verticalmente (una tras otra).
Cada sección tiene su propio encabezado en la columna 1 y los estadísticos como columnas
(Mediana, Promedio, Desvío, Máximo, Mínimo, Percentil 90/75/25/10, Cantidad).
Tomamos siempre la Mediana (columna índice 3).

Nota: desde dic-2024 el BCRA reemplazó BADLAR por TAMAR en el REM.
rem-badlar.json ahora contiene la expectativa de TAMAR (misma lógica, nombre de archivo
compatible con el resto del sitio — actualizar label en app.js si se desea).
"""

import io
import json
import os
import re
import ssl
import sys
import urllib.request
import warnings

import pandas as pd

try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL_CTX = ssl.create_default_context()

sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore")

BASE = "https://www.bcra.gob.ar"
PAGE = f"{BASE}/relevamiento-expectativas-mercado-rem/"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
OUTPUT_DIR = "data"
SKIPROWS = 6
COL_FECHA = 1
COL_MEDIANA = 3

# Para cada serie: qué substring buscar en col 1 para encontrar el header de la sección.
# La primera sección (IPC general) no tiene header visible post-skiprows → se lee desde row 0.
SERIES = [
    {"id": "rem-ipc",          "header": None},                   # primera sección, sin header visible
    {"id": "rem-ipc-nucleo",   "header": "IPC n"},                # "IPC núcleo"
    {"id": "rem-badlar",       "header": "Tasa de inter"},        # TAMAR (reemplazó BADLAR en dic-2024)
    {"id": "rem-tcn",          "header": "Tipo de cambio nominal"},
    {"id": "rem-expo",         "header": "Exportaciones"},
    {"id": "rem-impo",         "header": "Importaciones"},
    {"id": "rem-resultado",    "header": "Resultado Primario"},
    {"id": "rem-desocupacion", "header": "Desocupaci"},           # "Desocupación"
    {"id": "rem-pib",          "header": "PIB a precios"},
]


def http_get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60, context=_SSL_CTX) as r:
        return r.read()


MESES_ES = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}


def link_tablas():
    html = http_get(PAGE).decode("utf-8", "ignore")
    # Formato actual (sitio nuevo del BCRA, desde oct-2026):
    #   relevamiento-expectativas-mercado-tablas-AAAA-MM.xlsx
    m = re.search(r'href="(/[^"]*relevamiento-expectativas-mercado-tablas-(\d{4})-(\d{2})\.xlsx)"', html, re.I)
    if m:
        return BASE + m.group(1), f"{m.group(2)}-{m.group(3)}-01"
    # Formato viejo: tablas-relevamiento-expectativas-mercado-MMM-AAAA.xlsx
    m = re.search(r'href="(/[^"]*tablas-relevamiento-expectativas-mercado-([a-z]{3})-(\d{4})\.xlsx)"', html, re.I)
    if not m:
        raise RuntimeError("No se encontró el link del Excel 'tablas' en la página del REM.")
    mes_str = m.group(2).lower()
    anio = int(m.group(3))
    mes_num = MESES_ES.get(mes_str, 1)
    publicacion = f"{anio}-{mes_num:02d}-01"
    return BASE + m.group(1), publicacion


def extraer_seccion(df, header_contains, search_from=0):
    """
    Ubica la sección de una variable buscando su header en col 1.
    Retorna un DataFrame con columnas [fecha, valor] ya parseados y limpios.
    Devuelve también el índice de la fila donde termina la sección.
    """
    col1_str = df.iloc[:, COL_FECHA].astype(str)

    if header_contains is None:
        # Primera sección: empieza en la fila 0
        data_start = 0
    else:
        mask = col1_str.iloc[search_from:].str.contains(header_contains, case=False, na=False)
        if not mask.any():
            raise RuntimeError(f"Header '{header_contains}' no encontrado en el Excel.")
        header_row = mask.idxmax()
        # El header de la sección ocupa 1 fila, la siguiente es el sub-header de columnas ("Período", etc.)
        data_start = header_row + 2

    # Buscar el primer blank después del inicio de datos
    data_end = len(df)
    for i in range(data_start, len(df)):
        v = df.iloc[i, COL_FECHA]
        if pd.isna(v) or str(v).strip() in ("", "nan"):
            data_end = i
            break

    sub = df.iloc[data_start:data_end, [COL_FECHA, COL_MEDIANA]].copy()
    sub.columns = ["fecha", "valor"]
    sub["fecha"] = pd.to_datetime(sub["fecha"], errors="coerce")
    sub["valor"] = pd.to_numeric(sub["valor"], errors="coerce")
    sub = sub.dropna()

    return sub, data_end


def parsear_xlsx(contenido_bytes):
    df = pd.read_excel(io.BytesIO(contenido_bytes), sheet_name=0,
                       skiprows=SKIPROWS, header=None, engine="openpyxl")
    return df


def main():
    url, publicacion = link_tablas()
    print(f"Bajando: {url}  (edición: {publicacion})")
    xlsx = http_get(url)
    df = parsear_xlsx(xlsx)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    ok = 0
    search_from = 0

    for serie in SERIES:
        try:
            sub, section_end = extraer_seccion(df, serie["header"], search_from)
            if sub.empty:
                raise RuntimeError("sin datos válidos")
            sub["fecha"] = sub["fecha"].dt.strftime("%Y-%m-%d")
            registros = sub.sort_values("fecha").to_dict(orient="records")
            ruta = os.path.join(OUTPUT_DIR, f"{serie['id']}.json")
            with open(ruta, "w", encoding="utf-8") as f:
                json.dump({"publicacion": publicacion, "datos": registros}, f, ensure_ascii=False, indent=2)
            print(f"✅ {serie['id']}: {len(registros)} registros → {ruta}")
            ok += 1
            search_from = section_end
        except Exception as e:
            print(f"❌ {serie['id']}: {e}", file=sys.stderr)

    if ok == 0:
        sys.exit(1)
    print(f"\n{ok}/{len(SERIES)} series del REM actualizadas.")


if __name__ == "__main__":
    main()
