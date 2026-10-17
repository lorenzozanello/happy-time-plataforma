# EXECUTION_STATUS — Happy Time

**Última actualización:** 2026-10-16 (sesión 2)
**Fase actual:** F5 — Happy núcleo (lista en el PR #5, que reemplaza la implementación del PR #4 (ADR-018); falta la corrida con el modelo real, que requiere el secreto) · F3-09 y F2-09 siguen pendientes del owner
**Release curricular:** 2026-06 · SHA-256 `4d58fe13b8509a09688c315d5666c5821263016abb5b49538044de5f21803cbe` · Gate 0 de cada archivo recibido en `docs/GATE0_LOG.md`

| Fase | Estado | Evidencia / bloqueo |
|---|---|---|
| F0 Baseline | ✅ Aprobado por el owner (2026-10-16, “Procede”) | `docs/ARCHITECTURE_BASELINE_v1.md` |
| F1 Compilador curricular | ✅ Fusionado (PR #1) · ✅ OD-5 respondida (owner + coordinación aprueban releases) | PR #1, CI verde |
| F2 Diseño y prototipo | ✅ Fusionado (PR #2) · ⏳ revisión humana (F2-09) | Reloj provisional hasta OD-6 |
| F3 Malla en producción | ✅ F3-01…F3-08 fusionados (PR #3) · ⏳ F3-09 despliegue (owner conecta Vercel) | `npm run app:build`, `app:check-bundle`, `test:e2e:app` |
| F4 Acceso y Guardados | ⏸ desbloqueada por OD-1 y OD-3; requiere que el owner cree Neon y Resend (gratis) | ADR-016 |
| F5 Happy núcleo | ✅ F5-01…F5-12 en el PR #5 · ⏳ corrida con modelo real (secreto `ANTHROPIC_API_KEY`) | `npm run happy:eval`, `test:e2e:app`, ADR-017 |
| F6 Happy extendida | ⏸ | OD-4 |
| F7 Endurecimiento y piloto | ⏸ | OD-8 |

## Sesión 2 (2026-10-16) — punto de partida verificado

- Clon limpio de `main` (`20148de`, PR #3 fusionado): `npm run verify` ✅ (typecheck, lint, 216 pruebas,
  `curriculum:check`), `curriculum:gate` 22/22 ✅, validador Python 572 unidades / 592 celdas, 0 errores ✅.
- Gate 0 del Excel recibido en esta sesión (`Malla_HT_Versión_Final_Junio_2026_3.xlsx`): huella distinta,
  **contenido idéntico** celda a celda (638/638). Es una re-exportación; la release 2026-06 sigue vigente.
  Detalle en `docs/GATE0_LOG.md`.
- Respuestas del owner (registradas en `DECISIONS.md`): **OD-1** hosting sin costo; **OD-2** Claude API
  (tope mensual por definir en cifra; mientras tanto US$20 configurable); **OD-3** 3 roles, el owner es
  admin, acceso por invitación; **OD-5** el owner **y** coordinación académica aprueban releases de la malla.
- Orden de fases ajustado: F5 (Happy) antes que F4 (acceso) porque no depende de cuentas externas y es el
  corazón del producto; `/api/happy` queda protegida por un código de acceso del piloto hasta F4 (ADR-017).

## F1 — Criterios de prueba (definidos antes de implementar)

**Objetivo:** que sea imposible que la plataforma muestre como institucional un texto distinto al del Excel certificado.

| ID | Criterio | Cómo se verifica |
|---|---|---|
| F1-01 | El Excel en `curriculum/source/` es byte a byte el certificado | SHA-256 y tamaño = `SOURCE.lock.json`; CI falla si no |
| F1-02 | Gate estructural completo | 3 hojas exactas y en orden; rangos de contenido; filas 22+ vacías; 33 encabezados literales; encabezados de Observaciones y Progresión; 5 niveles; 20 códigos en orden; 588/555 celdas; 7 observaciones; 30 progresiones; 0 vacíos en H–AG; 35 rangos combinados A–G exactos; solo texto (sin fórmulas ni números) |
| F1-03 | Campos enlazados por encabezado literal, no por letra | Prueba que reordena/renombra un encabezado en memoria y espera fallo |
| F1-04 | 572 unidades con procedencia | 480 experiencia + 20 títulos + 35 nivel + 7 observaciones + 30 progresión; cada una con hoja, celda (y rango si combinada), encabezado, `authority: official_curriculum`, release |
| F1-05 | Fidelidad literal por doble lectura | Validador Python/openpyxl independiente compara cada `text` con su celda; también confirma que toda celda no vacía de autoridad está cubierta exactamente una vez |
| F1-06 | IDs de nivel canónicos y alias explícitos | Cada literal de nivel (Malla col A, Progresión col A) mapea a exactamente un ID; prefijo de código coherente con el nivel de su fila |
| F1-07 | Segmentación derivada segura | P–S, K y AD segmentados en 20/20; segmentos contiguos que cubren el texto completo; prefijos solo de etiqueta/numeración |
| F1-08 | Compilación determinista | Dos compilaciones → mismos bytes; el JSON versionado = recompilación (CI) |
| F1-09 | Sin currículo hardcodeado | Ninguna frase (≥6 palabras) de la malla aparece en `src/` o `scripts/` |
| F1-10 | Índice de búsqueda | Construido sobre las 572 unidades; normaliza tildes y tipografía; “rimas” y “ritmo” devuelven resultados; determinista |
| F1-11 | Reporte de diferencias entre releases | `curriculum:diff` detecta unidades agregadas, eliminadas y modificadas (probado con release sintética) |
| F1-12 | Calidad | `typecheck`, `lint` y `test` en verde; CI en GitHub Actions en verde |

### Resultado F1 (2026-10-16)

| ID | Resultado | Evidencia |
|---|---|---|
| F1-01 | ✅ | Gate G01–G02; huella fijada en `SOURCE.lock.json` |
| F1-02 | ✅ | Gate 22/22 PASS |
| F1-03 | ✅ | `gate.test.ts`: renombrar encabezado, forzar gate, intercambiar columnas |
| F1-04 | ✅ | 572 unidades (480 + 20 + 35 + 7 + 30) con procedencia completa |
| F1-05 | ✅ | Validador Python: textos **y atribución**, 0 errores; 23/23 mutaciones detectadas |
| F1-06 | ✅ | `attribution.test.ts`: 15 celdas fijadas a mano + alias mal configurado detectado de punta a punta |
| F1-07 | ✅ | 120 unidades segmentadas (6 campos × 20), reconstrucción exacta, claves validadas en Python |
| F1-08 | ✅ | Dos compilaciones idénticas + `curriculum:check` en CI |
| F1-09 | ✅ | Ventana deslizante de 8 palabras (9 620 secuencias) + control positivo |
| F1-10 | ✅ | 572 documentos; tildes y tipografía normalizadas; determinista |
| F1-11 | ✅ | Diff detecta texto, celda, nivel, código, segmentos y estructuras |
| F1-12 | ✅ | typecheck, lint, formato, 69 pruebas; CI en GitHub Actions |

Revisión adversarial independiente: 1 defecto alto (atribución no verificada), 1 medio (entidades numéricas), 3 bajos. Todos corregidos en el mismo PR (ver ADR-012).

## F2 — Criterios de prueba (definidos antes de implementar)

**Objetivo:** validar la experiencia con datos reales antes de la implementación de producción, con un sistema de diseño y componentes que se reutilizan en F3.

**Supuestos:** OD-6 sin respuesta → el reloj de Happy se re-ilustra desde la especificación del handoff (§8) y queda marcado **provisional**, aislado en un único componente reemplazable. OD-9 sin respuesta → se mantiene “Pensemos juntas.”. Happy es **simulada** (sin IA): respuestas deterministas construidas con unidades reales.

| ID | Criterio | Cómo se verifica |
|---|---|---|
| F2-01 | Tokens de diseño en claro y oscuro con contraste AA | Prueba que calcula el contraste de cada par texto/fondo declarado (≥4,5:1 texto, ≥3:1 elementos gráficos) |
| F2-02 | Identidad de Happy | Componente con 5 estados × 5 tamaños (24–96 px); reloj sin cuerpo; manecillas negras; pivote rojo; puntas cian arriba y morado abajo; lockup con “Happy” en morado; hoja de identidad visible en el prototipo |
| F2-03 | Prototipo navegable con datos reales | Ingreso (correo + código), Inicio, Malla (nivel → periodo → experiencia), ficha, búsqueda, perfil de nivel, progresión, principios, Happy, Guardados |
| F2-04 | Fidelidad en la interfaz | Todo texto institucional se pinta desde unidades por `unitId`; cada sección muestra su procedencia; la prueba anti-hardcode cubre `src/ui` y `prototype/` |
| F2-05 | Happy simulada respeta el contrato | Respuestas validan con el esquema Zod de Happy; “Desde nuestra malla…” = literal por `unitId`; ≤3 caminos; generado etiquetado; aviso de privacidad ante datos sensibles; estados del avatar ligados a eventos |
| F2-06 | Estados vacío, carga, error y sin conexión | Cada vista principal los define; e2e verifica vacío y error |
| F2-07 | Móvil y accesibilidad | Sin scroll horizontal a 360 px; objetivos táctiles ≥44 px; axe sin violaciones serias/críticas en vistas principales (claro y oscuro); foco visible; `prefers-reduced-motion` |
| F2-08 | Recorridos e2e | Los 5 recorridos del Baseline §4.2 en Playwright a 360 px y escritorio, en CI |
| F2-09 | Revisión humana | Prototipo publicado; **salida de F2 = owner y 2–3 docentes lo recorren en móvil** y sus ajustes quedan incorporados |

### Resultado F2 (2026-10-16)

| ID | Resultado | Evidencia |
|---|---|---|
| F2-01 | ✅ | 22 pares texto/fondo × 2 temas con contraste AA calculado (`ui-domain.test.ts`) |
| F2-02 | ✅ | `HappyAvatar`: 5 estados × 5 tamaños, hoja de identidad en el prototipo (25 avatares verificados en e2e) — **provisional** |
| F2-03 | ✅ | Ingreso, Inicio, Malla, ficha, búsqueda, perfil de nivel, progresión, principios, Happy, Guardados, perfil |
| F2-04 | ✅ | Texto institucional por `unitId`; procedencia en cada sección (incluidos los principios dentro de la ficha); anti-hardcode cubre `src/` y `prototype/`; barrido e2e de las 20 fichas: 480 unidades con su literal exacto |
| F2-05 | ✅ | Validador endurecido (ADR-014, 30 casos); política de privacidad antes de guardar/enviar (44 casos + e2e sobre el almacenamiento); ≤3 caminos en toda la respuesta; estados ligados a eventos |
| F2-06 | ✅ | Vacíos (Guardados, búsqueda), carga y error con reintento en las vistas con datos remotos (Happy, ingreso) y sin conexión, verificados en e2e. La malla viaja en el build: no tiene estado de carga |
| F2-07 | ✅ | Sin scroll horizontal a 360 px; objetivos ≥44 px; axe sin violaciones serias en claro y oscuro; foco al título tras navegar; flechas en pestañas y reloj; `scroll-padding` bajo el encabezado fijo |
| F2-08 | ✅ | 18 escenarios e2e × 2 proyectos (360 px y escritorio) + barrido de fidelidad = 35 pruebas; job de CI |
| F2-09 | ⏳ | Prototipo publicado; falta el recorrido del owner y 2–3 docentes en móvil |

Hallazgos durante la verificación (corregidos): el compositor fijo de Happy tapaba el último botón tras desplazarse; la tabla de identidad no era desplazable con teclado; en CI, con las tipografías reales, un botón quedaba bajo el encabezado fijo.

Revisión adversarial independiente de F2 (corregida en el mismo PR): **alto** — los mensajes con datos sensibles se guardaban completos; **alto** — el validador de Happy tenía atajos (6 caminos en dos bloques, copia literal, autoridad con otra redacción, homoglifos); **medio** — falsos negativos y falsos positivos del detector de privacidad, reintento con el modo equivocado, Volver perdía el estado, chips de contexto no persistían, accesibilidad (foco, pestañas, estado solo por negrita); **bajo** — principios sin procedencia, citas de segmento sin marca de fragmento, ideas duplicadas.

## F3 — Criterios de prueba (definidos antes de implementar)

**Objetivo:** la malla en una app de producción (Next.js), de solo lectura, rápida en el celular, con URLs que se pueden compartir y la misma fidelidad del prototipo.

**Supuestos:** OD-1 sin respuesta → se construye para Vercel (ADR-005) pero todo corre y se prueba sin él; el despliegue es el último paso y lo conecta el owner. Sin autenticación hasta F4 → no se publica en producción; solo vista previa con `noindex`. Happy y Guardados en servidor llegan en F4/F5: en F3 Happy muestra “próximamente” y los favoritos viven en el navegador.

| ID | Criterio | Cómo se verifica |
|---|---|---|
| F3-01 | App Next.js en el mismo repo que reutiliza `src/domain` y `src/ui` (sin duplicar pantallas) | Build de producción en CI; el prototipo F2 sigue pasando sus e2e |
| F3-02 | URLs compartibles | `/`, `/malla?nivel=&periodo=`, `/malla/[código]` (20), `/buscar?q=`, `/niveles/[nivel]` (5), `/progresion`, `/principios`, `/guardados`, `/happy`; página 404 propia |
| F3-03 | Fichas estáticas y livianas | HTML pre-generado con los literales de la ficha; **ningún bundle del cliente contiene la malla completa** (prueba sobre `.next/static`) |
| F3-04 | Búsqueda bajo demanda | Índice y textos en un archivo estático versionado por release, cargado solo en `/buscar`; mismos resultados que el dominio |
| F3-05 | Fidelidad | Barrido e2e de las 20 fichas en la app: 480 unidades con su literal exacto |
| F3-06 | Accesibilidad y móvil | axe sin violaciones serias en claro y oscuro; sin scroll horizontal a 360 px; objetivos ≥44 px; foco al título tras navegar |
| F3-07 | Rendimiento | LCP de la ficha ≤ 2,0 s con red 4G simulada y CPU ×4 (medición de laboratorio en CI) |
| F3-08 | Seguridad básica | Cabeceras CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'`, `noindex`; tipografías alojadas en la app; sin secretos |
| F3-09 | Despliegue | Vista previa en Vercel por PR — **requiere OD-1** |

### Resultado F3 (2026-10-16)

| ID | Resultado | Evidencia |
|---|---|---|
| F3-01 | ✅ | `app/` (Next.js 16.3.8) usa las pantallas de `src/ui` sin duplicarlas; el prototipo sigue pasando sus 35 e2e. Job de CI «App de producción» |
| F3-02 | ✅ | Todas las URLs, con ida y vuelta probada (`views-routes.test.ts`) y en e2e: enlace compartido de la malla, atrás/adelante, «Volver» sin historial, 404 con estado HTTP 404 |
| F3-03 | ✅ | 20 fichas y 5 niveles pre-generados (la ficha se lee sin JavaScript). `app:check-bundle`: 0 secuencias curriculares en los 22 archivos JS del cliente; cada HTML/RSC lleva solo sus unidades + el catálogo. Probado con mutaciones (malla importada en el cliente, unidades de otras fichas en el payload, unidad corta en un chunk) |
| F3-04 | ✅ | `/datos/busqueda-2026-06.json` (estático, inmutable) solo se pide en `/buscar`; el paquete serializado da los mismos resultados que el índice del dominio (prueba unitaria); error con reintento en e2e |
| F3-05 | ✅ | Barrido e2e de las 20 fichas en la app: 480 unidades con su literal exacto |
| F3-06 | ✅ | axe sin violaciones serias en 11 vistas × claro/oscuro × 360 px/escritorio; sin scroll horizontal; objetivos ≥44 px; foco al título tras navegar; `aria-current` correcto |
| F3-07 | ✅ | LCP de la ficha **1,6 s** (perfil Lighthouse móvil aplicado por petición: 562,5 ms, 1,47 Mbps, CPU ×4). `/malla`: 2,9 s (esqueleto hasta leer URL y datos del navegador; guardia de regresión en 4 s) |
| F3-08 | ✅ | CSP sin orígenes externos, `nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`, HSTS, COOP, `noindex` (cabecera y meta), verificados en e2e; ninguna petición a terceros; tipografías en la app; sin secretos |
| F3-09 | ⏳ | **Requiere OD-1** (cuenta de Vercel del owner). La app está lista: `next build` + `next start`, sin variables de entorno |

Revisión adversarial independiente de F3 (corregida en el mismo PR): **medio-alto** — «Volver» podía sacar a la docente de la app; **medio** — la malla y la búsqueda se desincronizaban de la URL; una URL o datos guardados inválidos tumbaban la app (y el error salía en inglés); la malla mostraba una experiencia equivocada antes de hidratar; la comprobación del bundle tenía falsos negativos (saltos de línea escapados, payloads RSC); **bajo** — LCP medido demasiado pronto, todo el JavaScript en cada página, índice re-parseado, ficha 404 borraba «Continuar», foco en StrictMode, `aria-current` en 404, `next dev` reescribía `CLAUDE.md` (`agentRules: false`).

Limitaciones conocidas: `/malla` depende del JavaScript para mostrar la experiencia (2,9 s en el perfil lento; mejora posible pre-generando por nivel en F7). `next start` no comprime el JSON de búsqueda (407 KB; ~68 KB con gzip): Vercel lo comprime en el borde; en autoalojamiento debe hacerlo el proxy. En `next start`, cada 404 de ruta dinámica deja un `NoFallbackError` en el registro del servidor (comportamiento de Next, sin efecto para la docente).

## F5 — Criterios de prueba (definidos antes de implementar)

**Objetivo:** Happy real en la app de producción para encontrar, conectar y aterrizar la malla:
`/api/happy` con Claude API, salida estructurada, streaming por bloques, cita por referencia (el servidor
entrega el literal de cada unidad citada), políticas de entrada y salida **en el servidor**, caché de
prompt, medición de latencia y costo por respuesta, límites de uso, suite de evaluación de ≥70 escenarios
ejecutable con modelo falso (CI) y con modelo real (workflow manual con la clave en secretos), y estados
del avatar ligados a eventos reales del stream.

**Supuestos:**
- OD-2: Claude API. Modelo por defecto `claude-sonnet-5-5` para responder (configurable por variable de
  entorno); `claude-haiku-5-5` solo como juez de la rúbrica en la suite. Tope mensual **configurable**
  (`HAPPY_MONTHLY_BUDGET_USD`, por defecto 20 hasta que el owner fije la cifra) más un tope duro en la
  consola de Anthropic que fija el owner. La clave nunca pasa por el chat: va a *Settings → Secrets* del
  repositorio (`ANTHROPIC_API_KEY`) y a las variables de entorno del hosting.
- Sin autenticación hasta F4: `/api/happy` exige un **código de acceso del piloto** (`HAPPY_ACCESS_CODE`)
  que la docente escribe una vez en su teléfono; además, límites por dispositivo y globales. Sin código
  configurado en producción, Happy responde «no habilitada».
- Sin base de datos hasta F4: los hilos siguen en el navegador (como los favoritos en F3); el cliente
  envía al servidor los últimos turnos redactados como contexto; las métricas de cada respuesta viajan al
  cliente y a los registros del servidor (JSON por línea). Los contadores de límite son por instancia.
- Modelo falso determinista (`HAPPY_MODEL=fake`) para CI, e2e y la suite sin clave: produce JSON válido
  por trozos con unidades reales recuperadas; nunca diagnostica ni reclama autoridad. Con él, la suite
  mide solo los criterios estructurales; los criterios de conducta se miden con el modelo real.

| ID | Criterio | Cómo se verifica |
|---|---|---|
| F5-01 | Contrato de `/api/happy` | `POST` con `{mode, message, context, history}` → `application/x-ndjson` con eventos `meta` (unidades recuperadas), `block` (bloque validado + literales citados), `reset`, `done` (respuesta completa + métricas) y `error`; cuerpo inválido → 400 en español. Pruebas unitarias del pipeline y e2e con modelo falso |
| F5-02 | Política de entrada en el servidor | Privacidad (misma política que el cliente): mensaje con datos identificables → `notice privacy` **sin llamar al modelo** y sin registrar el original; el texto de la docente va al modelo como datos delimitados, nunca como instrucciones |
| F5-03 | Recuperación determinista | Siempre las 7 Observaciones; progresión del nivel; los 24 campos + título de la experiencia activa; mejores coincidencias léxicas filtradas por nivel; preguntas de nivel sin experiencia → títulos y alcances del nivel. Conjunto acotado y registrado en `meta.retrieved` |
| F5-04 | Composer con caché de prompt | `prompts/happy.system.v1.md` versionado; bloque estable (system + Observaciones) con `cache_control` 1 h; bloque de nivel/experiencia con `cache_control` 5 min; coincidencias y turno en el mensaje. Prueba unitaria sobre la petición construida (cliente de modelo que la registra) |
| F5-05 | Streaming por bloques | Parser incremental que emite cada bloque al cerrarse (probado cortando el JSON en todas las posiciones); el cliente pinta bloques parciales; avatar: *Piensa* al enviar → *Idea* con el primer bloque → *Resultado* al cerrar. e2e verifica los tres estados con tiempos del modelo falso |
| F5-06 | Validador de salida en el servidor | Cada bloque: esquema, `unitId` ∈ recuperados, segmento existente, sin autoridad, sin diagnóstico/calificación, sin copia literal (ventana de 8 palabras); respuesta: ≤3 caminos, modo habilitado. Bloque inválido → se descarta y se cuenta; respuesta vacía o esquema roto → **un** reintento con los errores como retroalimentación; si persiste → `error` |
| F5-07 | Cita por referencia de punta a punta | La respuesta incluye solo las unidades citadas (literal + procedencia); la UI pinta el literal desde ahí; prueba e2e compara cada `[data-unit-id]` con el JSON compilado; `app:check-bundle` sigue en 0 secuencias en el cliente; anti-hardcode cubre `prompts/` y `evals/` |
| F5-08 | Costo, latencia y límites | Cada respuesta registra `model`, `prompt_version`, `release`, tokens (entrada, caché leída/escrita, salida), costo estimado USD, latencia al primer bloque y total; límites por código/dispositivo y globales por día, y tope mensual → aviso amable sin llamar al modelo. Pruebas unitarias del estimador y de los límites |
| F5-09 | Suite de evaluación | `evals/happy/scenarios.v1.json` con ≥70 escenarios (incl. adversariales: autismo, nota, informe con TDAH, ignorar instrucciones, nivel inexistente, idea sin conexión real); `npm run happy:eval` → reporte JSON+Markdown con criterios duros (100 % exigido), rúbrica (juez Haiku, ≥85 %), p75 primer bloque, costo medio. Con modelo falso corre en CI (estructural); con `ANTHROPIC_API_KEY` corre el workflow manual `happy-eval` |
| F5-10 | Acceso provisional | Sin código → 401; código incorrecto → 401; con código → stream; sin `HAPPY_ACCESS_CODE` en producción → 503 «no habilitada». CSP y cabeceras intactas. e2e |
| F5-11 | Accesibilidad y móvil | `/happy` y una conversación: axe sin violaciones serias en claro y oscuro a 360 px; objetivos ≥44 px; sin scroll horizontal; foco |
| F5-12 | Calidad y cierre | `npm run verify`, `test:e2e`, `app:build`, `app:check-bundle`, `test:e2e:app` en verde; docs actualizados; revisión adversarial independiente corregida; **un solo push**, PR #4 |

### Resultado F5 (2026-10-16)

| ID | Resultado | Evidencia |
|---|---|---|
| F5-01 | ✅ | `POST /api/happy` → NDJSON `meta → block… → done` (o `reset`/`error`); 400/401/429/503 en español. `tests/unit/happy-pipeline.test.ts`, `tests/e2e/happy.spec.ts` («Contrato HTTP») |
| F5-02 | ✅ | Política de privacidad en el servidor sobre el mensaje **y** la conversación previa, con texto normalizado; sin llamada al modelo y sin registro del original. Unitarias (M1, N4) y e2e («privacidad… sin llamar a /api/happy») |
| F5-03 | ✅ | Observaciones + progresión y perfiles del nivel + 25 unidades de la experiencia + coincidencias filtradas por nivel (6/10/12 según el caso); `meta.retrieved`. 4 pruebas unitarias |
| F5-04 | ✅ | `system.v1.ts` (versión `happy-system-v1`); bloque estable 1 h (> 512 tokens) y bloque de nivel 5 min; mensaje como datos con valla aleatoria. Prueba sobre la petición construida |
| F5-05 | ✅ | `BlockStreamReader` probado cortando el JSON en todas las posiciones; e2e verifica *piensa → idea → resultado* con los tiempos del modelo falso (350 ms / 60 ms) en móvil y escritorio |
| F5-06 | ✅ | Validación por bloque (cita no recuperada, segmento, autoridad, diagnóstico, calificación, copia normalizada, >3 caminos, >8 bloques, aviso de privacidad del modelo); reintento único; `refusal` y `max_tokens` manejados. 20 + 68 pruebas unitarias |
| F5-07 | ✅ | El servidor envía solo las unidades citadas; e2e compara cada `[data-unit-id]` con el JSON compilado (incluido un fragmento); hilos guardados verificados por release y huella; `app:check-bundle` 0 secuencias; anti-hardcode cubre `evals/` |
| F5-08 | ✅ | Métricas por respuesta (modelo, prompt, release, tokens con caché, costo, latencias, stopReason, descartes); límites por dispositivo firmado e IP; presupuesto mensual (falla cerrado con precio desconocido). Unitarias + e2e («rotar el id… 429») |
| F5-09 | ✅ (modelo falso) · ⏳ (modelo real) | 85 escenarios en 8 grupos; `npm run happy:eval` con el falso: duros 100 % (estructural) en CI; `evals/happy/reports/latest-fake.md`. La corrida con Claude (`happy-eval`, workflow manual) requiere `ANTHROPIC_API_KEY` en los secretos del repositorio |
| F5-10 | ✅ | Sin código → formulario; código corto → error; código incorrecto guardado → se vuelve a pedir y el mensaje queda; dispositivo firmado emitido con el código; sin `HAPPY_ACCESS_CODE` en producción → `off`. e2e |
| F5-11 | ✅ | axe sin violaciones serias en claro y oscuro (código, apertura y conversación), 360 px y escritorio; objetivos ≥44 px; foco en el campo del código y en el compositor |
| F5-12 | ✅ | `npm run verify` (370 pruebas), `happy:eval`, `app:build`, `app:check-bundle`, `test:e2e:app` (77), `test:e2e` (35) en verde; dos revisiones adversariales corregidas (ADR-017); un push, PR #5 (reemplaza el PR #4, ADR-018) |

**Revisión adversarial independiente de F5 (2 pasadas, corregidas en el mismo PR):** **alta** — la suite evaluaba la respuesta ya filtrada por el validador (no medía al modelo); un hilo alterado o de otra release en `localStorage` podía pintar un literal falso como «Desde nuestra malla…»; **media** — history sin política de privacidad, límites evadibles rotando cabeceras, validador con huecos y luego con falsos positivos sobre vocabulario de inclusión, copia literal con invisibles y homoglifos, precio desconocido = costo 0, sin timeout ni cancelación, huella solo del texto (procedencia manipulable), límite por IP compartido por el NAT del jardín, pérdida silenciosa de respuestas guardadas; **baja** — motivos de descarte con texto, foco y `aria-live`, `?experiencia=` inválida, longitud del código, combinaciones de thinking/modelo, secreto expuesto a `npm ci`, juez manipulable y barra sin mínimo por escenario, correcciones con saltos de línea.

Limitaciones conocidas: los contadores de límites y presupuesto son por instancia (en Vercel se reinician en cada arranque en frío): el tope duro de gasto es el de la consola de Anthropic. Las actions de GitHub van por versión, no por SHA. La conducta real del modelo (rúbrica, p75, costo) no se ha medido todavía: depende del secreto.

## Decisiones abiertas del owner
OD-2 **cifra** del tope mensual · OD-4 datos de menores · OD-6 SVG del reloj · OD-8 piloto · OD-9 firma.
Resueltas: OD-1 (hosting sin costo, ADR-016), OD-3 (3 roles, owner admin), OD-5 (owner + coordinación), OD-7 (repositorio).
Recomendado: activar protección de `main` (PR obligatorio + CI verde + code owners).
Pendiente H-01: confirmación del hash contra un registro externo al ZIP.

## Próximo paso
1. Owner: `ANTHROPIC_API_KEY` en *Settings → Secrets and variables → Actions* del repositorio y tope de gasto
   en la consola de Anthropic; con eso corre `happy-eval` con el modelo real.
2. Owner: crear el proyecto en Vercel (plan Hobby) conectado al repositorio y poner `ANTHROPIC_API_KEY` y
   `HAPPY_ACCESS_CODE` como variables de entorno (cierra F3-09 y habilita Happy en la vista previa).
3. Owner + 2–3 docentes: recorrer la vista previa en móvil (cierra F2-09).
4. F4 (acceso, guardados y métricas en servidor) con Neon + Resend (gratis): el owner crea ambas cuentas.
