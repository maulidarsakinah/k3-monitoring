import sqlite3
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Optional

DB_PATH = "violations.db"


class CameraCreate(BaseModel):
    name: str
    location: str
    rtsp_url: Optional[str] = None
    description: Optional[str] = None


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    rtsp_url: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


def _get_conn():
    return sqlite3.connect(DB_PATH)


def init_camera_table():
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS cameras (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                location    TEXT NOT NULL,
                rtsp_url    TEXT,
                description TEXT,
                is_active   INTEGER DEFAULT 1,
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()


def get_all_cameras() -> list[dict]:
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM cameras ORDER BY id").fetchall()
    return [dict(r) for r in rows]


def get_camera_by_id(camera_id: int) -> dict:
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Kamera tidak ditemukan")
    return dict(row)


def create_camera(data: CameraCreate) -> dict:
    with _get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO cameras (name, location, rtsp_url, description) VALUES (?, ?, ?, ?)",
            (data.name, data.location, data.rtsp_url, data.description)
        )
        conn.commit()
        new_id = cur.lastrowid
    return get_camera_by_id(new_id)


def update_camera(camera_id: int, data: CameraUpdate) -> dict:
    get_camera_by_id(camera_id)  # raise 404 kalau tidak ada
    fields = {k: v for k, v in data.dict().items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="Tidak ada field yang diupdate")
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [camera_id]
    with _get_conn() as conn:
        conn.execute(f"UPDATE cameras SET {set_clause} WHERE id = ?", values)
        conn.commit()
    return get_camera_by_id(camera_id)


def delete_camera(camera_id: int):
    get_camera_by_id(camera_id)
    with _get_conn() as conn:
        conn.execute("DELETE FROM cameras WHERE id = ?", (camera_id,))
        conn.commit()