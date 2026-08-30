# Informes MacroAr

Plantilla de estructura para informes de consultoría en PDF, independiente del sitio web.

## Uso (con estilo de marca MacroAr — recomendado)

`render_pdf.py` convierte el Markdown a PDF con la paleta y tipografías del sitio
(navy/celeste/sol, Poppins/Inter, portada oscura tipo hero), tomadas de
`_template-consultora.html`. Requiere el paquete `markdown` (`pip install -r informes/requirements.txt`)
y Edge o Chrome instalados (los usa en modo headless para imprimir a PDF).

1. Copiá `_plantilla.md` con el nombre del informe, ej. `2026-07-cliente-x.md`.
2. Completá los `[corchetes]` con el contenido real (título en el primer `#`, metadatos en negrita tipo `**Cliente:** ...`).
3. Generá el PDF:

```bash
python informes/render_pdf.py informes/2026-07-cliente-x.md
# o con salida explícita:
python informes/render_pdf.py informes/2026-07-cliente-x.md informes/2026-07-cliente-x.pdf
```

El estilo visual vive en `estilo-macroar.css` — tocalo ahí si cambia la identidad del sitio (colores, portada, tablas).

## Alternativa: PDF genérico sin marca (make-pdf)

Si preferís el layout genérico tipo publicación (Faber & Faber: Helvetica, TOC automático) en vez del estilo MacroAr:

```bash
P="$HOME/.claude/skills/gstack/make-pdf/dist/pdf"
"$P" generate --cover --toc --author "MacroAr" --title "[Título del informe]" \
  "C:\Users\mateo\Desktop\MacroAr\informes\2026-07-cliente-x.md" \
  "C:\Users\mateo\Desktop\MacroAr\informes\2026-07-cliente-x.pdf"
```

**Importante:** el path de entrada/salida debe ir con backslashes de Windows (`C:\...`), no con forward slashes — el sandbox del binario rechaza `c:/Users/...` con "Path must be within...".

- `--cover` agrega portada con título, autor y fecha.
- `--toc` agrega índice clickeable (usa los encabezados `##`).
- Para una versión borrador antes de mandarla al cliente: agregá `--watermark DRAFT`.

## Generación automática con Claude (`generar_informe.py`)

Junta datos (`agente_macro.py`) y noticias (`fetch_noticias.py`) y redacta el
informe con Claude. Requiere `ANTHROPIC_API_KEY` (con crédito cargado) en
`.env`.

**Modo por defecto — informe semanal (`_plantilla-semanal.md`):**

```bash
python informes/generar_informe.py
python informes/generar_informe.py --cliente "Cliente X" --foco "dólar,inflación"
```

Trae las noticias de los últimos 7 días (Ámbito, Infobae), Claude elige las
3-6 más importantes para la macro argentina, y por cada una arma una sección
con: qué pasó → qué dice el dato relacionado → contraste entre ambos. Es el
esquema pensado para correr todas las semanas.

**Modo libre — informe por tema (`--periodo`, usa `_plantilla.md`):**

```bash
python informes/generar_informe.py --periodo "julio 2026" --cliente "Cliente X"
```

El informe "clásico" por tema (cambiario, precios, actividad, etc.) para un
período arbitrario, en vez del semanal por noticia.

Cada corrida imprime cuántos tokens consumió y el costo estimado (precios de
`claude-opus-4-8`), y lo guarda en `uso_tokens.jsonl` (uno por línea) para
llevar el gasto acumulado — al final de cada corrida se muestra ese acumulado
histórico además del costo de esa corrida puntual.

## Editor visual (`editor.html`) — retocar un informe ya generado

Herramienta personal, client-side, sin backend ni guardado remoto: abrís el
`.md` que generó `generar_informe.py`, lo editás con el mismo estilo visual
del PDF final (`estilo-macroar.css`), y exportás.

1. Abrí `informes/editor.html` directamente en el navegador (doble clic, o
   `start informes/editor.html`).
2. Botón **"Abrir .md"** → elegí el informe generado (ej. `2026-07-cliente-x.md`).
3. Editá título, metadatos (cliente/fecha/período) y cuerpo directamente sobre
   la vista previa — es la misma página que después se imprime, así que "lo
   que ves es lo que sale".
4. **"🖨 PDF"** abre el diálogo de impresión del navegador (Ctrl+P) con destino
   "Guardar como PDF" — respeta el tamaño A4 y los saltos de página de
   `estilo-macroar.css`, igual que `render_pdf.py`.
5. **"⬇ .md"** descarga el Markdown con los cambios, por si querés seguir
   editando después o volver a correr `render_pdf.py` sobre esa versión.

No persiste nada entre sesiones (todo vive en la pestaña abierta) — descargá
el `.md` o el PDF antes de cerrarla si no terminaste.

## Estructura de la plantilla

- **Resumen ejecutivo** — síntesis de una página, se escribe al final.
- **Contexto** — por qué se hizo el informe y su alcance.
- **Diagnóstico** — cuerpo del análisis, subdividido por tema, con tablas de datos.
- **Hallazgos** — lista concreta y priorizada.
- **Conclusiones y recomendaciones** — acciones concretas + próximos pasos.
- **Anexos** — metodología, fuentes de datos, notas y limitaciones.

Esta carpeta no forma parte del build del sitio (`app.js`, `generar-paginas.js`, etc.) — es una herramienta aparte para generar documentos.
