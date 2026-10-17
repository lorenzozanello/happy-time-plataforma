# CHANGELOG — Happy Time

## [F5] 2026-10-16 — Happy núcleo
### Agregado
- `/api/happy`: Claude API con salida estructurada, caché de prompt (bloque estable 1 h + nivel/experiencia 5 min), streaming por bloques (NDJSON) y validación por bloque en el servidor; cita por referencia de punta a punta (el servidor entrega solo los literales citados, con procedencia).
- Pipeline de dominio reutilizable (`src/domain/happy/`): recuperación determinista, composer con prompt versionado (`happy-system-v1`), lector incremental de JSON, reglas de texto sin dependencias, costo y límites; adaptador de Claude API y modelo falso determinista para CI, e2e y suite sin clave.
- Happy real en la app: código de acceso del piloto, dispositivo firmado, bloques parciales, estados del avatar ligados al stream, botón «Cancelar», tiempos máximos, métricas por respuesta (latencia y costo), hilos con sus literales verificados por release y huella.
- Suite de evaluación de 85 escenarios (`evals/happy/scenarios.v1.json`) con criterios duros sobre lo mostrado y sobre la salida cruda del modelo, rúbrica por juez y métricas; `npm run happy:eval` en CI con el modelo falso; workflow manual `happy-eval` con el modelo real.
- 68 pruebas unitarias nuevas (reglas, pipeline, lector, costo, límites, persistencia) y 16 escenarios e2e × 2 proyectos.
- `docs/GATE0_LOG.md`: registro de huellas de cada Excel recibido (la exportación `_3` es equivalente a la release 2026-06).

### Corregido (dos revisiones adversariales independientes)
- La suite evaluaba la respuesta ya filtrada: ahora mide la salida cruda del modelo y cuenta los descartes.
- Un hilo alterado o de otra release en el navegador podía mostrar un literal falso como malla: huella por unidad (texto + procedencia) y release vigente; lo no verificable se muestra como error con «Reintentar».
- La conversación previa enviada por el cliente no pasaba por la política de privacidad; nombres con caracteres invisibles la evadían.
- Límites evadibles rotando cabeceras; ahora dispositivo firmado + IP (con topes propios).
- Validador: primero con huecos (frases de autoridad y diagnóstico que pasaban, `payload` sin validar, copia con invisibles) y después con falsos positivos sobre vocabulario de inclusión; reescrito por precisión con corpus de pruebas.
- Precio desconocido estimaba costo 0 (tope inoperante); cliente sin timeout ni cancelación; motivos de descarte con texto; foco y `aria-live`; URL con experiencia inválida; secreto expuesto a `npm ci`; juez manipulable.

### Decisiones
- ADR-016 (hosting sin costo), ADR-017 (implementación de Happy núcleo); ADR-003, ADR-005 y ADR-008 actualizados con las respuestas del owner.

## [F3] 2026-10-16 — Malla en producción (Next.js)
### Agregado
- App Next.js 16 en `app/` que reutiliza las pantallas de `src/ui` con modelos de vista serializables y navegación inyectada.
- URLs compartibles: `/`, `/malla?nivel=&periodo=`, `/malla/[código]` (20), `/buscar?q=`, `/niveles/[nivel]` (5), `/progresion`, `/principios`, `/guardados`, `/happy`, `/perfil`, `/identidad`; 404 y páginas de error propias en español.
- Fichas y niveles pre-generados; búsqueda como archivo estático versionado por release, cargado solo en `/buscar`.
- Cabeceras de seguridad, `noindex` y tipografías alojadas en la app.
- `npm run app:check-bundle`: ningún JavaScript del cliente contiene texto curricular; cada página lleva solo sus unidades.
- e2e de la app contra `next start` (24 escenarios × 360 px y escritorio): URLs, fidelidad de las 20 fichas, sin JavaScript, búsqueda, datos del navegador, axe claro/oscuro, seguridad y LCP. Job de CI propio.

