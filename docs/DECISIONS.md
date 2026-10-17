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
**Estado:** Aceptada (OD-5 respondida el 2026-10-16: aprueban el **owner y coordinación académica**; se reflejará como dos revisiones requeridas en la protección de `main` para `curriculum/source/`)
**Contexto:** el handoff pide malla “editable desde fuente única” y a la vez Excel inmutable; el XLSX certificado es una exportación de Google Sheets.
**Decisión:** la edición ocurre aguas arriba. Cada XLSX exportado entra como nueva release (`malla-<AAAA-MM>.xlsx`) mediante PR con gate, compilación y reporte de diferencias por unidad. El owner aprueba. La app **no** edita currículo.
**Consecuencias:** historial completo de versiones; los guardados registran `release` y `unitId` y pueden avisar cambios.

## ADR-004 — IDs canónicos de nivel con tabla de alias
**Estado:** Propuesta
**Contexto:** la fuente usa `Kínder` (Malla) y `Jardín/Kínder` (Progresión); el handoff usa `Step 3 / Prejardín` y `Kínder / Jardín`. Antes hubo `step1` vs `step_1`.
**Decisión:** IDs `step-1`, `step-2`, `step-3`, `kinder`, `transicion`; alias en `curriculum/aliases/levels.json`; mapeo Progresión↔Malla explícito y probado. La UI muestra literales de la fuente (columna A + Equivalencia).
**Consecuencias:** un único formato de ID en todo el código, base de datos y URLs.

## ADR-005 — Stack: Next.js + Supabase + Vercel + GitHub
**Estado:** Reemplazada en la parte de hosting y datos por ADR-016 (OD-1: «opciones que no me cuesten»). Next.js, GitHub Actions y Claude API se mantienen.
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
**Estado:** Aceptada (OD-2 respondida el 2026-10-16: Claude API; la **cifra** del tope mensual sigue pendiente)
**Decisión:** Claude API desde el route handler `/api/happy`; salida JSON con `output_config.format` (esquema estricto) validada después por Zod y por el validador de política; streaming por bloques; caché de prompt; modelo por defecto `claude-sonnet-5-5` (configurable; `claude-haiku-5-5` como juez de la suite) y confirmado con la suite de F5; `model` y `prompt_version` registrados por respuesta. La clave vive en secretos de GitHub Actions y del hosting, nunca en el repositorio ni en el chat. Tope duro de gasto en la consola de Anthropic (owner) + tope blando en la app (`HAPPY_MONTHLY_BUDGET_USD`). Gemini (histórico) no se hereda. Detalles de implementación: ADR-017.

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
- **Revisión adversarial de F1 (2026-10-16)** — un agente independiente encontró que el validador Python verificaba textos pero no la **atribución** de cada celda (p. ej., Juego↔Arte intercambiados pasaban). Corregido: el validador deriva desde el Excel, con mapas propios duplicados a propósito (no lee `fields.ts` ni `levels.json`), la unidad esperada para cada celda y compara id, tipo, campo, nivel, código, celda, rango, estructuras, segmentos y propósitos. Las 23 mutaciones del revisor ahora se detectan (antes 2).
- **Entidades XML** decodificadas a mano en una pasada (`&#10;`, `&#x1F331;`; `&amp;#10;` queda literal). Escapes OOXML `_xHHHH_` se decodifican según ECMA-376; openpyxl 3.1.5 no lo hace en cadenas compartidas, así que si una release futura los trae, la doble lectura fallará (falla segura) y deberá revisarse a mano.
- **Propósitos compartidos** referencian unidades (`unitIds` + `segmentKey`), no celdas; para citar se usa siempre la unidad (ADR-007).
- **Marcadores estructurales** de segmentación (“Tema:”, “Alertas:”, “En esta experiencia se logra cuando”) viven en código como los encabezados: son patrones de forma, no contenido citable.
- `CODEOWNERS` cubre fuente, alias, validador y mapa de campos. **Recomendación al owner:** activar protección de `main` (PR obligatorio, CI verde y revisión de code owners).

