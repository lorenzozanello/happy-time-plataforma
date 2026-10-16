# DECISIONS — Happy Time (ADRs)

Formato: contexto → decisión → consecuencias. Estado: **Propuesta** (vigente al aprobar el Baseline v1) · **Aceptada** · **Reemplazada** · **Pendiente owner**.

---

## ADR-001 — El Excel institucional es la única autoridad curricular
**Estado:** Aceptada (definida por el handoff v1.1, verificada en Gate 0 el 2026-10-16)
**Contexto:** versiones anteriores mantuvieron textos curriculares en código y una Google Sheet espejo, con divergencias.
**Decisión:** `Malla HT Versión Final Junio 2026 (2).xlsx`, SHA-256 `4d58fe13b8509a09688c315d5666c5821263016abb5b49538044de5f21803cbe`, es la raíz de confianza. Solo las hojas `Malla ajustada!A1:AG21`, `Observaciones!A1:A8` y `Progresión por dimensión!A1:G6` son autoridad. Todo lo demás es derivado.
**Consecuencias:** el archivo se guarda read-only en `curriculum/source/` con hash fijado en `SOURCE.lock.json`; CI falla si cambia sin una nueva release (ADR-003).

## ADR-002 — La malla se compila en build, no se consulta en runtime
**Estado:** Propuesta
**Contexto:** la malla pesa ~117 000 caracteres en sus tres hojas y cambia pocas veces al año. Consultar Google Sheets en runtime añade latencia, cuotas, credenciales y un punto de falla.
**Decisión:** un compilador determinista (TypeScript) produce `curriculum.<release>.json` e índice de búsqueda, versionados en el repo y empaquetados en el build. Un validador independiente (Python/openpyxl) hace una segunda lectura y debe coincidir celda por celda.
**Consecuencias:** cero credenciales de Google en v1; páginas de malla estáticas; un cambio curricular requiere un PR y un despliegue (deseable: deja rastro y revisión).

## ADR-003 — Releases curriculares inmutables con aprobación del owner
**Estado:** Propuesta · confirmar responsables en OD-5
**Contexto:** el handoff pide malla “editable desde fuente única” y a la vez Excel inmutable; el XLSX certificado es una exportación de Google Sheets.
**Decisión:** la edición ocurre aguas arriba. Cada XLSX exportado entra como nueva release (`malla-<AAAA-MM>.xlsx`) mediante PR con gate, compilación y reporte de diferencias por unidad. El owner aprueba. La app **no** edita currículo.
**Consecuencias:** historial completo de versiones; los guardados registran `release` y `unitId` y pueden avisar cambios.

## ADR-004 — IDs canónicos de nivel con tabla de alias
**Estado:** Propuesta
**Contexto:** la fuente usa `Kínder` (Malla) y `Jardín/Kínder` (Progresión); el handoff usa `Step 3 / Prejardín` y `Kínder / Jardín`. Antes hubo `step1` vs `step_1`.
**Decisión:** IDs `step-1`, `step-2`, `step-3`, `kinder`, `transicion`; alias en `curriculum/aliases/levels.json`; mapeo Progresión↔Malla explícito y probado. La UI muestra literales de la fuente (columna A + Equivalencia).
**Consecuencias:** un único formato de ID en todo el código, base de datos y URLs.

## ADR-005 — Stack: Next.js + Supabase + Vercel + GitHub
**Estado:** Propuesta · confirmar en OD-1
**Decisión:** Next.js (App Router, TypeScript strict, Tailwind, Zod) desplegado en Vercel; Supabase (Postgres + RLS + Auth OTP por correo con invitación, SMTP propio); GitHub Actions para CI.
**Alternativas:** Vite SPA + funciones (más piezas); Google Sheets + Apps Script (histórico; sin transacciones ni RLS); Service Account (histórico; innecesaria con ADR-002).
**Consecuencias:** las decisiones históricas Apps Script / Service Account quedan explícitamente **no heredadas**. Respuesta a las 6 preguntas del handoff §10: (1) currículo: repo, compilado; (2) usuarios y sesiones: Supabase Auth; (3) conversaciones, favoritos, planeaciones: Supabase Postgres; (4) autenticación: código OTP al correo, solo invitación; (5) acceso a Drive/Sheets: ninguno en runtime; solo el owner exporta releases; (6) secretos: Claude API key y service role en Vercel, SMTP en Supabase.

