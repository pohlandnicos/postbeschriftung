import datetime as dt
import os
import pathlib

from extract import detect_text_layer, extract_text, extract_fields
from match import load_objects, match_building
from storage import save_temp_pdf
from filename import build_filename


def process_pdf_bytes(pdf_bytes: bytes) -> dict:
    if not pdf_bytes or len(pdf_bytes) < 10:
        raise ValueError("Empty PDF")

    text_exists = detect_text_layer(pdf_bytes)

    # Minimal v1: we skip generating an OCR'ed PDF file to keep transport simple.
    # Text extraction is done from the original PDF bytes.
    text = extract_text(pdf_bytes)
    fields = extract_fields(text)

    objects = load_objects()
    candidate = fields.get("building_candidate")
    building_match = match_building(candidate, objects) if candidate else {
        "object_number": None,
        "matched_label": None,
        "score": None,
    }

    fields["building_match"] = building_match

    suggested_filename = build_filename(
        {
            **fields,
            "object_number": building_match.get("object_number"),
        }
    )

    file_id = save_temp_pdf(pdf_bytes)

    return {
        "file_id": file_id,
        "doc_type": fields.get("doc_type") or "Dokument",
        "vendor": fields.get("vendor") or "UNK",
        "amount": fields.get("amount"),
        "currency": fields.get("currency") or "EUR",
        "date": fields.get("date"),
        "building_match": building_match,
        "suggested_filename": suggested_filename,
        "confidence": fields.get("confidence")
        or {"doc_type": 0.4, "vendor": 0.3, "amount": 0.3, "building": 0.3},
        "debug": {
            "text_layer": bool(text_exists),
            "text_length": len(text.strip()),
            "processed_at": dt.datetime.utcnow().isoformat() + "Z",
        },
    }
