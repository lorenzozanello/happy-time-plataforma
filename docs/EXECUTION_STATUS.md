# EXECUTION_STATUS — Happy Time

**Última actualización:** 2026-10-16
**Fase actual:** F1 — Compilador curricular (en curso)
**Release curricular:** 2026-06 · SHA-256 `4d58fe13b8509a09688c315d5666c5821263016abb5b49538044de5f21803cbe`

| Fase | Estado | Evidencia / bloqueo |
|---|---|---|
| F0 Baseline | ✅ Aprobado por el owner (2026-10-16, “Procede”) | `docs/ARCHITECTURE_BASELINE_v1.md` |
| F1 Compilador curricular | 🔄 En curso | Cierre requiere OD-5 |
| F2 Diseño y prototipo | ⏸ | OD-6, OD-9 |
| F3 Slice Malla | ⏸ | OD-1 |
| F4 Acceso y Guardados | ⏸ | OD-1, OD-3 |
| F5 Happy núcleo | ⏸ | OD-2 |
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

## Decisiones abiertas del owner
OD-1 hosting/datos · OD-2 IA y presupuesto · OD-3 roles/accesos/retención · OD-4 datos de menores · OD-5 gobierno curricular · OD-6 SVG del reloj · OD-8 piloto · OD-9 firma.
OD-7 resuelta: repositorio nuevo `lorenzozanello/happy-time-plataforma` (pendiente de creación por el owner).
Pendiente H-01: confirmación del hash contra un registro externo al ZIP.

## Próximo paso
Completar F1 y subir al repositorio cuando exista.
