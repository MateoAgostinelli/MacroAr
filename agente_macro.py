"""
Agente macroeconómico de Argentina.
Consulta datos en tiempo real de las mismas fuentes que MacroAr y responde
preguntas usando la API de Claude con tool_use.

Uso:
    python agente_macro.py
    python agente_macro.py "¿Cómo está la brecha cambiaria?"

Requiere:
    ANTHROPIC_API_KEY en .env o como variable de entorno
    pip install anthropic python-dotenv
"""
import os
import re
import sys
import json
import datetime
import ssl
import unicodedata
import urllib.request
import urllib.error
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX = ssl.create_default_context()

import anthropic

# ── Catálogo de series ────────────────────────────────────────────────────────
# Mirrors SERIES array in app.js. "variacion": True means raw data is an index
# and calcular_variacion will compute % change; False means already a rate/%.

SERIES_CATALOG = {
    # Mercado Cambiario
    "tc-oficial": {
        "titulo": "Dólar Oficial (BNA, venta)",
        "fuente": "bluelytics", "tipo_tc": "oficial",
        "unidad": "$/USD", "categoria": "Mercado Cambiario",
        "variacion": True,
    },
    "tc-blue": {
        "titulo": "Dólar Blue (venta)",
        "fuente": "bluelytics", "tipo_tc": "blue",
        "unidad": "$/USD", "categoria": "Mercado Cambiario",
        "variacion": True,
    },
    "tc-mayorista": {
        "titulo": "Dólar Mayorista (BCRA)",
        "fuente": "bcra", "serieId": 4,
        "unidad": "$/USD", "categoria": "Mercado Cambiario",
        "variacion": True,
    },
    "dolar-mep": {
        "titulo": "Dólar MEP (Bolsa)",
        "fuente": "argentinadatos", "serieId": "cotizaciones/dolares/bolsa", "campo": "venta",
        "unidad": "$/USD", "categoria": "Mercado Cambiario",
        "variacion": True,
    },
    "dolar-ccl": {
        "titulo": "Dólar CCL (Contado con Liqui)",
        "fuente": "argentinadatos", "serieId": "cotizaciones/dolares/contadoconliqui", "campo": "venta",
        "unidad": "$/USD", "categoria": "Mercado Cambiario",
        "variacion": True,
    },
    # Sector Monetario
    "reservas": {
        "titulo": "Reservas Internacionales",
        "fuente": "bcra", "serieId": 1,
        "unidad": "millones USD", "categoria": "Sector Monetario",
        "variacion": True,
    },
    "base-monetaria": {
        "titulo": "Base Monetaria",
        "fuente": "bcra", "serieId": 15,
        "unidad": "millones ARS", "categoria": "Sector Monetario",
        "variacion": True,
    },
    # Sistema Financiero
    "tpm": {
        "titulo": "Tasa de Política Monetaria",
        "fuente": "bcra", "serieId": 28,
        "unidad": "% anual", "categoria": "Sistema Financiero",
    },
    "tasa-badlar": {
        "titulo": "Tasa BADLAR (bancos privados)",
        "fuente": "bcra", "serieId": 8,
        "unidad": "% anual", "categoria": "Sistema Financiero",
    },
    "tasa-plazo-fijo": {
        "titulo": "Tasa Plazo Fijo (hasta $1M, hasta 44 días)",
        "fuente": "bcra", "serieId": 7,
        "unidad": "% anual", "categoria": "Sistema Financiero",
    },
    "uva": {
        "titulo": "UVA (Unidad de Valor Adquisitivo)",
        "fuente": "bcra", "serieId": 31,
        "unidad": "ARS", "categoria": "Sistema Financiero",
        "variacion": True,
    },
    # Precios
    "inflacion": {
        "titulo": "IPC (Índice de Precios al Consumidor, INDEC)",
        "fuente": "indec", "serieId": "148.3_INIVELNAL_DICI_M_26",
        "unidad": "índice (base dic 2016=100)", "categoria": "Precios",
        "variacion": True,
        "nota": "Usar calcular_variacion tipo='mensual' para obtener % inflación mensual",
    },
    "ipim": {
        "titulo": "Precios Mayoristas (IPIM, var. i.a.)",
        "fuente": "indec", "serieId": "448.1_NIVEL_GENERAL_0_0_13_46",
        "unidad": "índice (base 2015=100)", "categoria": "Precios",
        "variacion": True,
    },
    # Actividad y Sector Real
    "emae": {
        "titulo": "Actividad Económica (EMAE, desestacionalizada)",
        "fuente": "emae", "serieId": "143.3_NO_PR_2004_A_31",
        "unidad": "índice (base 2004=100)", "categoria": "Actividad",
        "variacion": True,
    },
    "ipi-manufacturero": {
        "titulo": "Producción Industrial Manufacturera (IPI)",
        "fuente": "indec", "serieId": "453.1_SERIE_ORIGNAL_0_0_14_46",
        "unidad": "índice", "categoria": "Sector Real",
        "variacion": True,
    },
    "isac": {
        "titulo": "Actividad Constructora (ISAC)",
        "fuente": "indec", "serieId": "33.2_ISAC_NIVELRAL_0_M_18_63",
        "unidad": "índice", "categoria": "Sector Real",
        "variacion": True,
    },
    "salarios-total": {
        "titulo": "Índice de Salarios (Total)",
        "fuente": "indec", "serieId": "149.1_TL_INDIIOS_OCTU_0_21",
        "unidad": "índice", "categoria": "Sector Real",
        "variacion": True,
    },
    "salarios-privado": {
        "titulo": "Salarios Privados (Registrado)",
        "fuente": "indec", "serieId": "149.1_SOR_PRIADO_OCTU_0_25",
        "unidad": "índice", "categoria": "Sector Real",
        "variacion": True,
    },
    "salarios-publico": {
        "titulo": "Salarios Públicos",
        "fuente": "indec", "serieId": "149.1_SOR_PUBICO_OCTU_0_14",
        "unidad": "índice", "categoria": "Sector Real",
        "variacion": True,
    },
    # Finanzas Públicas
    "recaudacion-total": {
        "titulo": "Recaudación Total (ARCA/DGI)",
        "fuente": "indec", "serieId": "172.3_TL_RECAION_M_0_0_17",
        "unidad": "millones ARS", "categoria": "Finanzas Públicas",
        "variacion": True,
    },
    # Mercado de Capitales
    "riesgo-pais": {
        "titulo": "Riesgo País Argentina (EMBI+)",
        "fuente": "argentinadatos", "serieId": "finanzas/indices/riesgo-pais",
        "unidad": "puntos básicos", "categoria": "Mercado de Capitales",
        "variacion": True,
    },
    "merval": {
        "titulo": "Índice Merval (Bolsa de Buenos Aires)",
        "fuente": "local", "serieId": "merval",
        "unidad": "ARS", "categoria": "Mercado de Capitales",
        "variacion": True,
    },
    # Commodities
    "soja": {
        "titulo": "Soja Chicago (CBOT, USD/tn)",
        "fuente": "local", "serieId": "soja",
        "unidad": "USD/tonelada", "categoria": "Commodities",
        "variacion": True,
    },
    "wti": {
        "titulo": "Petróleo WTI (NYMEX)",
        "fuente": "local", "serieId": "wti",
        "unidad": "USD/barril", "categoria": "Commodities",
        "variacion": True,
    },
    "brent": {
        "titulo": "Petróleo Brent (ICE)",
        "fuente": "local", "serieId": "brent",
        "unidad": "USD/barril", "categoria": "Commodities",
        "variacion": True,
    },
    "oro": {
        "titulo": "Oro (futuro COMEX)",
        "fuente": "local", "serieId": "oro",
        "unidad": "USD/oz", "categoria": "Commodities",
        "variacion": True,
    },
    # Expectativas (REM BCRA)
    "rem-inflacion": {
        "titulo": "Inflación esperada (REM BCRA)",
        "fuente": "local", "serieId": "rem-ipc",
        "unidad": "% mensual", "categoria": "REM / Expectativas",
    },
    "rem-tipo-cambio": {
        "titulo": "Tipo de cambio esperado (REM BCRA)",
        "fuente": "local", "serieId": "rem-tcn",
        "unidad": "$/USD", "categoria": "REM / Expectativas",
        "variacion": True,
    },
    "rem-pib": {
        "titulo": "Crecimiento del PIB esperado (REM BCRA)",
        "fuente": "local", "serieId": "rem-pib",
        "unidad": "% anual", "categoria": "REM / Expectativas",
    },
}