## ADR-006 — Recuperación determinista, sin base vectorial en v1
**Estado:** Propuesta
**Contexto:** 572 unidades trazables, ~30–35 mil tokens en total; una experiencia ≈ 1,5 mil tokens; un nivel ≈ 6–7 mil.
**Decisión:** filtros por contexto curricular + búsqueda léxica con normalización española; Observaciones y progresión del nivel siempre presentes. Sin embeddings.
**Consecuencias:** resultados reproducibles y auditables; se reconsidera solo si la suite de evaluación muestra fallos de recuperación que la búsqueda léxica no resuelve.

## ADR-007 — Happy cita por referencia
**Estado:** Propuesta
**Contexto:** el riesgo principal de fidelidad es que el modelo parafrasee la malla y la presente como institucional.
**Decisión:** el modelo devuelve `unitId` (+ comentario generado). La UI renderiza el texto literal desde el JSON compilado con la etiqueta “Desde nuestra malla…”. Todo texto redactado por el modelo se etiqueta “Como idea complementaria…”. Un validador rechaza IDs inexistentes o no recuperados y bloques generados que reclamen autoridad.
**Consecuencias:** la trazabilidad es estructural, no depende del comportamiento del modelo.

## ADR-008 — Happy usa Claude API server-side con salida estructurada
**Estado:** Pendiente owner (OD-2)
**Decisión propuesta:** Claude API desde el route handler `/api/happy`; salida JSON validada por Zod; streaming por bloques; caché de prompt; modelo concreto fijado tras evaluación con la suite de F5; `model` y `prompt_version` registrados por mensaje. Gemini (histórico) no se hereda.

## ADR-009 — Sin datos identificables de menores en v1
**Estado:** Pendiente owner (OD-4)
**Decisión propuesta:** Happy no almacena registros por niña o niño; la Policy Layer detecta nombres junto a términos clínicos o datos de contacto, pide reformular y persiste solo la versión redactada. Habilitar registros individuales requiere revisión legal y un ADR nuevo.

## ADR-010 — Sin memoria de largo plazo en v1
**Estado:** Propuesta
**Decisión:** memoria por hilo (turnos recientes + resumen) y `work_context`; nada implícito entre hilos. `HAPPY_MEMORY` histórico no se reproduce.

## ADR-011 — Segmentación derivada solo con invariante de reconstrucción
**Estado:** Propuesta
**Decisión:** se segmentan P–S (Tema/Competencia/Avance/Evidencia), K (3 propósitos + “En esta experiencia se logra cuando…”) y AD (documentación / Alertas), verificados 20/20. La concatenación de segmentos con sus separadores debe reproducir el literal exacto; si una release rompe el patrón, la unidad se muestra completa y el compilador avisa. Las listas con `;` no se segmentan (irregulares).

## ADR-012 — Implementación del compilador curricular (F1)
**Estado:** Aceptada (2026-10-16)
**Decisiones:**
- **Lector XLSX propio** (`fflate` + `fast-xml-parser`, sin recorte de espacios, sin conversión de tipos, sin normalización Unicode) en lugar de una librería de hojas de cálculo: control total de cómo se decodifica cada texto. El validador independiente usa otro parser (`openpyxl`) y otro lenguaje; ambos deben coincidir en las 572 unidades.
- **IDs de unidad:** `S1.1#juego` (campo de experiencia), `S1.1#titulo`, `L:step-1#perfil_entrada` (nivel), `OBS-1…7`, `PROG:kinder#estetica`. Estables entre releases mientras no cambien código ni encabezado.
- **Segmentos como rangos** (`start/end/valueStart/valueEnd`) sobre el literal, nunca copias del texto.
- **Artefactos versionados** en `curriculum/build/` y verificados en CI con `curriculum:check` (determinismo byte a byte). Sin marcas de tiempo ni SHA de git dentro del JSON para mantener el determinismo.
- **Herramientas fijadas:** Node 22, TypeScript 6.0.3 (typescript-eslint 8.71 aún no soporta TS 7), Vitest 5, Zod 4, ESLint 10, versiones exactas en `package.json`.
- **Repositorio:** `lorenzozanello/happy-time-plataforma` (privado), creado por el owner (OD-7 resuelta). Flujo: rama por fase → PR → CI verde → merge.
