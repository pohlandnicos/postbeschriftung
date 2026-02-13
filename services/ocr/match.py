import csv
import pathlib
import re
from dataclasses import dataclass
from typing import Optional

from rapidfuzz import fuzz


ROOT = pathlib.Path(__file__).resolve().parents[2]
OBJECTS_CSV = ROOT / "data" / "objects.csv"


@dataclass
class Obj:
    object_number: str
    building_name: str
    street: str
    zip: str
    city: str
    aliases: list[str]


def load_objects() -> list[Obj]:
    objs: list[Obj] = []
    if not OBJECTS_CSV.exists():
        return objs

    with OBJECTS_CSV.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            aliases = (row.get("aliases") or "").split("|")
            aliases = [a.strip() for a in aliases if a.strip()]
            objs.append(
                Obj(
                    object_number=(row.get("object_number") or "").strip(),
                    building_name=(row.get("building_name") or "").strip(),
                    street=(row.get("street") or "").strip(),
                    zip=(row.get("zip") or "").strip(),
                    city=(row.get("city") or "").strip(),
                    aliases=aliases,
                )
            )

    return objs


def normalize(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("ß", "ss")
    # keep basic chars
    s = re.sub(r"[^a-z0-9äöü .\-/]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def match_building(candidate: str, objects: list[Obj], threshold: int = 90) -> dict:
    cand_norm = normalize(candidate)
    if not cand_norm or not objects:
        return {"object_number": None, "matched_label": None, "score": None}

    # exact contains alias
    for o in objects:
        for a in o.aliases:
            if not a:
                continue
            a_norm = normalize(a)
            if a_norm and a_norm in cand_norm:
                return {
                    "object_number": o.object_number,
                    "matched_label": a,
                    "score": 100,
                }

    best = {"object_number": None, "matched_label": None, "score": 0}

    for o in objects:
        label = f"{o.building_name} {o.street}".strip()
        score = fuzz.token_set_ratio(cand_norm, normalize(label))
        if score > (best["score"] or 0):
            best = {"object_number": o.object_number, "matched_label": label, "score": score}

    if (best["score"] or 0) >= threshold:
        return best

    return {"object_number": None, "matched_label": best["matched_label"], "score": best["score"]}
