# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Generar JSONs de datos desde archivos Excel:**
```bash
python subir_datos.py
```
Genera archivos `data/{indicador}.json` (ICC, EI, REM) en el directorio `data/`. No requiere credenciales.

**Traer datos de mercado (MSCI Merval, oro, soja, WTI, Brent) desde Yahoo Finance:**
```bash
python fetch_mercados.py
```
Genera `data/msci-merval.json`, `oro.json`, `soja.json`, `wti.json` y `brent.json`. Se usa porque Yahoo Finance bloquea CORS desde el browser. **Fusiona** con lo que ya hay en el JSON (nunca lo pisa: en nov-2026 Yahoo devolvió 1 solo punto de `^MERV` y se perdió el historial) y sale con código 1 si una serie no trae datos de la última semana. Corre de lunes a viernes a las 18 ART vía `.github/workflows/update-mercados.yml`; si una serie falla, igual commitea las demás.

**Traer ICC y EI (UTDT) automáticamente desde la web:**
```bash
python fetch_utdt.py
```
Scrapea la página de "Serie Histórica" de UTDT (ICC y EI), extrae el link de descarga `download.php?fname=...xls` (cambia cuando suben datos nuevos) y genera `data/icc.json` y `data/ei.json`. Requiere User-Agent de navegador (UTDT tiene anti-bot). Corre solo cada mes vía `.github/workflows/update-utdt.yml` (día 22).

**Traer los REM (BCRA) automáticamente desde la web:**
```bash
python fetch_rem.py
```
Scrapea la página del REM del BCRA (`/relevamiento-expectativas-mercado-rem/`), encuentra el Excel `relevamiento-expectativas-mercado-tablas-AAAA-MM.xlsx` (formato del sitio nuevo desde oct-2026; también reconoce el viejo `tablas-...-MMM-AAAA.xlsx`), lo baja y genera las 9 `data/rem-*.json`. Replica el parseo de `subir_datos.py` (hoja 0, skiprows=6, col fecha=1, corte en la primera fila sin fecha). Usa `certifi` para el SSL del BCRA. Corre solo cada mes vía `.github/workflows/update-rem.yml` (día 10). `subir_datos.py` queda solo como fallback manual.

**Instalar dependencias Python:**
```bash
pip install -r requirements.txt
```

**Generar las páginas SEO por indicador:**
```bash
node generar-paginas.js
```
Lee el array `SERIES` de `app.js` y genera una página estática por indicador en `indicador/{slug}.html` (con `<title>`, `description`, `canonical` y Open Graph propios), y regenera `sitemap.xml`. Correr cada vez que se agreguen o cambien indicadores (slug/título/descripción).

**El frontend no tiene build step de bundling** — es HTML/CSS/JS estático. Abrí `index.html` directamente o servilo con cualquier servidor estático. Las URLs limpias (`/indicador/<slug>`, `/datos`) funcionan en Vercel vía `cleanUrls`.

**Correr los tests:**
```bash
node --test
```
Cubren las funciones puras de `lib.js` (formatFecha, agregarDatos, transformarEmae, las del Laboratorio, completarSerieMensual, variacionInteranual). Usan `node:test`, sin dependencias. Corren en CI con cada push (`.github/workflows/test.yml`).

**Auditar que todos los indicadores estén al día:**
```bash
node auditar-frescura.js
```
Recorre `SERIES`, consulta la fuente real de cada indicador y falla (código 1) si el último dato es más viejo de lo esperable para su frecuencia (diaria 10 días, mensual 125, trimestral 280, REM 70 desde la edición) o si dos indicadores leen la misma variable (así se detectó la TPM apuntando a la inflación interanual). Las series con `discontinuada: true` se saltean. Corre los martes vía `.github/workflows/auditar-frescura.yml`.

**Avisos de fallas:** todos los workflows tienen un último paso `if: failure()` que corre `.github/scripts/avisar-telegram.sh salida.txt` y manda al bot de Telegram (el mismo de Agente MacroAR) el nombre del workflow, las últimas líneas de la salida y el link al run. Usa los secrets del repo `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`. El paso principal de cada workflow corre con `shell: bash` (pipefail) y `| tee salida.txt`; respetar ese patrón al agregar workflows nuevos.

## Arquitectura

### Frontend (HTML + JS estático)
- **`app.js`** es el núcleo de toda la lógica del frontend — se carga en todas las páginas y controla el fetch de datos, el renderizado de gráficos y la UI. No hay auth ni backend: el sitio es 100% estático.
- **`SERIES`** (array en `app.js`) es la fuente de verdad de todos los indicadores: define fuente, IDs de API, colores, unidades, y si son `premium`.
- La página activa se detecta con clases CSS en `<body>` (`page-datos`, `page-detalle`) — `app.js` usa estas flags para alterar su comportamiento (controles extra, historial ampliado, etc.).
- **Páginas por indicador (SEO):** cada indicador tiene una página estática pre-generada en `indicador/<slug>.html` (URL limpia `/indicador/<slug>`), con título/descripción/canonical/OG propios. El `<body>` trae `data-serie-id` horneado; `app.js` lo lee y renderiza el gráfico ampliado. Se generan con `node generar-paginas.js`. El viejo `detalle.html?id=` sigue funcionando por compatibilidad y canonicaliza hacia la URL limpia.
- Cada serie de `SERIES` tiene `slug` (URL) y `descripcion` (meta SEO) — son la fuente de verdad que consume el generador.
- Flags de `SERIES` menos obvios:
  - `variacion: true`: la fuente da un nivel y se muestra la variación % período a período. Además marca la serie como tasa (el editor compone k períodos). No usar en series que ya vienen en %.
  - `interanual: true`: variación % contra el mismo mes del año anterior (`variacionInteranual`); pide 12 meses extra a la fuente. Sin `variacion`.
  - `completarBcra: <id>`: completa los meses que datos.gob.ar todavía no publicó con esa variable del BCRA (ya en %, fechas a fin de mes normalizadas a día 1). Lo usa la inflación mensual (var. 27).
  - `discontinuada: true`: la fuente dejó de publicarse; la UI muestra "Serie discontinuada" junto a la fecha y la auditoría no la controla (TPM, Merval histórico).
