# EXECUTION_STATUS — Happy Time

**Última actualización:** 2026-10-16
**Fase actual:** F5 — Happy núcleo (lista en PR, salvo F5-09: medición con el modelo real, OD-2) · F3 fusionada (falta despliegue, OD-1) · F2 pendiente de revisión humana
**Release curricular:** 2026-06 · SHA-256 `4d58fe13b8509a09688c315d5666c5821263016abb5b49538044de5f21803cbe`

| Fase | Estado | Evidencia / bloqueo |
|---|---|---|
| F0 Baseline | ✅ Aprobado por el owner (2026-10-16, “Procede”) | `docs/ARCHITECTURE_BASELINE_v1.md` |
| F1 Compilador curricular | ✅ Fusionado (PR #1) · ⏳ OD-5 para cierre formal | PR #1, CI verde |
| F2 Diseño y prototipo | ✅ Fusionado (PR #2) · ⏳ revisión humana (F2-09) | Reloj provisional hasta OD-6 |
| F3 Malla en producción | ✅ Fusionado (PR #3) · ⏳ F3-09 despliegue (OD-1) | `npm run app:build`, `app:check-bundle`, `test:e2e:app` |
| F4 Acceso y Guardados | ⏸ | OD-1, OD-3 |
| F5 Happy núcleo | ✅ F5-01…F5-08 en PR · ⏳ F5-09 (OD-2) | `npm run happy:eval` con la clave |
| F6 Happy extendida | ⏸ | OD-4 |
| F7 Endurecimiento y piloto | ⏸ | OD-8 |

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

**Objetivo:** el núcleo de Happy en el servidor —políticas, enrutador, recuperación, composer, validación y streaming— listo para conectarse al proveedor de IA, y verificado de punta a punta sin él.

**Supuestos (trabajo autónomo, según las recomendaciones del Baseline):**
- **OD-2 sin respuesta** → se implementa la recomendación (Claude API) detrás de una interfaz `Composer`. Modelo por variable de entorno (`HAPPY_MODEL`, predeterminado `claude-sonnet-5-5`); sin clave no hay llamadas ni costo. La calidad real (rúbrica, latencia, costo) se mide cuando el owner cargue la clave.
- **F4 aún no existe** (sin autenticación): `/api/happy` queda **apagada por defecto** en producción (`HAPPY_ENABLED`). Encenderla sin F4 solo es aceptable en una vista previa privada, con límites por IP y tope diario.
- Sin base de datos todavía: el hilo vive en el navegador y el cliente envía los últimos turnos ya redactados; la persistencia en servidor (con `model`, `prompt_version`, unidades y latencias) llega con F4.
- El handoff original (§5–6, tono e identidad) no está en esta sesión: el prompt v1 se redacta desde el Baseline (§3–4, §8) y queda marcado para revisión del owner.
- El texto literal de las citas lo resuelve el **servidor** desde el JSON compilado (nunca el modelo) y viaja junto al bloque: la app no necesita la malla completa en el navegador.

| ID | Criterio | Cómo se verifica |
|---|---|---|
| F5-01 | `/api/happy` segura por defecto | Apagada sin `HAPPY_ENABLED`; mismo origen; cuerpo ≤ 8 KB validado con Zod; límite por IP y tope diario; errores en español; sin secretos en el cliente (chequeo de bundle) |
| F5-02 | Política de entrada en el servidor | Datos identificables → aviso de privacidad **sin llamar al modelo** y sin registrar el original; mismas 44 pruebas del detector + pruebas del endpoint |
| F5-03 | Contexto y enrutador | Contexto validado contra el catálogo; intención elegida o reglas para texto libre; pruebas por modo |
| F5-04 | Recuperación determinista (§8.3) | Siempre las 7 Observaciones + progresión del nivel; experiencia activa completa; búsqueda léxica filtrada por nivel; tope de tamaño; `retrieved_unit_ids` registrado |
| F5-05 | Composer | Prompt versionado (`src/server/happy/prompt.v1.ts`) sin texto curricular escrito a mano (las Observaciones se inyectan desde el JSON); adaptador de Claude con streaming y caché de prompt, probado contra un servidor simulado; `model` y `prompt_version` en cada respuesta |
| F5-06 | Validación en streaming | Cada bloque se valida antes de mostrarse (unitId recuperado, sin autoridad, sin diagnóstico/nota, sin copia literal, ≤3 caminos); un reintento si no queda ningún bloque válido; literales resueltos por el servidor |
| F5-07 | Happy en la app | Servicio HTTP con streaming; Happy usable en la app sin la malla completa en el navegador; estados del avatar ligados a eventos; e2e contra `next start` con un composer de guion (solo en modo prueba) |
| F5-08 | Suite de evaluación | ≥40 escenarios versionados (incluidos los adversariales del §8.8) con criterios duros automáticos; el corredor detecta violaciones (probado con respuestas malas de guion) |
| F5-09 | Calidad con el modelo real | 100 % criterios duros, ≥85 % rúbrica, p75 primer bloque ≤ 6 s, costo por respuesta medido — **requiere OD-2** |

### Resultado F5 (2026-10-16)

| ID | Resultado | Evidencia |
|---|---|---|
| F5-01 | ✅ | `/api/happy` apagada sin `HAPPY_ENABLED` (503); mismo origen (403); cuerpo leído en streaming y cortado a 48 KB (413); Zod estricto (400); límites por IP (ventana y día) y tope global diario; IP solo de cabeceras de la plataforma; `app:check-bundle` verifica que el prompt, el SDK y la clave no estén en el cliente |
| F5-02 | ✅ | Política en el servidor sobre el mensaje y los turnos de la docente: aviso sin llamar al modelo (prueba con espía); el registro nunca guarda texto de la docente ni texto generado. Detector ampliado (NFKC, teléfonos con separadores e indicativo, «número», @usuario, «carrera X con calle Y»): 63 casos |
| F5-03 | ✅ | Contexto validado contra la release (nivel inexistente se descarta; nivel+periodo → experiencia); intención elegida o reglas; modos de F6 → `general` |
| F5-04 | ✅ | 7 Observaciones siempre; experiencia activa (título + 24 campos); progresión del nivel; búsqueda léxica filtrada por nivel; año del nivel en preguntas amplias; tope de 36 000 caracteres; `retrievedUnitIds` en el registro |
| F5-05 | ✅ | `prompt.v1.ts` con Observaciones inyectadas desde el JSON (anti-hardcode cubre `src/` y `evals/happy`); adaptador de Claude probado contra un servidor simulado: modelo, clave, streaming, caché del prompt de sistema y de las unidades, uso de tokens; `model` y `prompt_version` en cada respuesta |
| F5-06 | ✅ | Validación por bloque antes de emitir: cita recuperada, segmento existente, sin autoridad, sin diagnóstico/etiqueta/nota, sin copia (normalizada, también unidades cortas), frase partida entre campos, ≤3 caminos (recorta), ≤8 bloques, ≤3 acciones; aviso de privacidad con texto del servidor; un reintento si no queda nada válido; parcial y abortado registrados |
| F5-07 | ✅ | Happy en la app vía HTTP/NDJSON sin la malla en el navegador; disponibilidad en tiempo de ejecución; conversación retomable con literales; citas de otra release marcadas; errores del servidor visibles; 9 e2e × 2 proyectos con Happy encendida (composer de guion) |
| F5-08 | ✅ | 48 escenarios (incluidos los adversariales del §8.8 y los formatos de privacidad de la revisión); criterios duros automáticos + **juez independiente** con reglas propias; el corredor detecta cada violación (pruebas con respuestas malas); guion: 48/48 duros |
| F5-09 | ⏳ | **Requiere OD-2.** Con la clave: `ANTHROPIC_API_KEY=… npm run happy:eval` → informe con criterios duros, p75 de primer bloque, tokens, costo (con precios vigentes) y rúbrica para calificar a mano |

Revisión adversarial independiente de F5 (corregida en el mismo PR): **alto** — el validador dejaba pasar reclamos de autoridad, diagnósticos y notas con redacciones comunes, y la evaluación reusaba sus mismas reglas; la detección de copia se evadía sin tildes, con NFD, invisibles u homoglifos; teléfonos y documentos frecuentes evadían la política de privacidad. **medio** — turnos de Happy en el historial disparaban avisos falsos; límite por IP evadible con `X-Forwarded-For` y tope diario global; literales guardados de otra release se mostraban como vigentes; unidades cortas copiables. **bajo** — localStorage alterado tumbaba el hilo; cuerpo sin `Content-Length` se leía entero; `save_idea` sin validar ni manejador; errores del servidor ocultos; solicitudes abortadas sin registro; respuestas truncadas como completas; huecos de la suite.

Limitaciones conocidas: sin autenticación (F4) los límites son de mejor esfuerzo y por instancia; **el tope real de gasto es el límite mensual en la consola del proveedor (owner)**. No encender Happy en un despliegue público antes de F4. Las reglas de salida son heurísticas: la tasa de bloques descartados con el modelo real (`descartados` en el informe) dirá si hay falsos rechazos que ajustar en `prompt.v2`. El prompt v1 se redactó sin el handoff original (§5–6): revisión del owner pendiente.

## Decisiones abiertas del owner
OD-1 hosting/datos · OD-2 IA y presupuesto · OD-3 roles/accesos/retención · OD-4 datos de menores · OD-5 gobierno curricular · OD-6 SVG del reloj · OD-8 piloto · OD-9 firma.
OD-7 resuelta: repositorio `lorenzozanello/happy-time-plataforma`.
Recomendado: activar protección de `main` (PR obligatorio + CI verde + code owners).
Pendiente H-01: confirmación del hash contra un registro externo al ZIP.

## Próximo paso
F5 en curso en la rama `f5-happy-nucleo` (trabajo autónomo por indicación del owner, 2026-10-16). Pendientes del owner: Vercel (OD-1, cierra F3-09), clave y presupuesto de IA (OD-2, cierra F5-09), roles y accesos (OD-3, habilita F4), recorrido con docentes (F2-09).
