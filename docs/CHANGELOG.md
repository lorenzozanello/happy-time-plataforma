# CHANGELOG — Happy Time

## [F1] 2026-10-16 — Compilador curricular
### Agregado
- Repositorio `happy-time-plataforma` con TypeScript estricto, ESLint, Prettier, Vitest y CI en GitHub Actions.
- `curriculum/source/malla-2026-06.xlsx` (copia byte a byte del Excel certificado, solo lectura) y `SOURCE.lock.json`.
- Gate estructural de 22 comprobaciones, lector XLSX propio, compilador determinista y esquema canónico con Zod.
- `curriculum/build/curriculum.2026-06.json`: 572 unidades trazables; índice de búsqueda; reporte de compilación.
- Validador independiente en Python/openpyxl (doble lectura) y reporte de diferencias entre releases.
- 42 pruebas automatizadas: fidelidad, mutaciones, determinismo, anti-hardcode, búsqueda, segmentación.
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
