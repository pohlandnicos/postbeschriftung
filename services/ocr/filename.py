import re
from typing import Optional


def build_filename(fields: dict) -> str:
    parts: list[str] = []

    obj = fields.get("object_number")
    if obj:
        parts.append(str(obj))

    date = fields.get("date")
    if date:
        parts.append(str(date))

    doc_type = fields.get("doc_type") or "Dokument"
    parts.append(str(doc_type))

    vendor = fields.get("vendor") or "UNK"
    parts.append(str(vendor))

    amount = fields.get("amount")
    if isinstance(amount, (int, float)):
        parts.append(f"{amount:.2f}".replace(".", ","))

    name = "_".join([p for p in parts if p])
    name = name.replace(" ", "_")
    name = re.sub(r"_+", "_", name)
    name = re.sub(r"[^a-zA-Z0-9._\-äöüÄÖÜß,]", "_", name)
    name = name.strip("_")
    if not name.lower().endswith(".pdf"):
        name = name + ".pdf"
    return name
