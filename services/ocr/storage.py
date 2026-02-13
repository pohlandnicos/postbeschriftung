import os
import pathlib


BASE_DIR = pathlib.Path(__file__).resolve().parent
TMP_DIR = BASE_DIR / "tmp"


def save_temp_pdf(pdf_bytes: bytes) -> str:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    file_id = os.getenv("FORCE_FILE_ID") or __import__("uuid").uuid4().hex
    out_path = TMP_DIR / f"{file_id}.pdf"
    out_path.write_bytes(pdf_bytes)
    return file_id
