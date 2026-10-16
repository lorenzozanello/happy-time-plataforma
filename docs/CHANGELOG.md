# CHANGELOG — Happy Time

## [F5] 2026-10-16 — Happy núcleo (sin proveedor conectado)
### Agregado
- Pipeline de Happy en el servidor: política de entrada, contexto, router, recuperación determinista, prompt v1 versionado, composer de Claude (streaming y caché de prompt) y de guion, validación por bloque y streaming NDJSON.
- `/api/happy`: apagada por defecto, mismo origen, límites de cuerpo, por IP y por día; disponibilidad en tiempo de ejecución.
- Happy en la app sin la malla en el navegador: el servidor envía cada cita con su literal.
- Suite de evaluación de 48 escenarios con criterios duros automáticos y juez independiente; `npm run happy:eval` genera un informe con métricas y rúbrica.
- e2e de Happy contra `next start` con el composer de guion.

### Corregido (revisión adversarial independiente)
- Reglas de salida ampliadas (autoridad en voz pasiva y con sujetos institucionales, diagnósticos, etiquetas, notas en letras y desempeño cualitativo) y revisión de frases partidas entre campos.
- Copia literal detectada sin importar tildes, NFD, invisibles, homoglifos o ancho completo; unidades cortas incluidas.
- Detector de privacidad: teléfonos con separadores e indicativo, dígitos de ancho completo, «número», @usuario y cruces de calles.
- Sin avisos de privacidad falsos por respuestas previas de Happy; límites que no dependen de `X-Forwarded-For`; tope diario por IP.
- Datos guardados reconstruidos campo a campo; citas de otra release marcadas; errores del servidor visibles; registro también en abortos y respuestas parciales.

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
