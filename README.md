# Happy Time — Plataforma Curricular

Plataforma para que las docentes de educación inicial de Happy Time exploren la malla curricular institucional y trabajen con **Happy**, su asistente curricular. _“La docente conduce. Happy amplía posibilidades.”_

## Estado

Ver [`docs/EXECUTION_STATUS.md`](docs/EXECUTION_STATUS.md). Arquitectura y producto: [`docs/ARCHITECTURE_BASELINE_v1.md`](docs/ARCHITECTURE_BASELINE_v1.md). Decisiones: [`docs/DECISIONS.md`](docs/DECISIONS.md). Huellas de cada Excel recibido: [`docs/GATE0_LOG.md`](docs/GATE0_LOG.md).

## Fuente curricular

La única autoridad es el Excel certificado en `curriculum/source/` (release `2026-06`). Un compilador determinista lo convierte en `curriculum/build/curriculum.2026-06.json`: **572 unidades trazables**, cada una con su texto literal, hoja, celda y huella de la fuente. Un validador independiente en Python comprueba celda por celda que la compilación es fiel.

```
Excel certificado ──► gate ──► compilador ──► curriculum.json + índice de búsqueda
                                   │
                                   └──► validador independiente (Python/openpyxl)
```

## Requisitos

- Node.js 22 (`.nvmrc`)
- Python 3.12+ con `openpyxl` (`scripts/curriculum/independent/requirements.txt`)

## Uso

```bash
npm ci
pip install -r scripts/curriculum/independent/requirements.txt
npm run verify                         # tipos, lint, pruebas, check curricular
npm run curriculum:verify-independent  # segunda lectura en Python
```

### App de producción (Next.js)

```bash
npm run app:dev            # desarrollo en http://localhost:3000
npm run app:build          # build: 20 fichas y 5 niveles pre-generados
npm run app:check-bundle   # la malla completa no viaja al navegador
npm run test:e2e:app       # e2e contra next start (URLs, fidelidad, axe, seguridad, LCP)
```

### Happy (F5)

Happy corre en `/api/happy` con Claude API. Sin clave, o con `HAPPY_MODEL=fake`, responde el modelo
falso determinista (CI, e2e y pruebas locales). Variables de entorno:

| Variable                                              | Qué hace                                                                     | Por defecto                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| `ANTHROPIC_API_KEY`                                   | Clave de Claude API (solo en el servidor y en los secretos de Actions)       | —                                      |
| `HAPPY_MODEL`                                         | `anthropic` · `fake` · `off`                                                 | `anthropic` si hay clave; si no, `off` |
| `HAPPY_MODEL_ID`                                      | Modelo que responde                                                          | `claude-sonnet-5-5`                    |
| `HAPPY_EFFORT` · `HAPPY_THINKING`                     | `low                                                                         | medium                                 | high`·`adaptive | between_tools` | `low` · `adaptive` |
| `HAPPY_ACCESS_CODE`                                   | Código del piloto (≥4 caracteres). Sin él, en producción Happy queda apagada | —                                      |
| `HAPPY_DEVICE_SECRET`                                 | Secreto para firmar dispositivos (obligatorio en producción)                 | derivado del código                    |
| `HAPPY_LIMIT_PER_HOUR` · `HAPPY_LIMIT_PER_DAY`        | Límites por dispositivo                                                      | 40 · 150                               |
| `HAPPY_LIMIT_IP_PER_HOUR` · `HAPPY_LIMIT_IP_PER_DAY`  | Límites por IP                                                               | 400 · 1500                             |
| `HAPPY_LIMIT_GLOBAL_DAY` · `HAPPY_MONTHLY_BUDGET_USD` | Tope global diario y presupuesto mensual (USD)                               | 1500 · 20                              |

```bash
npm run happy:eval                        # suite de 85 escenarios con el modelo falso (estructural)
npm run happy:eval -- --model anthropic   # con Claude API (requiere ANTHROPIC_API_KEY): conducta + rúbrica
HAPPY_MODEL=fake HAPPY_ACCESS_CODE=piloto npm run app:dev   # Happy en local sin clave
```

El workflow manual **Happy · evaluación con modelo real** (`.github/workflows/happy-eval.yml`) corre la
suite con el secreto `ANTHROPIC_API_KEY` del repositorio y publica el reporte como artefacto.

### Prototipo (un solo HTML)

```bash
npm run prototype:build    # dist/prototype/index.html
npm run test:e2e           # e2e del prototipo
```

`src/ui` contiene las pantallas compartidas; `app/` (Next.js) y `prototype/` (Vite) solo les inyectan datos, servicios y navegación.
