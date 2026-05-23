from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import asyncio
import base64
import json
import io
import logging
import os
import re
from datetime import datetime
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
from detector import APDDetector
from models import DetectionResult, ViolationLog, SystemStatus
from database import ViolationDatabase
import auth
import cameras as cam_module
import rules as rule_module
import export as export_module
import stats as stats_module

logger = logging.getLogger(__name__)

detector: APDDetector = None
db: ViolationDatabase = None
LOG_COOLDOWN_SECONDS = 10
RTSP_FRAME_INTERVAL_SECONDS = 2.0
RTSP_RECONNECT_SECONDS = 5.0
last_violation_log: dict[str, float] = {}
EVIDENCE_DIR = Path("evidence")
rtsp_tasks: dict[int, asyncio.Task] = {}
rtsp_status: dict[int, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector, db
    logger.info("Loading APD detection model...")
    detector = APDDetector(model_path="best.pt")
    db = ViolationDatabase()
    auth.init_user_table()
    cam_module.init_camera_table()
    rule_module.init_rules_table()
    await refresh_rtsp_streams()
    logger.info("✅ Startup selesai!")
    yield
    await stop_rtsp_streams()
    logger.info("Shutting down...")


app = FastAPI(
    title="APD Violation Detection API",
    description="Backend deteksi pelanggaran APD — auth, kamera, aturan, validasi, export laporan",
    version="3.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)
app.mount("/evidence", StaticFiles(directory=str(EVIDENCE_DIR), check_dir=False), name="evidence")


def save_evidence_image(image_bytes: bytes, camera_id: str, timestamp: str) -> str:
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    safe_camera = re.sub(r"[^a-zA-Z0-9_-]+", "_", camera_id or "camera")
    safe_timestamp = re.sub(r"[^0-9a-zA-Z_-]+", "_", timestamp or datetime.now().isoformat())
    filename = f"{safe_camera}_{safe_timestamp}.jpg"
    path = EVIDENCE_DIR / filename
    path.write_bytes(image_bytes)
    return f"/evidence/{filename}"


# ─── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/login", tags=["Auth"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login — semua role. Mengembalikan JWT token."""
    user = auth.get_user_by_username(form_data.username)
    if not user or not auth.verify_password(form_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = auth.create_access_token({"sub": user["username"], "role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "role_label": auth.ROLE_LABELS.get(user["role"], user["role"]),
    }


@app.post("/auth/register", tags=["Auth"])
async def register(payload: dict, current_user=Depends(auth.require_admin)):
    """Buat user baru — hanya admin (Tim IT)."""
    username = payload.get("username")
    password = payload.get("password")
    role = payload.get("role", "operator")
    if not username or not password:
        raise HTTPException(status_code=400, detail="username dan password wajib diisi")
    user = auth.create_user(username, password, role)
    return {"id": user["id"], "username": user["username"], "role": user["role"],
            "role_label": auth.ROLE_LABELS.get(user["role"])}


@app.post("/auth/change-password", tags=["Auth"])
async def change_password(payload: dict, current_user=Depends(auth.get_current_user)):
    old_pw = payload.get("old_password")
    new_pw = payload.get("new_password")
    user = auth.get_user_by_username(current_user["username"])
    if not auth.verify_password(old_pw, user["password"]):
        raise HTTPException(status_code=400, detail="Password lama salah")
    import sqlite3
    with sqlite3.connect("violations.db") as conn:
        conn.execute("UPDATE users SET password = ? WHERE username = ?",
                     (auth.hash_password(new_pw), current_user["username"]))
        conn.commit()
    return {"message": "Password berhasil diubah"}


@app.get("/auth/roles", tags=["Auth"])
async def get_roles():
    """Daftar role yang tersedia beserta labelnya."""
    return [{"role": k, "label": v} for k, v in auth.ROLE_LABELS.items()]


# ─── Users ─────────────────────────────────────────────────────────────────────

@app.get("/users", tags=["Users"])
async def get_users(current_user=Depends(auth.require_admin)):
    return auth.get_all_users()


@app.get("/users/me", tags=["Users"])
async def get_me(current_user=Depends(auth.get_current_user)):
    return {**current_user, "role_label": auth.ROLE_LABELS.get(current_user["role"])}


@app.put("/users/{user_id}/role", tags=["Users"])
async def update_role(user_id: int, payload: dict, current_user=Depends(auth.require_admin)):
    new_role = payload.get("role")
    if not new_role:
        raise HTTPException(status_code=400, detail="Field 'role' wajib diisi")
    return auth.update_user_role(user_id, new_role)


@app.put("/users/{user_id}", tags=["Users"])
async def update_user(user_id: int, payload: dict, current_user=Depends(auth.require_admin)):
    return auth.update_user(
        user_id,
        username=payload.get("username"),
        role=payload.get("role"),
        password=payload.get("password"),
    )


@app.delete("/users/{user_id}", tags=["Users"])
async def delete_user(user_id: int, current_user=Depends(auth.require_admin)):
    auth.delete_user(user_id)
    return {"message": "User berhasil dihapus"}


# ─── Health ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {"message": "APD Detection API v3 is running", "status": "ok"}


@app.get("/status", response_model=SystemStatus, tags=["Health"])
async def get_status(current_user=Depends(auth.require_all)):
    return SystemStatus(
        model_loaded=detector is not None and detector.model is not None,
        model_path="best.pt",
        classes=detector.class_names if detector else [],
        apd_classes=detector.apd_classes if detector else {},
    )


# ─── Detection ─────────────────────────────────────────────────────────────────

@app.post("/detect/image", response_model=DetectionResult, tags=["Detection"])
async def detect_from_image(
    file: UploadFile = File(...),
    current_user=Depends(auth.require_all)
):
    if not detector:
        raise HTTPException(status_code=503, detail="Model belum dimuat")
    contents = await file.read()
    result = detector.detect_from_bytes(contents)
    if result.has_violation:
        db.log_violation(result, save_evidence_image(contents, result.camera_id, result.timestamp))
    return result


@app.post("/detect/base64", response_model=DetectionResult, tags=["Detection"])
async def detect_from_base64(payload: dict, current_user=Depends(auth.require_all)):
    if not detector:
        raise HTTPException(status_code=503, detail="Model belum dimuat")
    image_b64 = payload.get("image")
    camera_id = payload.get("camera_id", "unknown")
    if not image_b64:
        raise HTTPException(status_code=400, detail="Field 'image' tidak ditemukan")
    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Format base64 tidak valid")
    result = detector.detect_from_bytes(image_bytes, camera_id=camera_id)
    if result.has_violation:
        db.log_violation(result, save_evidence_image(image_bytes, result.camera_id, result.timestamp))
    return result


# ─── Violations ────────────────────────────────────────────────────────────────

@app.get("/violations", tags=["Violations"])
async def get_violations(
    page: int = Query(1, ge=1, description="Nomor halaman"),
    limit: int = Query(50, ge=1, le=500, description="Jumlah data per halaman"),
    camera_id: str = None,
    start_date: str = None,
    end_date: str = None,
    status: str = Query(None, description="Filter: detected / staff_reviewed / needs_manager / approved / rejected"),
    severity: str = Query(None, description="Filter: none / low / medium / high"),
    date_range: str = Query(None, description="Shortcut: today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    """Daftar pelanggaran dengan status workflow staff/manager."""
    return db.get_violations(
        page=page,
        limit=limit,
        camera_id=camera_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
        severity=severity,
        date_range=date_range,
    )


@app.get("/violations/stats", tags=["Violations"])
async def get_violation_stats(
    start_date: str = None,
    end_date: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    """Statistik tanpa bias limit. Bisa filter tanggal."""
    return db.get_stats(
        start_date=start_date,
        end_date=end_date,
        severity=severity,
        date_range=date_range,
    )


@app.get("/violations/trend", tags=["Violations"])
async def get_violation_trend(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    """Data trend pelanggaran per tanggal untuk grafik."""
    return db.get_trend(
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        date_range=date_range,
    )


@app.get("/violations/{violation_id}", tags=["Violations"])
async def get_violation_detail(violation_id: int, current_user=Depends(auth.require_all)):
    v = db.get_violation_by_id(violation_id)
    if not v:
        raise HTTPException(status_code=404, detail="Pelanggaran tidak ditemukan")
    return v


@app.post("/violations/{violation_id}/validate", tags=["Violations"])
async def validate_violation(
    violation_id: int,
    payload: dict,
    current_user=Depends(auth.require_manager)
):
    """
    Validasi pelanggaran — hanya Manager dan Admin.
    
    Payload: {"action": "approved" | "rejected", "note": "catatan opsional"}
    """
    action = payload.get("action")
    note = payload.get("note")

    if action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="action harus 'approved' atau 'rejected'")

    v = db.get_violation_by_id(violation_id)
    if not v:
        raise HTTPException(status_code=404, detail="Pelanggaran tidak ditemukan")
    if v["status"] not in ("needs_manager", "pending"):
        raise HTTPException(status_code=400, detail=f"Pelanggaran sudah divalidasi sebelumnya: {v['status']}")

    result = db.validate_violation(violation_id, action, current_user["username"], note)
    return {
        "message": f"Pelanggaran berhasil di-{action}",
        "violation": result
    }


@app.post("/violations/{violation_id}/submit-report", tags=["Violations"])
async def submit_violation_report(
    violation_id: int,
    payload: dict,
    current_user=Depends(auth.require_all)
):
    """
    Kirim laporan pelanggaran ke Manager.

    Digunakan Staff Operasional pada kondisi tertentu untuk mengirim incident
    ke Manager. Status berubah menjadi needs_manager.
    """
    v = db.get_violation_by_id(violation_id)
    if not v:
        raise HTTPException(status_code=404, detail="Pelanggaran tidak ditemukan")
    if v["status"] not in ("detected", "pending", "staff_reviewed"):
        raise HTTPException(status_code=400, detail=f"Pelanggaran tidak bisa dikirim ke Manager: {v['status']}")

    note = payload.get("note") or "Dikirim ke Manager untuk validasi"
    result = db.submit_report(violation_id, current_user["username"], note)
    if not result:
        raise HTTPException(status_code=400, detail="Laporan gagal dikirim")
    return {
        "message": "Laporan berhasil dikirim ke Manager",
        "violation": result,
    }


@app.post("/violations/{violation_id}/staff-review", tags=["Violations"])
async def staff_review_violation(
    violation_id: int,
    payload: dict,
    current_user=Depends(auth.require_all)
):
    """
    Review internal oleh Staff Operasional.

    Dipakai untuk incident yang cukup diselesaikan di level staff dan tidak
    perlu masuk antrean validasi Manager.
    """
    v = db.get_violation_by_id(violation_id)
    if not v:
        raise HTTPException(status_code=404, detail="Pelanggaran tidak ditemukan")
    if v["status"] not in ("detected", "pending"):
        raise HTTPException(status_code=400, detail=f"Pelanggaran tidak bisa direview staff: {v['status']}")

    note = payload.get("note") or "Direview Staff Operasional"
    result = db.staff_review(violation_id, current_user["username"], note)
    if not result:
        raise HTTPException(status_code=400, detail="Review staff gagal disimpan")
    return {
        "message": "Incident berhasil ditandai selesai oleh staff",
        "violation": result,
    }


@app.delete("/violations/{violation_id}", tags=["Violations"])
async def delete_violation(
    violation_id: int,
    current_user=Depends(auth.require_hr)
):
    """Hapus satu pelanggaran — HR/CAO dan Admin."""
    if not db.delete_violation(violation_id):
        raise HTTPException(status_code=404, detail="Pelanggaran tidak ditemukan")
    return {"message": "Pelanggaran berhasil dihapus"}


@app.delete("/violations", tags=["Violations"])
async def clear_all_violations(current_user=Depends(auth.require_admin)):
    """Hapus semua log — hanya admin."""
    db.clear()
    return {"message": "Semua log pelanggaran berhasil dihapus"}


# ─── Export Laporan ────────────────────────────────────────────────────────────

def build_export_response(format: str, data: list[dict], title: str = "Laporan Pelanggaran APD") -> StreamingResponse:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if format == "csv":
        file_bytes = export_module.export_csv(data)
        filename = f"laporan_apd_{timestamp}.csv"
        media_type = "text/csv"
    elif format == "pdf":
        try:
            file_bytes = export_module.export_pdf(data, title=title)
        except ImportError:
            raise HTTPException(
                status_code=503,
                detail="Library reportlab belum terinstall. Jalankan: pip install reportlab"
            )
        filename = f"laporan_apd_{timestamp}.pdf"
        # Octet-stream keeps browser extensions such as IDM from intercepting
        # the CORS fetch before the frontend can download the blob.
        media_type = "application/octet-stream"
    else:
        raise HTTPException(status_code=400, detail="Format export harus csv atau pdf")

    return StreamingResponse(
        io.BytesIO(file_bytes),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/reports/export", tags=["Export"])
async def export_report(
    format: str = Query("pdf", description="csv / pdf"),
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    status: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_hr)
):
    """
    Export laporan lewat endpoint generik.

    Endpoint ini dipakai frontend agar download blob PDF/CSV tidak mudah
    diintersep extension browser seperti IDM.
    """
    export_format = (format or "").lower()
    data = db.get_all_for_export(start_date=start_date, end_date=end_date,
                                  camera_id=camera_id, status=status,
                                  severity=severity, date_range=date_range)
    title = "Laporan Pelanggaran APD"
    if start_date or end_date:
        title += f" ({start_date or '...'} s/d {end_date or '...'})"

    return build_export_response(export_format, data, title=title)


@app.get("/violations/export/csv", tags=["Export"])
async def export_csv(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    status: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_hr)
):
    """
    Export laporan pelanggaran ke CSV.
    Akses: HR/CAO, Manager, Admin.
    """
    data = db.get_all_for_export(start_date=start_date, end_date=end_date,
                                  camera_id=camera_id, status=status,
                                  severity=severity, date_range=date_range)
    return build_export_response("csv", data)


@app.get("/violations/export/pdf", tags=["Export"])
async def export_pdf(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    status: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_hr)
):
    """
    Export laporan pelanggaran ke PDF.
    Akses: HR/CAO, Manager, Admin.
    """
    data = db.get_all_for_export(start_date=start_date, end_date=end_date,
                                  camera_id=camera_id, status=status,
                                  severity=severity, date_range=date_range)
    title = "Laporan Pelanggaran APD"
    if start_date or end_date:
        title += f" ({start_date or '...'} s/d {end_date or '...'})"

    return build_export_response("pdf", data, title=title)


# ─── Cameras ───────────────────────────────────────────────────────────────────

@app.get("/cameras", tags=["Cameras"])
async def get_cameras(current_user=Depends(auth.require_all)):
    return cam_module.get_all_cameras()


@app.post("/cameras", tags=["Cameras"])
async def create_camera(data: cam_module.CameraCreate, current_user=Depends(auth.require_manager)):
    camera = cam_module.create_camera(data)
    await refresh_rtsp_streams()
    return camera


@app.put("/cameras/{camera_id}", tags=["Cameras"])
async def update_camera(camera_id: int, data: cam_module.CameraUpdate,
                        current_user=Depends(auth.require_manager)):
    camera = cam_module.update_camera(camera_id, data)
    await refresh_rtsp_streams()
    return camera


@app.delete("/cameras/{camera_id}", tags=["Cameras"])
async def delete_camera(camera_id: int, current_user=Depends(auth.require_admin)):
    cam_module.delete_camera(camera_id)
    await refresh_rtsp_streams()
    return {"message": "Kamera berhasil dihapus"}


@app.get("/cameras/streams/status", tags=["Cameras"])
async def get_camera_stream_status(current_user=Depends(auth.require_all)):
    cameras = cam_module.get_all_cameras()
    statuses = []
    for camera in cameras:
        stream_status = rtsp_status.get(camera["id"], {})
        statuses.append({
            "id": camera["id"],
            "name": camera["name"],
            "has_rtsp": bool(camera.get("rtsp_url")),
            "is_active": bool(camera.get("is_active")),
            "stream_state": stream_status.get("state", "idle"),
            "stream_message": stream_status.get("message", "Belum ada stream RTSP aktif"),
            "updated_at": stream_status.get("updated_at"),
            "last_frame_at": stream_status.get("last_frame_at"),
            "last_detection_at": stream_status.get("last_detection_at"),
            "last_violation_at": stream_status.get("last_violation_at"),
        })
    return statuses


@app.post("/cameras/{camera_id}/restart-stream", tags=["Cameras"])
async def restart_camera_stream(camera_id: int, current_user=Depends(auth.require_manager)):
    camera = cam_module.get_camera_by_id(camera_id)
    if not camera.get("rtsp_url"):
        raise HTTPException(status_code=400, detail="Kamera belum memiliki RTSP URL")
    if not camera.get("is_active"):
        raise HTTPException(status_code=400, detail="Kamera sedang nonaktif")

    task = rtsp_tasks.pop(camera_id, None)
    if task:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)

    rtsp_tasks[camera_id] = asyncio.create_task(rtsp_camera_loop(camera))
    rtsp_status[camera_id] = {
        "camera_id": camera["name"],
        "state": "connecting",
        "message": "Stream direstart",
        "updated_at": datetime.now().isoformat(),
    }
    return {"message": "Stream kamera direstart", "camera": camera}


# ─── Rules ─────────────────────────────────────────────────────────────────────

@app.get("/rules", tags=["Rules"])
async def get_rules(current_user=Depends(auth.require_all)):
    return rule_module.get_all_rules()


@app.get("/rules/camera/{camera_id}", tags=["Rules"])
async def get_rules_by_camera(camera_id: int, current_user=Depends(auth.require_all)):
    return rule_module.get_rules_by_camera(camera_id)


@app.post("/rules", tags=["Rules"])
async def create_rule(data: rule_module.RuleCreate, current_user=Depends(auth.require_manager)):
    return rule_module.create_rule(data)


@app.put("/rules/{rule_id}", tags=["Rules"])
async def update_rule(rule_id: int, data: rule_module.RuleUpdate,
                      current_user=Depends(auth.require_manager)):
    return rule_module.update_rule(rule_id, data)


@app.delete("/rules/{rule_id}", tags=["Rules"])
async def delete_rule(rule_id: int, current_user=Depends(auth.require_admin)):
    rule_module.delete_rule(rule_id)
    return {"message": "Rule berhasil dihapus"}


# ─── Stats Dashboard ───────────────────────────────────────────────────────────

@app.get("/stats/trend", tags=["Stats"])
async def stats_trend(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    return stats_module.get_trend(
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        date_range=date_range,
    )


@app.get("/stats/distribution", tags=["Stats"])
async def stats_distribution(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    return stats_module.get_distribution(
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        date_range=date_range,
    )


@app.get("/stats/heatmap", tags=["Stats"])
async def stats_heatmap(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    return stats_module.get_heatmap(
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        date_range=date_range,
    )


@app.get("/stats/cameras", tags=["Stats"])
async def stats_cameras(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    return stats_module.get_camera_breakdown(
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        date_range=date_range,
    )


@app.get("/stats/kpi", tags=["Stats"])
async def stats_kpi(current_user=Depends(auth.require_all)):
    return stats_module.get_kpi()


# ─── WebSocket ─────────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.camera_connections: dict[str, WebSocket] = {}
        self.viewer_connections: dict[str, set[WebSocket]] = {}

    async def connect_camera(self, websocket: WebSocket, camera_id: str):
        await websocket.accept()
        self.camera_connections[camera_id] = websocket

    def disconnect_camera(self, camera_id: str):
        self.camera_connections.pop(camera_id, None)

    async def connect_viewer(self, websocket: WebSocket, camera_id: str):
        await websocket.accept()
        self.viewer_connections.setdefault(camera_id, set()).add(websocket)

    def disconnect_viewer(self, websocket: WebSocket, camera_id: str):
        viewers = self.viewer_connections.get(camera_id)
        if not viewers:
            return
        viewers.discard(websocket)
        if not viewers:
            self.viewer_connections.pop(camera_id, None)

    async def broadcast_to_viewers(self, camera_id: str, payload: dict):
        viewers = list(self.viewer_connections.get(camera_id, set()))
        for viewer in viewers:
            try:
                await viewer.send_json(payload)
            except Exception:
                self.disconnect_viewer(viewer, camera_id)


manager = ConnectionManager()


def should_log_violation(camera_id: str, violations: list[str]) -> bool:
    key = f"{camera_id}:{','.join(sorted(violations))}"
    now = asyncio.get_running_loop().time()
    last_logged = last_violation_log.get(key, 0)
    if now - last_logged < LOG_COOLDOWN_SECONDS:
        return False
    last_violation_log[key] = now
    return True


async def process_frame_bytes(image_bytes: bytes, camera_id: str) -> dict | None:
    if not detector:
        return None

    result = await asyncio.to_thread(detector.detect_from_bytes, image_bytes, camera_id)
    image_b64 = base64.b64encode(image_bytes).decode()
    logged = False

    if result.has_violation:
        logged = should_log_violation(camera_id, result.violations)
        if logged:
            evidence_path = save_evidence_image(image_bytes, camera_id, result.timestamp)
            db.log_violation(result, evidence_path)

    return {
        "type": "detection",
        "camera_id": camera_id,
        "timestamp": result.timestamp,
        "has_violation": result.has_violation,
        "violations": result.violations,
        "severity": result.severity,
        "detections": [d.dict() for d in result.detections],
        "summary": result.summary,
        "logged": logged,
        "log_cooldown_seconds": LOG_COOLDOWN_SECONDS,
        "image": image_b64,
    }


async def rtsp_camera_loop(camera: dict):
    camera_db_id = camera["id"]
    camera_id = camera["name"]
    rtsp_url = camera.get("rtsp_url")
    os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

    while True:
        cap = None
        try:
            rtsp_status[camera_db_id] = {
                "camera_id": camera_id,
                "state": "connecting",
                "message": "Menghubungkan ke RTSP",
                "updated_at": datetime.now().isoformat(),
                "last_frame_at": None,
                "last_detection_at": None,
                "last_violation_at": None,
            }
            cap = await asyncio.to_thread(cv2.VideoCapture, rtsp_url, cv2.CAP_FFMPEG)

            if not cap or not cap.isOpened():
                raise RuntimeError("RTSP tidak bisa dibuka")

            rtsp_status[camera_db_id] = {
                "camera_id": camera_id,
                "state": "running",
                "message": "Stream aktif",
                "updated_at": datetime.now().isoformat(),
                "last_frame_at": None,
                "last_detection_at": None,
                "last_violation_at": None,
            }

            while True:
                ret, frame = await asyncio.to_thread(cap.read)
                if not ret or frame is None:
                    raise RuntimeError("Frame RTSP gagal dibaca")

                ok, buffer = await asyncio.to_thread(cv2.imencode, ".jpg", frame)
                if not ok:
                    await asyncio.sleep(RTSP_FRAME_INTERVAL_SECONDS)
                    continue

                now_iso = datetime.now().isoformat()
                current_status = rtsp_status.get(camera_db_id, {})
                rtsp_status[camera_db_id] = {
                    **current_status,
                    "state": "running",
                    "message": "Frame diterima",
                    "updated_at": now_iso,
                    "last_frame_at": now_iso,
                }

                payload = await process_frame_bytes(buffer.tobytes(), camera_id)
                if payload:
                    now_iso = datetime.now().isoformat()
                    current_status = rtsp_status.get(camera_db_id, {})
                    rtsp_status[camera_db_id] = {
                        **current_status,
                        "message": "Deteksi berjalan",
                        "updated_at": now_iso,
                        "last_detection_at": now_iso,
                        "last_violation_at": now_iso if payload.get("has_violation") else current_status.get("last_violation_at"),
                    }
                    await manager.broadcast_to_viewers(camera_id, payload)

                await asyncio.sleep(RTSP_FRAME_INTERVAL_SECONDS)

        except asyncio.CancelledError:
            rtsp_status[camera_db_id] = {
                "camera_id": camera_id,
                "state": "stopped",
                "message": "Stream dihentikan",
                "updated_at": datetime.now().isoformat(),
                "last_frame_at": rtsp_status.get(camera_db_id, {}).get("last_frame_at"),
                "last_detection_at": rtsp_status.get(camera_db_id, {}).get("last_detection_at"),
                "last_violation_at": rtsp_status.get(camera_db_id, {}).get("last_violation_at"),
            }
            raise
        except Exception as exc:
            logger.warning(f"RTSP stream error [{camera_id}]: {exc}")
            rtsp_status[camera_db_id] = {
                "camera_id": camera_id,
                "state": "error",
                "message": str(exc),
                "updated_at": datetime.now().isoformat(),
                "last_frame_at": rtsp_status.get(camera_db_id, {}).get("last_frame_at"),
                "last_detection_at": rtsp_status.get(camera_db_id, {}).get("last_detection_at"),
                "last_violation_at": rtsp_status.get(camera_db_id, {}).get("last_violation_at"),
            }
            await asyncio.sleep(RTSP_RECONNECT_SECONDS)
        finally:
            if cap:
                await asyncio.to_thread(cap.release)


async def stop_rtsp_streams():
    tasks = list(rtsp_tasks.values())
    rtsp_tasks.clear()
    for task in tasks:
        task.cancel()
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def refresh_rtsp_streams():
    cameras = cam_module.get_all_cameras()
    active_rtsp = {
        camera["id"]: camera
        for camera in cameras
        if camera.get("is_active") and camera.get("rtsp_url")
    }

    existing_tasks = list(rtsp_tasks.values())
    rtsp_tasks.clear()
    for task in existing_tasks:
        task.cancel()
    if existing_tasks:
        await asyncio.gather(*existing_tasks, return_exceptions=True)

    for camera_id, camera in active_rtsp.items():
        rtsp_tasks[camera_id] = asyncio.create_task(rtsp_camera_loop(camera))


@app.websocket("/ws/camera/{camera_id}")
async def websocket_camera(websocket: WebSocket, camera_id: str):
    await manager.connect_camera(websocket, camera_id)
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
                continue

            image_bytes = None
            if "bytes" in data and data["bytes"]:
                image_bytes = data["bytes"]
            elif "text" in data and data["text"]:
                try:
                    payload = json.loads(data["text"])
                    if "image" in payload:
                        image_bytes = base64.b64decode(payload["image"])
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": str(e)})
                    continue

            if image_bytes and detector:
                result = detector.detect_from_bytes(image_bytes, camera_id=camera_id)
                image_b64 = base64.b64encode(image_bytes).decode()
                logged = False
                if result.has_violation:
                    logged = should_log_violation(camera_id, result.violations)
                    if logged:
                        evidence_path = save_evidence_image(image_bytes, camera_id, result.timestamp)
                        db.log_violation(result, evidence_path)
                payload = {
                    "type": "detection",
                    "camera_id": camera_id,
                    "timestamp": result.timestamp,
                    "has_violation": result.has_violation,
                    "violations": result.violations,
                    "severity": result.severity,
                    "detections": [d.dict() for d in result.detections],
                    "summary": result.summary,
                    "logged": logged,
                    "log_cooldown_seconds": LOG_COOLDOWN_SECONDS,
                    "image": image_b64,
                }
                await websocket.send_json(payload)
                await manager.broadcast_to_viewers(camera_id, payload)

    except WebSocketDisconnect:
        manager.disconnect_camera(camera_id)
    except Exception as e:
        logger.error(f"WebSocket error [{camera_id}]: {e}")
        manager.disconnect_camera(camera_id)


@app.websocket("/ws/viewer/{camera_id}")
async def websocket_viewer(websocket: WebSocket, camera_id: str):
    await manager.connect_viewer(websocket, camera_id)
    try:
        await websocket.send_json({
            "type": "status",
            "camera_id": camera_id,
            "message": "Viewer connected",
        })
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping", "camera_id": camera_id})
    except WebSocketDisconnect:
        manager.disconnect_viewer(websocket, camera_id)
    except Exception as e:
        logger.error(f"Viewer WebSocket error [{camera_id}]: {e}")
        manager.disconnect_viewer(websocket, camera_id)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