## ADR-013 — Interfaz compartida y prototipo de un solo archivo (F2)
**Estado:** Aceptada (2026-10-16)
**Contexto:** F2 debe validar la experiencia con datos reales sin construir aún la plataforma de producción, y sin que ese trabajo se tire en F3.
**Decisión:**
- La interfaz vive en `src/ui/` (React 19, TypeScript estricto) y depende solo de **contratos**: `AuthService`, `HappyService` y almacenamiento (`src/ui/app/types.ts`). El prototipo (`prototype/`) los implementa en memoria; F4 (Supabase) y F5 (`/api/happy`) los reemplazan sin tocar pantallas.
- **Tokens en TypeScript** (`src/ui/theme.ts`) como fuente única: generan el CSS claro/oscuro y alimentan la prueba de contraste. Se usa CSS propio con variables en lugar de Tailwind (ajuste a ADR-005): el mismo CSS sirve en el prototipo y en Next.js.
- **Tipografías:** Atkinson Hyperlegible Next para el texto (legibilidad en móvil para textos curriculares largos) y Fredoka para títulos, en armonía con el reloj redondeado de Happy.
- **Periodos como cuartos de reloj:** el selector de periodo es un reloj de cuatro cuartos (I–IV en sentido horario) con la manecilla de Happy; cada periodo tiene un color de la paleta funcional que se repite en toda la app.
- **Lo institucional se ve distinto de lo generado:** bloques “Desde nuestra malla…” con borde sólido y procedencia; “Como idea complementaria…” con borde punteado y etiqueta “Generado”.
- **Empaquetado propio en un solo HTML** (`scripts/build-prototype.ts`) en lugar de `vite-plugin-singlefile`, que arrastraba 3 vulnerabilidades altas (`braces`).
- **Contrato de Happy adelantado:** `src/domain/happy/schema.ts` (Zod + validador posterior) y `privacy.ts` (detector preliminar) ya son los de F5; el simulador del prototipo los cumple y las pruebas lo verifican.
- **Reloj de Happy provisional:** re-ilustrado desde la especificación del handoff en un único componente (`src/ui/happy/HappyAvatar.tsx`), reemplazable cuando llegue el SVG institucional (OD-6).

## ADR-014 — Política de privacidad de entrada y validador de salida (refinan ADR-009 y ADR-007)
**Estado:** Aceptada (2026-10-16), tras la revisión adversarial independiente de F2.
**Decisión:**
- **Entrada:** se marca como sensible lo que **identifica** a una persona: nombre, contacto, documento o dirección. Los términos de salud o apoyo por sí solos (PIAR, DUA, discapacidad, “un niño con autismo”) **no** se bloquean: son vocabulario de la malla y de la inclusión. La política corre en la interfaz **antes** de guardar o enviar: solo se persiste la versión redactada y, si hay datos identificables, no se llama a Happy. En F5 se repite en el servidor.
- **Salida:** el validador normaliza Unicode (NFKC, invisibles, homoglifos, tildes) y rechaza: reclamos de autoridad institucional en cualquier texto generado (incluidos avisos y etiquetas de acción), diagnósticos y calificaciones, más de 3 caminos en toda la respuesta, copia literal de la malla (ventana de 8 palabras), citas no recuperadas, segmentos o experiencias inexistentes, textos sin límite y modos no habilitados.
- Corpus de prueba: 44 mensajes de privacidad y 30 casos de validador, tomados de la revisión.

## ADR-015 — Malla en producción con Next.js sobre la interfaz compartida (F3)
**Estado:** Aceptada (2026-10-16)
**Contexto:** F3 lleva la malla a una app de producción sin duplicar las pantallas del prototipo, sin enviar la malla completa al navegador y con URLs que se puedan compartir. No hay autenticación hasta F4 (OD-3) ni hosting decidido (OD-1).
**Decisión:**
- **Next.js 16 (App Router) en el mismo repositorio** (`app/`). Las pantallas siguen en `src/ui` y reciben **modelos de vista serializables** (`src/domain/curriculum/views.ts`): catálogo liviano (títulos, alcances, equivalencias y edades) y, por página, solo las unidades que muestra. El repositorio completo vive en el servidor (`app/_server/curriculum.ts`, `server-only`).
- **Navegación inyectada** (`Navigation`): pila en memoria en el prototipo, URLs reales en la app. `RouteLink` pinta `<a href>` con URLs y `<button>` en el prototipo. Las páginas con parámetros (`/malla`, `/buscar`, `/guardados`) los leen dentro de `<Suspense>` para no volver dinámica toda la app; el filtro propio actualiza la URL con `history.replaceState`, y la pantalla se vuelve a montar solo ante navegaciones (atrás/adelante, pestaña, enlace).
- **«Volver»** usa el historial solo si la entrada anterior es de la app (Navigation API); si no, lleva a la pantalla padre (`parentRoute`). Nunca saca a la docente de la app.
- **Todo estático:** 20 fichas (`/malla/s2-1`) y 5 niveles pre-generados, 404 propia, páginas de error en español. La búsqueda (textos + índice) es un archivo estático versionado por release (`/datos/busqueda-2026-06.json`) que solo se descarga en `/buscar`.
- **Lo que depende del navegador** (niveles, periodo, favoritos) se lee después de montar; mientras tanto la malla muestra un esqueleto, nunca otra experiencia. Los datos guardados se validan pieza por pieza (`src/ui/app/persisted.ts`).
- **Seguridad:** CSP sin orígenes externos, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, COOP y `noindex` (cabecera y meta). Se usa `'unsafe-inline'` en scripts porque los nonces obligarían a renderizar cada petición y perder las páginas estáticas; el riesgo se acota porque la app no inserta HTML de usuarios ni de terceros. Se revisa en F4 al llegar la autenticación.
- **Tipografías alojadas** (Fontsource vía `next/font/local`): sin peticiones a terceros, con precarga y fallback ajustado.
- **Verificación sobre la salida real:** `scripts/check-app-bundle.ts` comprueba que ningún JavaScript del cliente contiene texto curricular y que cada HTML/RSC pre-generado lleva solo las unidades de su página (más el catálogo).
- **Happy y Guardados en servidor** quedan para F5/F4: en la app, Happy muestra «Happy llega pronto» y los favoritos viven en el navegador.

