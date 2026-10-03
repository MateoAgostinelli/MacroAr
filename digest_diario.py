"""
Resumen macro diario — paso 0 del "agente financiero 24/7".

Objetivo de esta versión: validar si el análisis que arma Claude sirve,
ANTES de construir la tubería automática (cron, email, FRED, heartbeat).
Por eso corre a mano, sin enviar nada:

  1. Junta una foto fija del día con las mismas fuentes que MacroAr
     (reusa las funciones de agente_macro.py — sin LLM en esta parte).
  2. Te pide UNA línea con tu lectura del día, antes de mostrarte nada,
     para poder comparar después (criterio de la semana de prueba).
  3. Hace una sola llamada a Claude con esa foto y guarda el resumen en
     informes/digests/AAAA-MM-DD.md (privado, fuera de git).

Uso:
    python digest_diario.py              # te pide tu lectura del día primero
    python digest_diario.py --sin-nota   # sin pedir la línea (ej. corrida de prueba)
    python digest_diario.py --solo-datos # arma la foto y la imprime, sin llamar a Claude

Requiere ANTHROPIC_API_KEY en .env (igual que agente_macro.py).
Antes de correrlo conviene `git pull`: las noticias y los JSON de mercado
locales los actualiza GitHub Actions en el repo, no en tu máquina.
"""
import os
import sys
import json
import datetime
from pathlib import Path

import anthropic

import agente_macro as am

MODELO = "claude-opus-5-5"
SALIDA_DIR = Path(__file__).parent / "informes" / "digests"

# Series diarias/de mercado: lo que "se mueve hoy".
SERIES_DIARIAS = [
    "tc-oficial", "tc-blue", "tc-mayorista", "dolar-mep", "dolar-ccl",
    "riesgo-pais", "reservas", "merval", "tpm", "tasa-badlar", "uva",
    "soja", "wti", "oro",
]
# Series mensuales: contexto. Solo son "novedad" si el último dato es reciente.
SERIES_MENSUALES = {
    "inflacion": "mensual",       # IPC: variación % mensual
    "emae": "interanual",         # actividad: variación % interanual
}

SYSTEM_PROMPT = """Sos un analista macroeconómico argentino que escribe un resumen diario breve \
para un economista que sigue el mercado todos los días.

Recibís una foto de datos del día ya calculada (valores, variaciones, brechas, fechas) y los \
temas de noticias que cubrieron varios medios a la vez. Escribí en español rioplatense, \
técnico pero claro.

Formato: entre 3 y 5 párrafos cortos, sin títulos ni viñetas.
- Empezá por lo que más cambió o lo más relevante del día, no por un repaso indicador por indicador.
- Conectá los números con las noticias cuando haya relación real; si no la hay, no la fuerces.
- Usá solo las cifras que están en los datos, con su fecha. No calcules cifras nuevas ni redondees \
  de forma que cambie el sentido; las variaciones y brechas ya vienen calculadas.
- Si un indicador no tiene dato del día o el dato es viejo, decilo en vez de presentarlo como actual.
- Las series mensuales (inflación, actividad) son contexto: el período que indican es el mes \
  medido, no el día de publicación. Mencionalas solo si ayudan a leer lo del día.
- Cerrá con una línea de qué mirar en los próximos días.
- Es análisis basado en datos, no una recomendación de inversión: no digas qué comprar ni vender."""


def _resumen_serie(serie_id: str) -> dict:
    """Último dato, anterior y variación de una serie, sin la lista completa."""
    r = am.tool_get_serie(serie_id, meses=2)
    if "error" in r:
        return {"serie": serie_id, "titulo": am.SERIES_CATALOG[serie_id]["titulo"], "sin_dato": r["error"]}
    datos = r["datos"]
    anterior = datos[-2] if len(datos) >= 2 else None
    return {
        "serie": serie_id,
        "titulo": r["titulo"],
        "unidad": r["unidad"],
        "ultimo": r["ultimo_dato"],
        "anterior": anterior,
        "variacion_pct_vs_anterior": r["variacion_vs_anterior"],
    }


def _resumen_mensual(serie_id: str, tipo: str) -> dict:
    r = am.tool_calcular_variacion(serie_id, tipo, meses_historial=3)
    if "error" in r or not r.get("ultimo"):
        return {"serie": serie_id, "titulo": am.SERIES_CATALOG[serie_id]["titulo"],
                "sin_dato": r.get("error", "sin datos")}
    # Las series de INDEC fechan el período (ej. 2026-08-01 = agosto), no el día
    # en que se publicó, así que acá no se puede saber si salió "hoy". Detectar
    # novedades reales queda para la versión con estado persistente (paso 2+).
    return {
        "serie": serie_id,
        "titulo": r["titulo"],
        "tipo_variacion": r["unidad_variacion"],
        "ultimos": r["datos"],
        "periodo_ultimo_dato": r["ultimo"]["fecha"],
    }


def _brecha(a: dict, b: dict) -> float | None:
    try:
        return round((a["ultimo"]["valor"] / b["ultimo"]["valor"] - 1) * 100, 2)
    except (KeyError, TypeError, ZeroDivisionError):
        return None


