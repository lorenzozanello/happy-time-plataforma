# Registro de Gate 0 — huellas de la fuente curricular

Cada archivo Excel que llega al proyecto se verifica aquí **antes** de cualquier otra cosa. La release
certificada vigente es la que fija `curriculum/source/SOURCE.lock.json`; cambiarla es una nueva
release (ADR-003) y requiere la aprobación definida en OD-5.

| Fecha | Archivo recibido | SHA-256 | Bytes | Resultado |
|---|---|---|---|---|
| 2026-10-16 | `Malla HT Versión Final Junio 2026 (2).xlsx` | `4d58fe13b8509a09688c315d5666c5821263016abb5b49538044de5f21803cbe` | 130 388 | **Release 2026-06** (certificada; Gate 22/22) |
| 2026-10-16 | `Malla_HT_Versión_Final_Junio_2026_3.xlsx` | `f524096c318c9c2e20d2eba122cc750c1f25738d0609e38c1eb109355fee681e` | 130 353 | **Exportación equivalente** de la release 2026-06 (ver abajo). No es una nueva release. |

## 2026-10-16 · `Malla_HT_Versión_Final_Junio_2026_3.xlsx`

- La huella **no coincide** con la release certificada (`4d58fe13…`), así que se comparó el contenido
  con un lector independiente (Python/openpyxl, sin pasar por el compilador):
  - mismas 3 hojas, en el mismo orden, todas visibles;
  - mismos rangos (`A1:AG1000`, `A1:A8`, `A1:G6`) y las mismas 35 combinaciones de celdas;
  - **638/638 celdas no vacías idénticas** (valor a valor, sin normalizar);
  - 0 celdas solo en uno de los dos archivos; 0 celdas con texto distinto.
- Diferencias a nivel de bytes, únicamente en el ZIP interno: el orden de la tabla de cadenas
  compartidas (`xl/sharedStrings.xml`, mismo tamaño) y, en consecuencia, los índices `<v>` de
  `sheet1.xml` y `sheet3.xml`; y el orden de dos estilos de tabla en `styles.xml`. Es el
  comportamiento de una **re-exportación** del mismo Google Sheet.
- Decisión: la release 2026-06 sigue siendo la autoridad. Esta huella queda registrada como
  exportación equivalente. Si el owner prefiere que el archivo certificado sea esta exportación,
  se hace mediante PR de release (gate + `curriculum:diff`, que daría 0 diferencias de unidad).
