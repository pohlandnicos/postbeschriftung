import json
import pathlib
import re
from typing import Optional

from pypdf import PdfReader


ROOT = pathlib.Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"


def detect_text_layer(pdf_bytes: bytes) -> bool:
    text = extract_text(pdf_bytes)
    return len(text.strip()) > 200


def extract_text(pdf_bytes: bytes) -> str:
    try:
        reader = PdfReader(io_bytes(pdf_bytes))
    except Exception as e:
        raise ValueError(f"Cannot read PDF (maybe encrypted/corrupt): {e}")

    if reader.is_encrypted:
        raise ValueError("PDF is encrypted")

    out = []
    for page in reader.pages:
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        out.append(t)
    return "\n".join(out)


def io_bytes(b: bytes):
    import io

    return io.BytesIO(b)


_DOC_RULES = [
    (re.compile(r"\brechnung\b", re.IGNORECASE), "Rechnung", 0.9),
    (re.compile(r"\bangebot\b", re.IGNORECASE), "Angebot", 0.85),
    (re.compile(r"\blieferschein\b", re.IGNORECASE), "Lieferschein", 0.85),
]


def extract_fields(text: str) -> dict:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    head = "\n".join(lines[:30]).lower()

    doc_type = "Dokument"
    doc_conf = 0.3
    for rx, label, conf in _DOC_RULES:
        if rx.search(text):
            doc_type = label
            doc_conf = conf
            break

    vendor, vendor_conf = _extract_vendor(lines, head)
    amount, amount_conf = _extract_amount(text)
    date, date_conf = _extract_date(text)
    building_candidate, building_conf = _extract_building_candidate(lines)

    return {
        "doc_type": doc_type,
        "vendor": vendor,
        "amount": amount,
        "currency": "EUR",
        "date": date,
        "building_candidate": building_candidate,
        "confidence": {
            "doc_type": doc_conf,
            "vendor": vendor_conf,
            "amount": amount_conf,
            "building": building_conf,
        },
    }


def _extract_vendor(lines: list[str], head_lower: str) -> tuple[str, float]:
    vendor_map_path = DATA_DIR / "vendor_map.json"
    try:
        vendor_map = json.loads(vendor_map_path.read_text("utf-8"))
    except Exception:
        vendor_map = {}

    for k, v in vendor_map.items():
        if k.lower() in head_lower:
            return str(v), 0.85

    if lines:
        return lines[0][:80], 0.35
    return "UNK", 0.1


_AMOUNT_TRIGGERS = [
    r"gesamtbetrag",
    r"rechnungsbetrag",
    r"zu\s+zahlen",
]


def _parse_de_amount(s: str) -> Optional[float]:
    s = s.strip()
    s = s.replace("€", "").replace("EUR", "").strip()

    # keep digits, dots, comma, minus
    s = re.sub(r"[^0-9.,\-]", "", s)
    if not s:
        return None

    # German format: 1.234,56
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except Exception:
        return None


def _extract_amount(text: str) -> tuple[Optional[float], float]:
    candidates: list[float] = []

    for trig in _AMOUNT_TRIGGERS:
        rx = re.compile(rf"{trig}[^0-9]{{0,40}}([0-9]{{1,3}}(?:\.[0-9]{{3}})*,[0-9]{{2}})", re.IGNORECASE)
        for m in rx.finditer(text):
            v = _parse_de_amount(m.group(1))
            if v is not None:
                candidates.append(v)

    if candidates:
        # If multiple, take the last (often footer) but reduce confidence
        if len(set(candidates)) == 1:
            return candidates[-1], 0.9
        return candidates[-1], 0.6

    # fallback: pick max amount if unique
    rx_any = re.compile(r"\b([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b")
    all_vals = [_parse_de_amount(m.group(1)) for m in rx_any.finditer(text)]
    all_vals = [v for v in all_vals if v is not None]

    if not all_vals:
        return None, 0.1

    mx = max(all_vals)
    if all_vals.count(mx) == 1:
        return mx, 0.35
    return mx, 0.2


def _extract_date(text: str) -> tuple[Optional[str], float]:
    # dd.mm.yyyy
    rx1 = re.compile(r"\b(\d{2})\.(\d{2})\.(\d{4})\b")
    m = rx1.search(text)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        return f"{y}-{mo}-{d}", 0.75

    # yyyy-mm-dd
    rx2 = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
    m = rx2.search(text)
    if m:
        y, mo, d = m.group(1), m.group(2), m.group(3)
        return f"{y}-{mo}-{d}", 0.75

    return None, 0.1


_BUILDING_TRIGGERS = [
    "objekt",
    "weg",
    "liegenschaft",
    "baustelle",
    "leistungsort",
    "adresse",
]


def _extract_building_candidate(lines: list[str]) -> tuple[Optional[str], float]:
    joined = "\n".join(lines).lower()
    for idx, l in enumerate(lines):
        ll = l.lower()
        if any(t in ll for t in _BUILDING_TRIGGERS):
            chunk = [l]
            for j in range(1, 3):
                if idx + j < len(lines):
                    chunk.append(lines[idx + j])
            cand = " ".join(chunk)[:400]
            return cand, 0.55

    # nothing found
    return None, 0.15
