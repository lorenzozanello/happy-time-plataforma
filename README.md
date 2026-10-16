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
