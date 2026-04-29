import sqlite3
import json
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Optional

DB_PATH = "violations.db"

ALL_APD = ["Hardhat", "Gloves", "Goggles", "Mask", "Safety Vest"]


class RuleCreate(BaseModel):
    camera_id: int
    name: str
    required_apd: list[str]  # contoh: ["Hardhat", "Safety Vest"]
    description: Optional[str] = None


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    required_apd: Optional[list[str]] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


def _get_conn():
    return sqlite3.connect(DB_PATH)


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


def _validate_apd(apd_list: list[str]):
    invalid = [a for a in apd_list if a not in ALL_APD]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"APD tidak valid: {invalid}. Pilihan: {ALL_APD}"
        )


def get_all_rules() -> list[dict]:
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM rules ORDER BY id").fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["required_apd"] = json.loads(d["required_apd"])
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
        d["required_apd"] = json.loads(d["required_apd"])
        result.append(d)
    return result


def get_rule_by_id(rule_id: int) -> dict:
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM rules WHERE id = ?", (rule_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Rule tidak ditemukan")
    d = dict(row)
    d["required_apd"] = json.loads(d["required_apd"])
    return d


def create_rule(data: RuleCreate) -> dict:
    _validate_apd(data.required_apd)
    with _get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO rules (camera_id, name, required_apd, description) VALUES (?, ?, ?, ?)",
            (data.camera_id, data.name, json.dumps(data.required_apd), data.description)
        )
        conn.commit()
        new_id = cur.lastrowid
    return get_rule_by_id(new_id)


def update_rule(rule_id: int, data: RuleUpdate) -> dict:
    get_rule_by_id(rule_id)
    if data.required_apd:
        _validate_apd(data.required_apd)
    
    fields = {}
    if data.name is not None:
        fields["name"] = data.name
    if data.required_apd is not None:
        fields["required_apd"] = json.dumps(data.required_apd)
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