DATA_DIR = Path(__file__).parent / "data"
NOTICIAS_DIR = DATA_DIR / "noticias"

# ── Funciones de fetch por fuente ─────────────────────────────────────────────

def _get(url: str, headers: dict = None) -> dict | list:
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "MacroAr-Agente/1.0"})
    with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
        return json.loads(r.read())


def _iso_hace_dias(dias: int) -> str:
    return (datetime.date.today() - datetime.timedelta(days=dias)).isoformat()


def _iso_hace(meses: int) -> str:
    hoy = datetime.date.today()
    anio = hoy.year - (meses // 12)
    mes = hoy.month - (meses % 12)
    if mes <= 0:
        mes += 12
        anio -= 1
    return datetime.date(anio, mes, 1).isoformat()


def fetch_bcra(serie_id: int, meses: int) -> list[dict]:
    desde = _iso_hace(meses + 2)
    hasta = datetime.date.today().isoformat()
    url = f"https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/{serie_id}?desde={desde}&hasta={hasta}"
    data = _get(url)
    # results es lista de {idVariable, detalle: [{fecha, valor}]}
    results = data.get("results", [])
    if results and isinstance(results[0], dict) and "detalle" in results[0]:
        filas = results[0]["detalle"]
    else:
        filas = results
    return [{"fecha": r["fecha"], "valor": r["valor"]} for r in filas]


def fetch_indec(serie_id: str, meses: int) -> list[dict]:
    desde = _iso_hace(meses + 2)
    url = (
        f"https://apis.datos.gob.ar/series/api/series/"
        f"?ids={serie_id}&start_date={desde}&limit=5000&format=json"
    )
    data = _get(url)
    filas = data.get("data", [])
    return [{"fecha": row[0], "valor": row[1]} for row in filas if row[1] is not None]


def fetch_bluelytics(tipo_tc: str, meses: int) -> list[dict]:
    dias = meses * 31
    url = f"https://api.bluelytics.com.ar/v2/evolution.json?range={dias}"
    data = _get(url)
    # source: "Oficial" / "Blue" (capitalized), campo: value_sell
    casa = "Oficial" if tipo_tc == "oficial" else "Blue"
    return [
        {"fecha": r["date"][:10], "valor": r["value_sell"]}
        for r in data
        if r.get("source") == casa and r.get("value_sell")
    ]


def fetch_argentinadatos(endpoint: str, meses: int, campo: str = "valor") -> list[dict]:
    desde = _iso_hace(meses + 1)
    url = f"https://api.argentinadatos.com/v1/{endpoint}"
    data = _get(url)
    return [
        {"fecha": r["fecha"], "valor": r.get(campo) or r.get("valor")}
        for r in data
        if r.get("fecha", "") >= desde and (r.get(campo) or r.get("valor")) is not None
    ]


def fetch_local(serie_id: str, meses: int) -> list[dict]:
    ruta = DATA_DIR / f"{serie_id}.json"
    if not ruta.exists():
        raise FileNotFoundError(f"No existe data/{serie_id}.json — corré fetch_mercados.py")
    crudo = json.loads(ruta.read_text(encoding="utf-8"))
    # Los REM (fetch_rem.py) se guardan envueltos: {"publicacion": ..., "datos": [...]}.
    # El resto de las series locales son listas planas de {fecha, valor}.
    datos = crudo["datos"] if isinstance(crudo, dict) else crudo
    desde = _iso_hace(meses)
    return [r for r in datos if r["fecha"] >= desde]


def fetch_serie(serie_id: str, meses: int = 12) -> list[dict]:
    meses = min(max(meses, 1), 60)
    cfg = SERIES_CATALOG.get(serie_id)
    if not cfg:
        raise ValueError(f"Serie '{serie_id}' no encontrada. Usá listar_series() para ver las disponibles.")

    fuente = cfg["fuente"]
    if fuente == "bcra":
        datos = fetch_bcra(cfg["serieId"], meses)
    elif fuente == "indec":
        datos = fetch_indec(cfg["serieId"], meses)
    elif fuente == "emae":
        datos = fetch_indec(cfg["serieId"], meses)
    elif fuente == "bluelytics":
        datos = fetch_bluelytics(cfg["tipo_tc"], meses)
    elif fuente == "argentinadatos":
        datos = fetch_argentinadatos(cfg["serieId"], meses, cfg.get("campo", "valor"))
    elif fuente == "local":
        datos = fetch_local(cfg["serieId"], meses)
    else:
        raise ValueError(f"Fuente desconocida: {fuente}")

    datos.sort(key=lambda r: r["fecha"])
    return datos[-meses * 35:]  # cap generoso por si hay datos diarios


# ── Implementación de las herramientas ────────────────────────────────────────

def tool_listar_series() -> dict:
    por_categoria: dict[str, list] = {}
    for sid, cfg in SERIES_CATALOG.items():
        cat = cfg.get("categoria", "Otros")
        por_categoria.setdefault(cat, []).append({
            "id": sid,
            "titulo": cfg["titulo"],
            "unidad": cfg.get("unidad", ""),
        })
    return por_categoria


def tool_get_serie(serie_id: str, meses: int = 12) -> dict:
    cfg = SERIES_CATALOG.get(serie_id)
    if not cfg:
        return {"error": f"Serie '{serie_id}' no existe. Usá listar_series para ver IDs válidos."}
    try:
        datos = fetch_serie(serie_id, meses)
    except Exception as e:
        return {"error": str(e)}

    if not datos:
        return {"error": "La API no devolvió datos para el período solicitado."}

    ultimo = datos[-1]
    anterior = datos[-2] if len(datos) >= 2 else None
    var_m = None
    if anterior and anterior["valor"] and anterior["valor"] != 0:
        var_m = round((ultimo["valor"] / anterior["valor"] - 1) * 100, 2)

    return {
        "serie": serie_id,
        "titulo": cfg["titulo"],
        "unidad": cfg.get("unidad", ""),
        "ultimo_dato": ultimo,
        "variacion_vs_anterior": var_m,
        "n_registros": len(datos),
        "datos": datos,
    }


def tool_calcular_variacion(serie_id: str, tipo: str, meses_historial: int = 12) -> dict:
    cfg = SERIES_CATALOG.get(serie_id)
    if not cfg:
        return {"error": f"Serie '{serie_id}' no existe."}

    periodos_fetch = max(meses_historial + 14, 24)
    try:
        datos = fetch_serie(serie_id, periodos_fetch)
    except Exception as e:
        return {"error": str(e)}

    if len(datos) < 2:
        return {"error": "Datos insuficientes para calcular variación."}

    es_porcentaje = not cfg.get("variacion", False)

    resultado = []

    if tipo == "mensual":
        for i in range(1, len(datos)):
            a, b = datos[i - 1], datos[i]
            if a["valor"] and a["valor"] != 0:
                if es_porcentaje:
                    # Ya es % → devolver el valor directamente
                    resultado.append({"fecha": b["fecha"], "variacion_pct": round(b["valor"], 2)})
                else:
                    resultado.append({
                        "fecha": b["fecha"],
                        "variacion_pct": round((b["valor"] / a["valor"] - 1) * 100, 2),
                    })

    elif tipo == "interanual":
        por_fecha = {r["fecha"]: r["valor"] for r in datos}
        fechas = sorted(por_fecha)
        for f in fechas:
            anio_ant = str(int(f[:4]) - 1) + f[4:]
            if anio_ant in por_fecha and por_fecha[anio_ant]:
                if es_porcentaje:
                    # Suma de 12 variaciones mensuales (aprox. inflación acumulada i.a.)
                    fechas_rango = [d["fecha"] for d in datos if anio_ant <= d["fecha"] <= f]
                    if len(fechas_rango) >= 11:
                        compound = 1.0
                        for fr in fechas_rango:
                            compound *= (1 + por_fecha.get(fr, 0) / 100)
                        resultado.append({"fecha": f, "variacion_pct": round((compound - 1) * 100, 2)})
                else:
                    resultado.append({
                        "fecha": f,
                        "variacion_pct": round((por_fecha[f] / por_fecha[anio_ant] - 1) * 100, 2),
                    })

    elif tipo == "acumulado_anio":
        anio_actual = str(datetime.date.today().year)
        datos_anio = [r for r in datos if r["fecha"].startswith(anio_actual)]
        if not datos_anio:
            return {"error": f"Sin datos para {anio_actual}."}
        if es_porcentaje:
            compound = 1.0
            for r in datos_anio:
                compound *= (1 + r["valor"] / 100)
            acum = round((compound - 1) * 100, 2)
        else:
            primer = datos_anio[0]["valor"]
            ultimo_v = datos_anio[-1]["valor"]
            acum = round((ultimo_v / primer - 1) * 100, 2) if primer else None
        return {
            "tipo": "acumulado_anio",
            "anio": anio_actual,
            "desde": datos_anio[0]["fecha"],
            "hasta": datos_anio[-1]["fecha"],
            "variacion_pct": acum,
            "n_meses": len(datos_anio),
        }

    resultado = resultado[-meses_historial:]
    return {
        "serie": serie_id,
        "titulo": cfg["titulo"],
        "tipo": tipo,
        "unidad_variacion": "% mensual" if tipo == "mensual" else "% interanual",
        "datos": resultado,
        "ultimo": resultado[-1] if resultado else None,
    }


def tool_buscar_noticias(query: str | None = None, fuente: str | None = None, dias: int = 14) -> dict:
    if not NOTICIAS_DIR.exists():
        return {"error": "No hay data/noticias/ — corré fetch_noticias.py"}

    desde = _iso_hace_dias(dias)
    resultados = []
    for ruta in sorted(NOTICIAS_DIR.glob("*.json")):
        nombre_fuente = ruta.stem
        if fuente and fuente.lower() != nombre_fuente.lower():
            continue
        noticias = json.loads(ruta.read_text(encoding="utf-8"))
        for n in noticias:
            if n["fecha"] < desde:
                continue
            if query and query.lower() not in (n["titulo"] + " " + n.get("resumen", "")).lower():
                continue
            resultados.append(n)

    resultados.sort(key=lambda n: n["fecha"], reverse=True)
    return {
        "query": query,
        "fuente": fuente,
        "dias": dias,
        "n_resultados": len(resultados[:20]),
        "noticias": resultados[:20],
    }


# ── Agrupación de noticias por tema entre portales ────────────────────────────
# Cada medio redacta su propio título, así que "la misma noticia" nunca matchea
# textual exacto entre portales — se agrupan por superposición de palabras clave
# (Jaccard sobre título+resumen, sin stopwords). Un tema cubierto por 2+ fuentes
# distintas es la señal de que es un hecho relevante (no una nota de nicho de un
# solo medio), que es justo lo que se quiere priorizar en el informe semanal.

_STOPWORDS_ES = {
    "el", "los", "las", "un", "una", "unos", "unas", "del", "que", "por", "para",
    "con", "sin", "su", "sus", "fue", "ser", "son", "se", "lo", "como", "mas",
    "menos", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas",
    "tras", "hasta", "sobre", "entre", "hoy", "cual", "cuales", "le", "les",
    "dos", "tres", "ante", "hay", "hace", "hacia", "desde", "cada", "todo",
    "toda", "todos", "todas", "muy", "tambien", "pero", "segun", "donde",
    "cuando", "porque", "pues", "aunque", "mientras", "otra", "otro", "otros",
    "otras", "sera", "son", "esta", "estan", "habia",
}


def _normalizar(palabra: str) -> str:
    sin_acentos = unicodedata.normalize("NFKD", palabra).encode("ascii", "ignore").decode("ascii")
    return sin_acentos.lower()


def _palabras_clave(texto: str) -> set:
    crudas = re.findall(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]{4,}", texto)
    return {_normalizar(w) for w in crudas} - _STOPWORDS_ES


def _agrupar_por_tema(noticias: list, min_fuentes: int = 2, umbral: float = 0.22) -> list:
    n = len(noticias)
    palabras = [_palabras_clave(x["titulo"] + " " + x.get("resumen", "")) for x in noticias]

    padre = list(range(n))

    def find(i):
        while padre[i] != i:
            padre[i] = padre[padre[i]]
            i = padre[i]
        return i

    def unir(i, j):
        ri, rj = find(i), find(j)
        if ri != rj:
            padre[rj] = ri

    for i in range(n):
        for j in range(i + 1, n):
            if noticias[i]["fuente"] == noticias[j]["fuente"]:
                continue  # el cruce que importa es ENTRE portales, no dentro del mismo
            if not palabras[i] or not palabras[j]:
                continue
            interseccion = palabras[i] & palabras[j]
            if len(interseccion) < 2:
                continue
            union = palabras[i] | palabras[j]
            if len(interseccion) / len(union) >= umbral:
                unir(i, j)

    grupos = {}
    for i in range(n):
        grupos.setdefault(find(i), []).append(i)

    temas = []
    for idxs in grupos.values():
        fuentes = sorted({noticias[i]["fuente"] for i in idxs})
        if len(fuentes) < min_fuentes:
            continue
        items = sorted((noticias[i] for i in idxs), key=lambda x: x["fecha"], reverse=True)
        tema = max(items, key=lambda x: len(x["titulo"]))["titulo"]
        temas.append({
            "tema": tema,
            "n_fuentes": len(fuentes),
            "fuentes": fuentes,
            "noticias": items,
        })

    temas.sort(key=lambda t: (t["n_fuentes"], t["noticias"][0]["fecha"]), reverse=True)
    return temas


def tool_noticias_tendencia(dias: int = 7, min_fuentes: int = 2) -> dict:
    if not NOTICIAS_DIR.exists():
        return {"error": "No hay data/noticias/ — corré fetch_noticias.py"}

    desde = _iso_hace_dias(dias)
    noticias = []
    for ruta in sorted(NOTICIAS_DIR.glob("*.json")):
        items = json.loads(ruta.read_text(encoding="utf-8"))
        noticias.extend(n for n in items if n["fecha"] >= desde)

    temas = _agrupar_por_tema(noticias, min_fuentes=min_fuentes) if noticias else []
    return {
        "dias": dias,
        "min_fuentes": min_fuentes,
        "n_fuentes_totales": len({n["fuente"] for n in noticias}),
        "n_temas": len(temas),
        "temas": temas[:10],
    }


# ── Tool dispatcher ───────────────────────────────────────────────────────────

TOOLS_DEF = [
    {
        "name": "listar_series",
        "description": (
            "Lista todas las series disponibles agrupadas por categoría. "
            "Llamar siempre antes de get_serie si no se conoce el ID exacto."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_serie",
        "description": (
            "Obtiene los datos históricos de una serie macroeconómica. "
            "Devuelve el array completo de {fecha, valor} más el último dato y la variación vs. el período anterior."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "serie_id": {
                    "type": "string",
                    "description": "ID de la serie (usar listar_series para ver opciones válidas)",
                },
                "meses": {
                    "type": "integer",
                    "description": "Meses de historial a traer (default: 12, máximo: 60)",
                    "default": 12,
                },
            },
            "required": ["serie_id"],
        },
    },
    {
        "name": "calcular_variacion",
        "description": (
            "Calcula variaciones porcentuales de una serie. "
            "tipos: 'mensual' (cada período vs. anterior), "
            "'interanual' (cada período vs. mismo período del año anterior), "
            "'acumulado_anio' (acumulado del año en curso)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "serie_id": {"type": "string"},
                "tipo": {
                    "type": "string",
                    "enum": ["mensual", "interanual", "acumulado_anio"],
                },
                "meses_historial": {
                    "type": "integer",
                    "description": "Meses de historial de variaciones a devolver (default: 12)",
                    "default": 12,
                },
            },
            "required": ["serie_id", "tipo"],
        },
    },
    {
        "name": "buscar_noticias",
        "description": (
            "Busca noticias económicas recientes (Ámbito, Infobae, Urgente24, Página 12) guardadas en data/noticias/. "
            "Útil para contextualizar los datos numéricos con hechos y comunicados recientes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Palabra o frase a buscar en título/resumen (opcional, sin query trae las últimas de todas las fuentes)",
                },
                "fuente": {
                    "type": "string",
                    "description": "Filtrar por fuente puntual, ej. 'ambito' o 'infobae' (opcional)",
                },
                "dias": {
                    "type": "integer",
                    "description": "Antigüedad máxima en días (default: 14)",
                    "default": 14,
                },
            },
            "required": [],
        },
    },
    {
        "name": "noticias_tendencia",
        "description": (
            "Cruza las noticias de TODOS los portales (Ámbito, Infobae, Urgente24, Página 12) "
            "y las agrupa por tema (por superposición de palabras clave, no texto exacto, ya que "
            "cada medio redacta su propio título). Devuelve los temas ordenados por cantidad de "
            "portales distintos que lo cubrieron. Un tema con 2+ fuentes es una señal fuerte de "
            "que es EL hecho relevante de la semana, no una nota de nicho de un solo medio. "
            "Usar esto como primera fuente de verdad para elegir el hecho principal del informe "
            "semanal, antes de buscar_noticias por fuente individual."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "dias": {
                    "type": "integer",
                    "description": "Antigüedad máxima en días (default: 7, pensado para el informe semanal)",
                    "default": 7,
                },
                "min_fuentes": {
                    "type": "integer",
                    "description": "Mínimo de portales distintos que deben cubrir un tema para incluirlo (default: 2)",
                    "default": 2,
                },
            },
            "required": [],
        },
    },
]