### Corregido (revisión adversarial independiente)
- «Volver» podía sacar a la docente de la app; ahora usa el historial solo si es de la app y, si no, la pantalla padre.
- La malla y la búsqueda quedaban desincronizadas de la URL tras atrás/adelante o la pestaña.
- Una URL (`periodo=2.5`) o datos guardados inválidos tumbaban la app; se validan y hay páginas de error en español.
- La malla mostraba una experiencia equivocada antes de leer la URL y los datos guardados; ahora muestra un esqueleto.
- La comprobación del bundle no veía unidades con saltos de línea ni los payloads RSC; se endureció y se probó con mutaciones.
- JavaScript por página de ~290 KB a ~185 KB (gzip): módulos cliente por página, MiniSearch solo en `/buscar`, Zod fuera de la app.
- Visitar una ficha inexistente borraba «Continuar donde quedaste»; StrictMode movía el foco al cargar.

## [F2] 2026-10-16 — Sistema de diseño y prototipo navegable
### Agregado
- Tokens de diseño claro/oscuro con prueba de contraste AA; CSS móvil primero con objetivos de 44 px.
- Avatar de Happy (provisional) con 5 estados × 5 tamaños y lockup; hoja de identidad.
- Pantallas: ingreso con código, elección de niveles, Inicio, Malla con reloj de periodos, ficha completa con procedencia, búsqueda con resaltado, perfil de nivel, progresión, principios, Happy, Guardados y perfil.
- Contrato de Happy (`HappyResponseSchema` + validador) y detector preliminar de privacidad.
- Happy simulada que cita la malla por `unitId`; estados del avatar ligados a eventos reales.
- Prototipo empaquetado en un solo HTML; 35 pruebas e2e (Playwright + axe) en CI; 205 pruebas unitarias.

### Corregido (revisión adversarial independiente)
- Política de privacidad antes de guardar o enviar: solo se persiste la versión redactada.
- Detector de privacidad centrado en datos identificables (no bloquea PIAR, DUA ni discapacidad).
- Validador de Happy endurecido contra copia literal, autoridad, diagnósticos, calificaciones y homoglifos.
- Reintento ligado al mensaje que falló; Volver conserva conversación, malla y búsqueda; foco tras navegar.

## [F1] 2026-10-16 — Compilador curricular
### Agregado
- Repositorio `happy-time-plataforma` con TypeScript estricto, ESLint, Prettier, Vitest y CI en GitHub Actions.
- `curriculum/source/malla-2026-06.xlsx` (copia byte a byte del Excel certificado, solo lectura) y `SOURCE.lock.json`.
- Gate estructural de 22 comprobaciones, lector XLSX propio, compilador determinista y esquema canónico con Zod.
- `curriculum/build/curriculum.2026-06.json`: 572 unidades trazables; índice de búsqueda; reporte de compilación.
- Validador independiente en Python/openpyxl (doble lectura) y reporte de diferencias entre releases.
- 69 pruebas automatizadas: fidelidad, atribución, mutaciones, determinismo, anti-hardcode, búsqueda, segmentación, lector XLSX sintético.
- `.github/CODEOWNERS` y finales de línea LF.

### Corregido (revisión adversarial independiente)
- El validador Python ahora verifica la atribución de cada celda, no solo el texto.
- El lector XLSX decodifica referencias numéricas de caracteres.
- El diff de releases detecta cambios de celda, nivel, código, segmentos y estructuras.
- Se elimina `gate0.py` del repo (era el script del paquete y no aplicaba al lock).
- `CLAUDE.md` con las reglas de trabajo para sesiones futuras.

### Sin cambios
- La malla curricular no fue modificada.

## [F0] 2026-10-16 — Architecture & Product Baseline v1
### Agregado
- Gate 0 de integridad ejecutado sobre `Malla HT Versión Final Junio 2026 (2).xlsx`: PASS 21/21.
- Script reproducible `gate0/gate0.py` y resultado `gate0/gate0_result.json`.
- `docs/ARCHITECTURE_BASELINE_v1.md`: producto, UX, arquitectura técnica, contrato curricular, modelo de datos, arquitectura de Happy, seguridad, fases, riesgos, Definition of Done.
- `docs/DECISIONS.md`: ADR-001 a ADR-011.
- `docs/EXECUTION_STATUS.md`.

### Sin cambios
- La malla curricular no fue modificada. No se escribió código de aplicación.