- **Laboratorio (`/laboratorio`):** página que correlaciona dos indicadores. Reusa `obtenerDatosSerie` (fetch sin render, extraído de `cargarSerie`) y las funciones puras de `lib.js` (`agregarDatos`, `alinearSeries`, `normalizar`, `pearson`, `crossCorrelation`). Pipeline: fetch → `agregarDatos(freq)` → `alinearSeries` (intersección por fecha) → `normalizar` (índice/niveles/variación) → correlación + lead/lag. `laboratorio.js` es el controller; `app.js` aporta `SERIES`/`obtenerDatosSerie` y hace no-op en `loadAll()` para `page-laboratorio`. Series REM excluidas (son proyecciones). Lead/lag solo se afirma si la correlación es ≥ moderada y no cae en el borde del rango. Incluye además **regresión MCO** client-side (`regresionLineal` en `lib.js`: coeficientes, EE, t, p-values bilaterales vía beta incompleta regularizada —`pValorT`/`pValorF`—, ANOVA, R²/R² aj., F, Durbin-Watson) con toggle de dirección B↔A (param `d` del hash), scatter + recta ajustada, y warning anti-regresión-espuria cuando el modo no es variación %.

### Fuentes de datos (todas consumidas en el browser)
| Fuente | Qué provee | Cómo |
|---|---|---|
| **Bluelytics** | Dólar oficial y blue | REST público |
| **BCRA v4.0** | Reservas, base monetaria, BADLAR, TC mayorista, plazo fijo, UVA, inflación interanual (28) y mensual (27), TPM (160, discontinuada jul-2025) | `/estadisticas/v4.0/monetarias/{id}` |
| **INDEC / datos.gob.ar** | IPC, EMAE, PBI (`4.4_OGP_2004_T_17`), IPIM (`450.1_...`), IPI, ISAC, salarios, recaudación, empleo, desocupación | `/series/api/series/?ids=` |
| **JSON local** | ICC Di Tella, EI Di Tella, indicadores REM, MSCI Merval, Merval histórico, oro, soja, WTI, Brent | `data/{id}.json` generados por `fetch_utdt.py`, `fetch_rem.py` y `fetch_mercados.py` |
| **ArgentinaDatos** | Riesgo País (EMBI+), dólar MEP y CCL | REST público con CORS, `api.argentinadatos.com` |

**datos.gob.ar se atrasa:** la API de series puede quedar semanas detrás de su propio CSV (que no tiene CORS, no se puede leer desde el browser). Además hay series que mueren sin aviso: la 166.2 (PBI) se cortó en 2025-T4 y la 448.1 (IPIM) en 2019 con un último valor corrupto. Antes de usar un ID nuevo, chequear su última fecha con `?ids=...&limit=1&sort=desc`; si se congela, buscar el reemplazo con `/series/api/search/?q=...`.

**Nota CORS:** Yahoo Finance bloquea CORS desde el browser. Por eso el Merval y los commodities se traen del lado servidor con `fetch_mercados.py` y se consumen con `fuente: 'local'` + `ventana: true`. El oro es el futuro COMEX en USD/oz directo.

**Merval:** desde nov-2026 lo calcula MSCI. `/indicador/merval` (id `merval-ars`) muestra el MSCI Merval en pesos (Yahoo `^768692-ARS-STRD`, `data/msci-merval.json`). Yahoo solo da el último cierre de ese índice, así que el historial se acumula una corrida por día hábil. El S&P Merval (`^MERV`, congelado el 16/10/2026) queda en `data/merval.json` como `merval-historico`, discontinuado. Tienen escalas distintas y ningún día en común: no empalmarlos.

### Datos locales (ICC, EI, REM, mercados)
- Se actualizan solos con GitHub Actions (`fetch_utdt.py`, `fetch_rem.py`, `fetch_mercados.py`), que commitean a `main` y por eso disparan el deploy. `subir_datos.py` queda como fallback manual desde los Excel.
- Cada JSON es un array de `{ fecha: "YYYY-MM-DD", valor: number }` ordenado por fecha. Los REM son `{ publicacion, datos: [...] }`: `publicacion` es la edición del relevamiento.
- `app.js` los carga con `fetch('data/{id}.json')` (`fuente: 'local'`) — sin dependencias externas ni base de datos.
- Por defecto se carga el historial completo; las series de mercado se acotan a su ventana con `ventana: true`.
- Como los robots commitean seguido en `data/`, hacer `git pull --ff-only` antes de trabajar.

## Agregar un nuevo indicador

1. Agregarlo al array `SERIES` en `app.js` con su `fuente` correspondiente.
2. Si la fuente es `local`, generar el `data/{id}.json` con el script `fetch_*.py` que corresponda (y sumarlo a su workflow si se actualiza solo).
3. Si la fuente es `bcra`, usar el ID numérico de variable de la API v4.0 del BCRA. Verificar la descripción del ID en `/estadisticas/v4.0/monetarias` (la TPM estuvo meses apuntando a la inflación interanual).
4. Correr `node generar-paginas.js` (página SEO + sitemap) y `node auditar-frescura.js` (que la fuente tenga datos al día y no repita la variable de otro indicador).

## gstack

Para toda navegación web usar el skill `/browse` de gstack. Nunca usar las herramientas `mcp__claude-in-chrome__*`.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