def ejecutar_tool(nombre: str, args: dict) -> str:
    try:
        if nombre == "listar_series":
            resultado = tool_listar_series()
        elif nombre == "get_serie":
            resultado = tool_get_serie(args["serie_id"], args.get("meses", 12))
        elif nombre == "calcular_variacion":
            resultado = tool_calcular_variacion(
                args["serie_id"], args["tipo"], args.get("meses_historial", 12)
            )
        elif nombre == "buscar_noticias":
            resultado = tool_buscar_noticias(
                args.get("query"), args.get("fuente"), args.get("dias", 14)
            )
        elif nombre == "noticias_tendencia":
            resultado = tool_noticias_tendencia(
                args.get("dias", 7), args.get("min_fuentes", 2)
            )
        else:
            resultado = {"error": f"Herramienta desconocida: {nombre}"}
    except Exception as e:
        resultado = {"error": str(e)}
    return json.dumps(resultado, ensure_ascii=False)


# ── Loop del agente ───────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Sos un analista macroeconómico especializado en Argentina. \
Tenés acceso a datos en tiempo real de las mismas fuentes que usa el sitio MacroAr: \
BCRA v4.0, INDEC/datos.gob.ar, Bluelytics, ArgentinaDatos, y archivos locales \
(Merval, soja, petróleo WTI/Brent, oro, REM). También tenés buscar_noticias, con \
noticias económicas recientes de medios (Ámbito, Infobae, Urgente24, Página 12) para contextualizar los \
números con hechos y comunicados, y noticias_tendencia para detectar qué hechos \
repercutieron en varios portales a la vez (señal de relevancia real, no ruido de un solo medio).

