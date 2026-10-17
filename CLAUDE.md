# Happy Time — reglas para Claude en este repositorio

Plataforma Curricular Happy Time y su asistente pedagógica **Happy**. Reconstrucción limpia (2026).
Contrato completo: `docs/ARCHITECTURE_BASELINE_v1.md`. Decisiones: `docs/DECISIONS.md`.

## Al empezar cada sesión

1. Lee `docs/EXECUTION_STATUS.md` (fase actual, criterios, bloqueos) y `docs/DECISIONS.md`.
2. Declara objetivo de la iteración, supuestos y criterios de prueba **antes** de implementar.
3. Toca un subsistema a la vez. Detente ante decisiones del owner (OD-x) que cambien arquitectura, alcance o seguridad.

## Reglas no negociables

- **Autoridad curricular única:** `curriculum/source/malla-2026-06.xlsx` (SHA-256 en `SOURCE.lock.json`). Es read-only: nunca se edita, limpia, corrige, traduce ni normaliza.
- Todo lo demás es derivado (`curriculum/build/*`) y se regenera con `npm run curriculum:compile`. Nunca edites a mano los archivos de `curriculum/build/`.
- **Prohibido hardcodear texto curricular** en `src/`, `scripts/` o `app/` (hay una prueba que lo detecta). La UI y Happy leen las unidades por `unitId` desde el JSON compilado.
- Happy **cita por referencia** (ADR-007): el modelo devuelve `unitId`; la UI pinta el literal. Lo generado se etiqueta “Como idea complementaria…”.
- Sin datos identificables de niñas y niños en v1 (ADR-009, pendiente OD-4).
- Una nueva versión de la malla = nueva release con PR, gate, `curriculum:diff` y aprobación del owner y coordinación (ADR-003). Todo Excel recibido se registra en `docs/GATE0_LOG.md` antes de cualquier otra cosa.
- Happy (F5, ADR-017): el modelo solo devuelve `unitId`; el servidor resuelve el literal y valida cada bloque (`src/domain/happy/`). Las reglas de texto (`rules.ts`) priorizan precisión: no bloquean el vocabulario de inclusión. Sin clave se usa el modelo falso (`HAPPY_MODEL=fake`); la clave nunca va al repo ni al chat.

## Comandos

| Comando                                     | Qué hace                                                     |
| ------------------------------------------- | ------------------------------------------------------------ |
| `npm run verify`                            | typecheck + lint + pruebas + check curricular                |
| `npm run curriculum:gate`                   | Gate estructural de la fuente                                |
| `npm run curriculum:compile`                | Regenera `curriculum/build/*`                                |
| `npm run curriculum:check`                  | Falla si lo versionado difiere de la recompilación           |
| `npm run curriculum:verify-independent`     | Segunda lectura con Python/openpyxl                          |
| `npm run curriculum:diff -- a.json b.json`  | Diferencias entre releases                                   |
| `npm run happy:eval`                        | Suite de Happy (modelo falso; `--model anthropic` con clave) |
| `npm run app:build && npm run test:e2e:app` | App de producción: bundle, fidelidad, Happy, axe, LCP        |

## Al terminar

- Todo en verde (`npm run verify` y el validador Python) y CI verde en el PR.
- Actualiza `docs/EXECUTION_STATUS.md`, `docs/CHANGELOG.md` y, si hubo decisiones, `docs/DECISIONS.md`.
- No declares una fase terminada solo porque el código compila: verifica y deja evidencia.
- Idioma del producto y la documentación: español (es-CO).
