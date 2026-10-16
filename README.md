# Happy Time — Plataforma Curricular

Plataforma para que las docentes de educación inicial de Happy Time exploren la malla curricular institucional y trabajen con **Happy**, su asistente curricular. _“La docente conduce. Happy amplía posibilidades.”_

## Estado

Ver [`docs/EXECUTION_STATUS.md`](docs/EXECUTION_STATUS.md). Arquitectura y producto: [`docs/ARCHITECTURE_BASELINE_v1.md`](docs/ARCHITECTURE_BASELINE_v1.md).

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

### Happy (asistente)

Apagada por defecto. Variables del servidor:

| Variable                                                                            | Uso                                                                     |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `HAPPY_ENABLED=1`                                                                   | Enciende `/api/happy` (no hacerlo en un despliegue público antes de F4) |
| `ANTHROPIC_API_KEY`                                                                 | Clave del proveedor (solo servidor)                                     |
| `HAPPY_MODEL`                                                                       | Modelo (predeterminado `claude-sonnet-5-5`)                             |
| `HAPPY_IP_LIMIT`, `HAPPY_IP_WINDOW_MS`, `HAPPY_IP_DAILY_LIMIT`, `HAPPY_DAILY_LIMIT` | Límites de mejor esfuerzo                                               |
| `HAPPY_TRUST_XFF=1`                                                                 | Solo detrás de un proxy propio que reescribe `X-Forwarded-For`          |

```bash
npm run happy:eval -- --composer=guion        # verifica el pipeline y el corredor sin IA
ANTHROPIC_API_KEY=… npm run happy:eval         # evaluación real (informe en evals/resultados/)
```

Fija también un límite de gasto mensual en la consola del proveedor: es el único tope de costo fiable antes de F4.

### Prototipo (un solo HTML)

```bash
npm run prototype:build    # dist/prototype/index.html
npm run test:e2e           # e2e del prototipo
```

`src/ui` contiene las pantallas compartidas; `app/` (Next.js) y `prototype/` (Vite) solo les inyectan datos, servicios y navegación.