## ADR-016 — Hosting y datos sin costo para el piloto (OD-1)
**Estado:** Aceptada (2026-10-16; el owner pidió «opciones que no me cuesten»)
**Contexto:** el piloto son 5–10 docentes; el tráfico es bajo y esporádico (entre actividades). Supabase gratuito **pausa** los proyectos tras 7 días sin uso (vacaciones escolares) y hay que reactivarlos a mano; eso es un riesgo operativo para una herramienta diaria.
**Decisión:**
- **App:** Vercel, plan Hobby (US$0). Renderizado en servidor, streaming y funciones con el límite de duración del plan, suficiente para Happy (respuestas ≤ 30 s). **Riesgo:** los términos del plan Hobby lo reservan a uso personal/no comercial; una institución educativa puede quedar fuera. Si Vercel lo objeta, la alternativa sin costo con uso comercial permitido es Cloudflare Workers (adaptador OpenNext); la app no depende de nada exclusivo de Vercel.
- **Datos (F4):** Neon, plan gratuito (Postgres gestionado, 0,5 GB, se suspende y **reanuda sola** en ~1 s). Migraciones SQL y RLS en el repo; en CI se prueban con PGlite (Postgres en WebAssembly, sin servicio).
- **Correo OTP (F4):** Resend, plan gratuito (3 000 correos/mes, 100/día) con dominio propio (SPF/DKIM). Código de 6 dígitos implementado en la app (sin Auth.js ni Supabase Auth).
- **IA:** Claude API con tope de gasto en la consola (ADR-008). Es el único costo variable del piloto.
- **Lo que el owner crea** (una vez): proyecto en Vercel conectado al repositorio; proyecto en Neon; cuenta en Resend; secretos en GitHub Actions y variables en Vercel.
**Consecuencias:** cero costo fijo; límites de plan que se vigilan en F7 (bandwidth, filas, correos); sin Supabase Auth, el modelo de sesiones es propio (cookies `HttpOnly`, rate limit, auditoría) y queda bajo pruebas en F4.

