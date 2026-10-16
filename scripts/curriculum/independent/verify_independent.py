"""
Validador independiente de fidelidad curricular (ADR-002, criterio F1-05).

Lee el Excel certificado con openpyxl (parser distinto al del compilador TypeScript) y verifica
que la release compilada reproduce cada celda de autoridad byte a byte, sin omisiones ni duplicados.

Uso: python3 -I verify_independent.py curriculum/source/SOURCE.lock.json
Sale con código 1 ante cualquier discrepancia.
"""
import hashlib
import json
import sys
from pathlib import Path

import openpyxl

ALLOWED_PREFIXES = {"", "Tema: ", "Competencia: ", "Avance: ", "Evidencia: ", "Alertas: ", "1. ", "2. ", "3. "}


def utf16_len(s: str) -> int:
    return len(s.encode("utf-16-le")) // 2


def utf16_slice(s: str, start: int, end: int) -> str:
    b = s.encode("utf-16-le")
    return b[start * 2 : end * 2].decode("utf-16-le")


def main() -> int:
    lock_path = Path(sys.argv[1]).resolve()
    root = lock_path.parents[2]
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    release = lock["release"]
    compiled_path = root / "curriculum" / "build" / f"curriculum.{release}.json"
    data = json.loads(compiled_path.read_text(encoding="utf-8"))
    errors: list[str] = []

    raw = (root / lock["file"]).read_bytes()
    if hashlib.sha256(raw).hexdigest() != lock["sha256"]:
        errors.append("SHA-256 de la fuente no coincide con el lock")
    if data["source"]["sha256"] != lock["sha256"]:
        errors.append("La release compilada declara otra huella de fuente")

    wb = openpyxl.load_workbook(root / lock["file"], data_only=False)
    if wb.sheetnames != lock["sheets"]:
        errors.append(f"Hojas: {wb.sheetnames}")

    # 1) Cada unidad reproduce exactamente su celda.
    covered: dict[tuple[str, str], str] = {}
    for u in data["units"]:
        sheet, cell = u["source"]["sheet"], u["source"]["cell"]
        actual = wb[sheet][cell].value
        if not isinstance(actual, str):
            errors.append(f"{u['unitId']}: {sheet}!{cell} no es texto")
            continue
        if u["text"] != actual:
            errors.append(f"{u['unitId']}: texto distinto de {sheet}!{cell}")
        if u["authority"] != "official_curriculum" or u["release"] != release:
            errors.append(f"{u['unitId']}: autoridad o release incorrecta")
        if u["headerLiteral"] != u["source"]["header"]:
            errors.append(f"{u['unitId']}: encabezado inconsistente")
        key = (sheet, cell)
        if key in covered:
            errors.append(f"{sheet}!{cell} cubierta dos veces ({covered[key]}, {u['unitId']})")
        covered[key] = u["unitId"]

        # Encabezado real de la columna/fila coincide con el declarado.
        ws = wb[sheet]
        col = "".join(ch for ch in cell if ch.isalpha())
        if sheet == lock["malla"]["sheet"] or sheet == lock["progresion"]["sheet"]:
            header = ws[f"{col}1"].value
            if header != u["source"]["header"]:
                errors.append(f"{u['unitId']}: encabezado real '{header}' ≠ '{u['source']['header']}'")

        # 2) Segmentos: contiguos, cubren el texto, prefijos solo de etiqueta.
        segs = u.get("segments")
        if segs:
            n = utf16_len(u["text"])
            pos = 0
            for s in segs:
                if s["start"] != pos:
                    errors.append(f"{u['unitId']}: segmento {s['key']} no contiguo")
                if not (s["start"] <= s["valueStart"] <= s["valueEnd"] <= s["end"]):
                    errors.append(f"{u['unitId']}: rangos inválidos en {s['key']}")
                prefix = utf16_slice(u["text"], s["start"], s["valueStart"])
                suffix = utf16_slice(u["text"], s["valueEnd"], s["end"])
                if prefix not in ALLOWED_PREFIXES:
                    errors.append(f"{u['unitId']}: prefijo no permitido {prefix!r}")
                if suffix.strip() != "":
                    errors.append(f"{u['unitId']}: sufijo con contenido {suffix!r}")
                pos = s["end"]
            if pos != n:
                errors.append(f"{u['unitId']}: segmentos no cubren el texto completo")

    # Periodos (columna H) como atributo de la experiencia.
    for e in data["experiences"]:
        src = e["periodSource"]
        if wb[src["sheet"]][src["cell"]].value != e["periodLiteral"]:
            errors.append(f"{e['code']}: literal de periodo distinto")
        key = (src["sheet"], src["cell"])
        if key in covered:
            errors.append(f"{src['cell']} cubierta dos veces")
        covered[key] = f"{e['code']}#periodo"

    # 3) Toda celda no vacía de autoridad (excepto encabezados) está cubierta.
    header_cells = {(lock["malla"]["sheet"], f"{openpyxl.utils.get_column_letter(c)}1") for c in range(1, 34)}
    header_cells |= {(lock["progresion"]["sheet"], f"{openpyxl.utils.get_column_letter(c)}1") for c in range(1, 8)}
    header_cells |= {(lock["observaciones"]["sheet"], "A1")}
    # Etiquetas de nivel de Progresión (columna A) son literales mapeados por alias, no unidades.
    header_cells |= {(lock["progresion"]["sheet"], f"A{r}") for r in range(2, 7)}
    for sheet in lock["sheets"]:
        ws = wb[sheet]
        for row in ws.iter_rows():
            for c in row:
                if c.value is None or c.value == "":
                    continue
                key = (sheet, c.coordinate)
                if key not in covered and key not in header_cells:
                    errors.append(f"{sheet}!{c.coordinate} con contenido no cubierto por ninguna unidad")

    # 4) Conteos.
    counts = data["counts"]
    expected = {"units": 572, "experienceFields": 480, "experienceTitles": 20, "levelFields": 35, "observations": 7, "progression": 30}
    for k, v in expected.items():
        if counts.get(k) != v:
            errors.append(f"Conteo {k}: {counts.get(k)} ≠ {v}")
    if len(data["units"]) != 572:
        errors.append(f"Unidades en la lista: {len(data['units'])}")
    if [e["code"] for e in data["experiences"]] != lock["malla"]["period_codes"]:
        errors.append("Orden de experiencias distinto del lock")

    report = {"release": release, "units_checked": len(data["units"]), "cells_covered": len(covered), "errors": errors, "pass": not errors}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