def _noticias(dias: int = 2) -> tuple[list, str | None]:
    r = am.tool_noticias_tendencia(dias=dias, min_fuentes=2)
    if "error" in r:
        return [], None
    temas = [{
        "tema": t["tema"],
        "fuentes": t["fuentes"],
        "titulares": [{"fecha": n["fecha"], "fuente": n["fuente"], "titulo": n["titulo"],
                       "resumen": n.get("resumen", "")[:300]} for n in t["noticias"][:3]],
    } for t in r["temas"][:8]]
    # Fecha de la noticia más nueva en disco, para avisar si están viejas.
    mas_nueva = None
    for ruta in am.NOTICIAS_DIR.glob("*.json"):
        items = json.loads(ruta.read_text(encoding="utf-8"))
        if items:
            f = max(n["fecha"] for n in items)
            mas_nueva = f if (mas_nueva is None or f > mas_nueva) else mas_nueva
    return temas, mas_nueva


def armar_foto(hoy: datetime.date) -> dict:
    diarias = {sid: _resumen_serie(sid) for sid in SERIES_DIARIAS}
    mensuales = {sid: _resumen_mensual(sid, tipo) for sid, tipo in SERIES_MENSUALES.items()}
    temas, noticia_mas_nueva = _noticias()
    return {
        "fecha_de_hoy": hoy.isoformat(),
        "series_diarias": diarias,
        "brechas_cambiarias_pct": {
            "blue_vs_oficial": _brecha(diarias["tc-blue"], diarias["tc-oficial"]),
            "mep_vs_oficial": _brecha(diarias["dolar-mep"], diarias["tc-oficial"]),
            "ccl_vs_oficial": _brecha(diarias["dolar-ccl"], diarias["tc-oficial"]),
        },
        "series_mensuales": mensuales,
        "noticias_cubiertas_por_varios_medios": temas,
        "noticia_mas_nueva_disponible": noticia_mas_nueva,
    }


def avisos_de_frescura(foto: dict, hoy: datetime.date) -> list[str]:
    avisos = []
    nueva = foto["noticia_mas_nueva_disponible"]
    if nueva and (hoy - datetime.date.fromisoformat(nueva[:10])).days > 2:
        avisos.append(f"Las noticias locales son del {nueva[:10]} — corré `git pull` antes.")
    for s in foto["series_diarias"].values():
        if "sin_dato" in s:
            avisos.append(f"{s['titulo']}: sin dato ({s['sin_dato']}).")
        elif (hoy - datetime.date.fromisoformat(s["ultimo"]["fecha"][:10])).days > 5:
            avisos.append(f"{s['titulo']}: último dato del {s['ultimo']['fecha'][:10]}.")
    return avisos


def generar_resumen(foto: dict) -> str:
    client = anthropic.Anthropic()
    resp = client.messages.create(
        model=MODELO,
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        output_config={"effort": "medium"},
        messages=[{
            "role": "user",
            "content": "Foto de datos del día (JSON):\n\n" + json.dumps(foto, ensure_ascii=False, indent=1),
        }],
        # Si un clasificador de seguridad rechaza el pedido, el servidor lo
        # reintenta con otro modelo en la misma llamada. El SDK instalado es
        # anterior a este parámetro, por eso va por extra_body/extra_headers.
        extra_headers={"anthropic-beta": "server-side-fallback-2026-07-01"},
        extra_body={"fallbacks": "default"},
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError("Claude rechazó generar el resumen (stop_reason=refusal).")
    texto = "".join(b.text for b in resp.content if b.type == "text").strip()
    if resp.stop_reason == "max_tokens":
        texto += "\n\n[cortado por max_tokens]"
    return texto


def main():
    args = set(sys.argv[1:])
    hoy = datetime.date.today()

    nota = None
    if "--sin-nota" not in args and "--solo-datos" not in args:
        print("Antes de ver el resumen: ¿cuál es para vos el hecho macro más relevante de hoy?")
        nota = input("(una línea, Enter para saltear) > ").strip() or None

    print("\nJuntando datos...")
    foto = armar_foto(hoy)
    for aviso in avisos_de_frescura(foto, hoy):
        print(f"  ⚠ {aviso}")

    if "--solo-datos" in args:
        print(json.dumps(foto, ensure_ascii=False, indent=1))
        return

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Error: falta ANTHROPIC_API_KEY en .env")
        sys.exit(1)

    print("Generando resumen con Claude...\n")
    try:
        resumen = generar_resumen(foto)
    except anthropic.APIStatusError as e:
        print(f"Error de la API ({e.status_code}): {e.message}")
        sys.exit(1)
    except anthropic.APIConnectionError:
        print("Error de conexión con la API de Claude.")
        sys.exit(1)

    print(resumen)

    # Mismo formato que los informes semanales (título, metadatos en negrita,
    # "---", cuerpo), así se puede pasar a PDF con informes/render_pdf.py.
    # Los datos usados van en un .json aparte para no ensuciar el PDF.
    SALIDA_DIR.mkdir(parents=True, exist_ok=True)
    ruta = SALIDA_DIR / f"{hoy.isoformat()}.md"
    partes = [f"# Resumen macro diario\n",
              f"**Fecha:** {hoy.strftime('%d/%m/%Y')}"]
    if nota:
        partes.append(f"**Mi lectura del día:** {nota}")
    partes.append("\n---\n")
    partes.append(resumen + "\n")
    ruta.write_text("\n".join(partes), encoding="utf-8")
    ruta.with_suffix(".datos.json").write_text(
        json.dumps(foto, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nGuardado en {ruta.relative_to(Path(__file__).parent)}")
    print(f"Para pasarlo a PDF: python informes/render_pdf.py {ruta.relative_to(Path(__file__).parent)}")


if __name__ == "__main__":
    main()