## ADR-017 — Implementación de Happy núcleo (F5)
**Estado:** Aceptada (2026-10-16), tras dos pasadas de revisión adversarial independiente.
**Decisiones:**
- **Pipeline en el dominio** (`src/domain/happy/pipeline.ts`): generador de eventos (`meta`, `block`, `reset`, `done`, `error`) independiente del transporte y del proveedor. El route handler lo serializa como NDJSON; la suite lo consume en memoria. Un solo código para producción, CI y evaluación.
- **Contrato de modelo** (`ModelClient`): adaptador de Claude API en `src/infra/anthropic-model.ts` y modelo falso determinista en `src/domain/happy/model.ts` (JSON válido por trozos, con marcadores `[[fake:…]]` para simular fallos). CI, e2e y la suite sin clave corren con el falso; su cobertura es **estructural**, no de conducta.
- **Salida estructurada** (`output_config.format`, esquema `MODEL_OUTPUT_SCHEMA` solo con palabras clave admitidas) y **lector incremental** (`BlockStreamReader`) que entrega cada bloque al cerrarse su llave: el primer bloque llega sin esperar al final.
- **Validación por bloque durante el stream** (`validateBlock`): esquema, cita dentro del conjunto recuperado, segmento, reglas de texto y copia literal. Bloque inválido → se descarta y se cuenta (`metrics.dropped`, solo motivos, sin texto); respuesta vacía o JSON ilegible sin bloques → un reintento con las correcciones; `refusal` → aviso fuera de alcance sin reintento; `max_tokens` con bloques válidos → se entregan marcados como truncados.
- **Reglas de texto** (`rules.ts`, sin Zod, compartidas por servidor, cliente y suite): diseñadas por **precisión**. Atribución = institución como sujeto de un verbo de mandato (o «según/conforme a/es requisito de»), con negaciones exentas; diagnóstico = persona o cópula + término clínico, con contexto descriptivo exento («una niña con autismo», «ya trae un diagnóstico de TEA») y negación por cláusula; calificación = formatos explícitos de nota, escala, ranking o reprobación. El vocabulario de inclusión no se bloquea (ADR-014). Copia literal sobre texto normalizado (invisibles, tildes, homoglifos).
- **Caché de prompt:** `system[0]` = reglas + 7 Observaciones (1 h, estable por release); `system[1]` = progresión y perfiles del nivel + experiencia activa (5 min, estable por hilo); coincidencias y turno en el mensaje. Mensaje de la docente delimitado con una valla aleatoria por petición; turnos previos en una línea cada uno.
- **Política de privacidad en el servidor** sobre texto normalizado, aplicada al mensaje **y** a la conversación previa que envía el cliente; el modelo nunca recibe nombres, contactos, documentos ni direcciones.
- **Cita por referencia de punta a punta:** el servidor resuelve y envía solo las unidades citadas (literal + procedencia). En el navegador se persisten con la respuesta; al leerlas se exige release vigente y **huella** (`unitFingerprint`: texto + encabezado + código + nivel + campo + celda + segmentos) contra la tabla que viaja únicamente con `/happy`. Lo que no verifica se muestra como error con «Reintentar», nunca a medias ni en silencio.
- **Acceso provisional (hasta F4):** código del piloto (`HAPPY_ACCESS_CODE`, ≥4 caracteres) en cabecera, comparado en tiempo constante; dispositivo firmado (`HAPPY_DEVICE_SECRET`, HMAC) emitido al presentar el código; límites por dispositivo (40/h, 150/día) **y** por IP (10×), globales por día y presupuesto mensual (`HAPPY_MONTHLY_BUDGET_USD`, 20 por defecto). Contadores por instancia: el tope duro es el de la consola de Anthropic. Precio desconocido → se estima al precio más alto (falla cerrado).
- **Cliente:** NDJSON con validación de forma sin Zod, tiempo máximo (45 s primer byte, 90 s total), botón «Cancelar» (el servidor honra la cancelación) y métricas visibles por respuesta (latencia al primer bloque y costo).
- **Modelo por defecto** `claude-sonnet-5-5`, `effort: low`, pensamiento adaptativo; configurable. La suite decide el modelo definitivo cuando corra con la clave (workflow manual `happy-eval`).
- **Suite de evaluación** (`evals/happy/scenarios.v1.json`, 85 escenarios): criterios duros sobre lo que ve la docente **y** sobre la salida cruda del modelo (en `adversarial` y `privacidad` cualquier bloque descartado es fallo duro; en el resto, de conducta); rúbrica por juez (`claude-haiku-5-5`, respuesta delimitada, media ≥85 % y mínimo 50 % por escenario); p75 del primer bloque ≤4 s; costo medio. El reporte versionado no contiene literales de la malla.
- **Revisión adversarial (2 pasadas):** hallazgos altos corregidos — la suite medía la respuesta ya filtrada (A1) y un literal alterado en `localStorage` podía pintarse como malla (A2); medios — history sin política de privacidad, límites evadibles, validador débil y a la vez con falsos positivos sobre vocabulario de inclusión, copia con invisibles/homoglifos, precio desconocido = costo 0, sin timeout ni cancelación, huella solo del texto, límite por IP compartido por un NAT, pérdida silenciosa de hilos; bajos — motivos con texto, foco y `aria-live`, URL inválida, longitud del código, combinaciones de thinking, secreto en `npm ci`, juez manipulable. Pendientes documentados: fijar las actions por SHA; contadores de límite en base de datos (F4).

## ADR-018 — Una sola implementación de Happy núcleo (reemplaza el PR #4)
**Estado:** Aceptada (2026-10-16, decisión del owner: «Reemplazar la de main por la mía»).
**Contexto:** dos sesiones construyeron F5 en paralelo. El PR #4 (fusionado) puso el núcleo en `src/server/happy/` con un ADR-016 propio; la otra versión (rama `f5-happy-nucleo-b`) lo puso en `src/domain/happy/` con ADR-016 (hosting) y ADR-017.
**Decisión:** queda la versión de `src/domain/happy/` (ADR-017). Se retiran `src/server/happy/*`, `src/domain/text/normalize.ts`, `scripts/happy-eval.ts`, `evals/happy/escenarios.v1.json` y sus pruebas. Se conservan del PR #4 las mejoras del detector de privacidad (teléfonos con separadores, `@usuario`, «carrera X con calle Y», NFKC) y la comprobación de que el prompt, el SDK y el nombre de la clave no llegan al cliente. El ADR-016 del PR #4 («Núcleo de Happy en el servidor») queda **reemplazado** por ADR-017; el número ADR-016 corresponde a hosting sin costo. Todo sigue en el historial de git.
