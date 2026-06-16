import sqlite3
from fastapi import HTTPException
from pydantic import BaseModel
from typing import Optional
from app.core.database import connect
from app.core.config import settings

DB_PATH = settings.db_path

DEFAULT_CAMERAS = [
    {
        "name": "cam_test",
        "location": "Simulasi",
        "rtsp_url": None,
        "description": "Default test camera untuk pengujian WebSocket manual.",
    },
    {
        "name": "sample_k3",
        "location": "Simulasi",
        "rtsp_url": None,
        "description": "Sample video manual: tools/sample_video/sample-k3.mp4.",
    },
    {
        "name": "sample_cctv",
        "location": "Simulasi",
        "rtsp_url": None,
        "description": "Sample CCTV manual: tools/sample_video/sample-k3-cctv.mp4.",
    },
    {
        "name": "webcam_local",
        "location": "Simulasi",
        "rtsp_url": None,
        "description": "Webcam lokal via tools/stream_source.py.",
    },
]


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
    return connect(DB_PATH)


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
    ensure_default_cameras()


def ensure_default_cameras():
    with _get_conn() as conn:
        for camera in DEFAULT_CAMERAS:
            exists = conn.execute(
                "SELECT id FROM cameras WHERE name = ?",
                (camera["name"],),
            ).fetchone()
            if exists:
                continue

            conn.execute(
                """
                INSERT INTO cameras (name, location, rtsp_url, description, is_active)
                VALUES (?, ?, ?, ?, 1)
                """,
                (
                    camera["name"],
                    camera["location"],
                    camera["rtsp_url"],
                    camera["description"],
                ),
            )
        conn.commit()


def get_all_cameras() -> list[dict]:
    ensure_default_cameras()
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


def get_camera_by_name(name: str) -> Optional[dict]:
    ensure_default_cameras()
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM cameras WHERE name = ?", (name,)).fetchone()
    return dict(row) if row else None


def create_camera(data: CameraCreate) -> dict:
    name = data.name.strip()
    location = data.location.strip()
    rtsp_url = data.rtsp_url.strip() if data.rtsp_url else None
    description = data.description.strip() if data.description else None

    if not name or not location:
        raise HTTPException(status_code=400, detail="Nama dan lokasi kamera wajib diisi")

    try:
        with _get_conn() as conn:
            cur = conn.execute(
                "INSERT INTO cameras (name, location, rtsp_url, description) VALUES (?, ?, ?, ?)",
                (name, location, rtsp_url, description)
            )
            conn.commit()
            new_id = cur.lastrowid
    except sqlite3.Error as exc:
        raise HTTPException(status_code=400, detail=f"Gagal menyimpan kamera: {exc}")
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
