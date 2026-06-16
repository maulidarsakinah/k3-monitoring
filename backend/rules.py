import sqlite3
import json
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.database import connect
from app.core.config import settings

DB_PATH = settings.db_path

ALL_APD = ["helmet", "vest", "safety-shoes", "goggles", "gloves"]
APD_LABELS = {
    "helmet": "Helm",
    "vest": "Vest",
    "safety-shoes": "Safety Shoes",
    "goggles": "Goggles",
    "gloves": "Gloves",
}
APD_ALIASES = {
    "helm": "helmet",
    "helmet": "helmet",
    "hardhat": "helmet",
    "vest": "vest",
    "safety vest": "vest",
    "safety-vest": "vest",
    "safety_vest": "vest",
    "rompi": "vest",
    "safety shoes": "safety-shoes",
    "safety-shoes": "safety-shoes",
    "safety_shoes": "safety-shoes",
    "shoes": "safety-shoes",
    "boots": "safety-shoes",
    "sepatu": "safety-shoes",
    "googles": "goggles",
    "goggles": "goggles",
    "google": "goggles",
    "glasses": "goggles",
    "safety glasses": "goggles",
    "gloves": "gloves",
    "glove": "gloves",
    "sarung tangan": "gloves",
}
APD_VIOLATION_LABELS = {
    "helmet": "Tidak menggunakan helm",
    "vest": "Tidak menggunakan rompi keselamatan",
    "safety-shoes": "Tidak menggunakan sepatu keselamatan",
    "goggles": "Tidak menggunakan kacamata pelindung",
    "gloves": "Tidak menggunakan sarung tangan",
}


class RuleCreate(BaseModel):
    camera_id: int
    name: str
    required_apd: list[str]
    description: Optional[str] = None


class RuleUpdate(BaseModel):
    camera_id: Optional[int] = None
    name: Optional[str] = None
    required_apd: Optional[list[str]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


def _get_conn():
    return connect(DB_PATH)


def init_rules_table():
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS rules (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id   INTEGER NOT NULL,
                name        TEXT NOT NULL,
                required_apd TEXT NOT NULL,  -- JSON array
                description TEXT,
                is_active   INTEGER DEFAULT 1,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()


def normalize_apd_name(apd: str) -> str:
    normalized = str(apd or "").strip().lower().replace("_", "-")
    normalized = " ".join(normalized.split())
    return APD_ALIASES.get(normalized, normalized)


def normalize_apd_list(apd_list: list[str]) -> list[str]:
    result = []
    for item in apd_list or []:
        normalized = normalize_apd_name(item)
        if normalized and normalized not in result:
            result.append(normalized)
    return result


def _validate_apd(apd_list: list[str]) -> list[str]:
    normalized = normalize_apd_list(apd_list)
    invalid = [a for a in normalized if a not in ALL_APD]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"APD tidak valid: {invalid}. Pilihan: {list(APD_LABELS.values())}"
        )
    return normalized


def _decode_required_apd(raw_value: str) -> list[str]:
    try:
        return normalize_apd_list(json.loads(raw_value))
    except (TypeError, json.JSONDecodeError):
        return []


def get_active_rule_by_camera(camera_id: int) -> Optional[dict]:
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            "SELECT * FROM rules WHERE camera_id = ? AND is_active = 1 ORDER BY id DESC LIMIT 1",
            (camera_id,),
        ).fetchone()
    if not row:
        return None
    rule = dict(row)
    rule["required_apd"] = _decode_required_apd(rule["required_apd"])
    return rule


def _ensure_single_rule_per_camera(camera_id: int, current_rule_id: int | None = None):
    query = "SELECT id FROM rules WHERE camera_id = ?"
    params: list[int] = [camera_id]
    if current_rule_id is not None:
        query += " AND id != ?"
        params.append(current_rule_id)

    with _get_conn() as conn:
        row = conn.execute(query, params).fetchone()
    if row:
        raise HTTPException(
            status_code=400,
            detail="Kamera ini sudah punya aturan APD. Edit aturan yang ada, bukan membuat aturan baru.",
        )


def get_all_rules() -> list[dict]:
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM rules ORDER BY id").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["required_apd"] = _decode_required_apd(d["required_apd"])
        result.append(d)
    return result


def get_rules_by_camera(camera_id: int) -> list[dict]:
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM rules WHERE camera_id = ? AND is_active = 1", (camera_id,)
        ).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["required_apd"] = _decode_required_apd(d["required_apd"])
        result.append(d)
    return result


def get_rule_by_id(rule_id: int) -> dict:
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM rules WHERE id = ?", (rule_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Rule tidak ditemukan")
    d = dict(row)
    d["required_apd"] = _decode_required_apd(d["required_apd"])
    return d


def create_rule(data: RuleCreate) -> dict:
    required_apd = _validate_apd(data.required_apd)
    _ensure_single_rule_per_camera(data.camera_id)
    with _get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO rules (camera_id, name, required_apd, description) VALUES (?, ?, ?, ?)",
            (data.camera_id, data.name, json.dumps(required_apd), data.description)
        )
        conn.commit()
        new_id = cur.lastrowid
    return get_rule_by_id(new_id)


def update_rule(rule_id: int, data: RuleUpdate) -> dict:
    current = get_rule_by_id(rule_id)
    required_apd = None
    if data.required_apd is not None:
        required_apd = _validate_apd(data.required_apd)
    if data.camera_id is not None and data.camera_id != current["camera_id"]:
        _ensure_single_rule_per_camera(data.camera_id, rule_id)
    
    fields = {}
    if data.camera_id is not None:
        fields["camera_id"] = data.camera_id
    if data.name is not None:
        fields["name"] = data.name
    if data.required_apd is not None:
        fields["required_apd"] = json.dumps(required_apd)
    if data.description is not None:
        fields["description"] = data.description
    if data.is_active is not None:
        fields["is_active"] = int(data.is_active)

    if not fields:
        raise HTTPException(status_code=400, detail="Tidak ada field yang diupdate")

    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [rule_id]
    with _get_conn() as conn:
        conn.execute(f"UPDATE rules SET {set_clause} WHERE id = ?", values)
        conn.commit()
    return get_rule_by_id(rule_id)


def delete_rule(rule_id: int):
    get_rule_by_id(rule_id)
    with _get_conn() as conn:
        conn.execute("DELETE FROM rules WHERE id = ?", (rule_id,))
        conn.commit()