Cuando respondas:
- Usá las herramientas para traer datos reales antes de hacer afirmaciones numéricas.
- Citá siempre las fechas de los datos que usás.
- Cuando sea relevante, buscá noticias del período para explicar el porqué detrás \
de un movimiento (no solo el número).
- Destacá tendencias, contexto y señales relevantes para un analista o periodista.
- Respondé en español argentino, con lenguaje claro pero técnicamente preciso.
- Si te piden un informe, estructuralo con secciones claras.
- No hagas suposiciones sobre valores actuales sin verificar con las herramientas.
"""


def chat(pregunta: str | None = None):
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    messages: list[dict] = []
    hoy = datetime.date.today().strftime("%d/%m/%Y")

    print(f"\n{'─'*60}")
    print(f"  Agente Macro AR  —  {hoy}")
    print(f"{'─'*60}")
    print("  Ctrl+C para salir | vacío para salir\n")

    while True:
        if pregunta:
            user_input = pregunta
            pregunta = None
        else:
            try:
                user_input = input("Vos: ").strip()
            except (KeyboardInterrupt, EOFError):
                print("\nHasta luego.")
                break

        if not user_input:
            break

        messages.append({"role": "user", "content": user_input})

        while True:
            resp = client.messages.create(
                model="claude-opus-4-8",
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS_DEF,
                messages=messages,
            )

            # Procesar bloques de contenido
            tool_uses = []
            texto_parcial = []
            for bloque in resp.content:
                if bloque.type == "text":
                    texto_parcial.append(bloque.text)
                elif bloque.type == "tool_use":
                    tool_uses.append(bloque)

            if texto_parcial:
                print(f"\nAgente: {''.join(texto_parcial)}\n")

            if resp.stop_reason == "end_turn" or not tool_uses:
                messages.append({"role": "assistant", "content": resp.content})
                break

            # Ejecutar herramientas
            messages.append({"role": "assistant", "content": resp.content})
            tool_results = []
            for tu in tool_uses:
                print(f"  [→ {tu.name}({json.dumps(tu.input, ensure_ascii=False)[:80]}...)]")
                resultado = ejecutar_tool(tu.name, tu.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": resultado,
                })
            messages.append({"role": "user", "content": tool_results})


if __name__ == "__main__":
    if "ANTHROPIC_API_KEY" not in os.environ:
        print("Error: falta ANTHROPIC_API_KEY. Creá un archivo .env con tu API key.")
        sys.exit(1)

    pregunta_inicial = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else None
    chat(pregunta_inicial)
