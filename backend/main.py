from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
import uvicorn
import asyncio
import base64
import json
import io
import time
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from detector import APDDetector
from models import DetectionResult, SystemStatus
from database import ViolationDatabase
import auth
import cameras as cam_module
import rules as rule_module
import export as export_module

logger = logging.getLogger(__name__)

detector: APDDetector = None
db: ViolationDatabase = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global detector, db
    detector = APDDetector(model_path="best.pt")
    db = ViolationDatabase()
    auth.init_user_table()
    cam_module.init_camera_table()
    rule_module.init_rules_table()
    logger.info("✅ Startup selesai!")
    yield


app = FastAPI(
    title="APD Violation Detection API",
    description="Backend deteksi pelanggaran APD — auth, kamera, aturan, validasi, export laporan",
    version="4.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/auth/login", tags=["Auth"])
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = auth.get_user_by_username(form_data.username)
    if not user or not auth.verify_password(form_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = auth.create_access_token({"sub": user["username"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer",
            "role": user["role"], "role_label": auth.ROLE_LABELS.get(user["role"])}


@app.post("/auth/register", tags=["Auth"])
async def register(payload: dict, current_user=Depends(auth.require_admin)):
    username = payload.get("username")
    password = payload.get("password")
    role = payload.get("role", "operator")
    if not username or not password:
        raise HTTPException(status_code=400, detail="username dan password wajib diisi")
    user = auth.create_user(username, password, role)
    return {"id": user["id"], "username": user["username"], "role": user["role"]}


@app.post("/auth/change-password", tags=["Auth"])
async def change_password(payload: dict, current_user=Depends(auth.get_current_user)):
    import sqlite3
    old_pw = payload.get("old_password")
    new_pw = payload.get("new_password")
    user = auth.get_user_by_username(current_user["username"])
    if not auth.verify_password(old_pw, user["password"]):
        raise HTTPException(status_code=400, detail="Password lama salah")
    with sqlite3.connect("violations.db") as conn:
        conn.execute("UPDATE users SET password = ? WHERE username = ?",
                     (auth.hash_password(new_pw), current_user["username"]))
        conn.commit()
    return {"message": "Password berhasil diubah"}


@app.get("/auth/roles", tags=["Auth"])
async def get_roles():
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


@app.delete("/users/{user_id}", tags=["Users"])
async def delete_user(user_id: int, current_user=Depends(auth.require_admin)):
    auth.delete_user(user_id)
    return {"message": "User berhasil dihapus"}


# ─── Health ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {"message": "APD Detection API v4 is running", "status": "ok"}


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
async def detect_from_image(file: UploadFile = File(...), current_user=Depends(auth.require_all)):
    if not detector:
        raise HTTPException(status_code=503, detail="Model belum dimuat")
    contents = await file.read()
    result = detector.detect_from_bytes(contents)
    if result.has_violation:
        db.log_violation(result)
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
        db.log_violation(result)
    return result


# ─── Violations ────────────────────────────────────────────────────────────────

@app.get("/violations", tags=["Violations"])
async def get_violations(
    page: int = Query(1, ge=1, description="Nomor halaman"),
    limit: int = Query(20, ge=1, le=100, description="Jumlah data per halaman"),
    camera_id: str = None,
    start_date: str = None,
    end_date: str = None,
    status: str = Query(None, description="pending / approved / rejected"),
    severity: str = Query(None, description="none / low / medium / high"),
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    """
    Daftar pelanggaran dengan pagination dan multi-filter.
    - page & limit untuk pagination
    - date_range: today / weekly / monthly (shortcut tanggal)
    - severity: none / low / medium / high
    - status: pending / approved / rejected
    """
    return db.get_violations(
        page=page, limit=limit,
        camera_id=camera_id, start_date=start_date, end_date=end_date,
        status=status, severity=severity, date_range=date_range
    )


@app.get("/violations/stats", tags=["Violations"])
async def get_violation_stats(
    start_date: str = None,
    end_date: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    return db.get_stats(start_date=start_date, end_date=end_date,
                        severity=severity, date_range=date_range)


@app.get("/violations/trend", tags=["Violations"])
async def get_violation_trend(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    return db.get_trend(start_date=start_date, end_date=end_date,
                        camera_id=camera_id, date_range=date_range)


@app.get("/violations/{violation_id}", tags=["Violations"])
async def get_violation_detail(violation_id: int, current_user=Depends(auth.require_all)):
    v = db.get_violation_by_id(violation_id)
    if not v:
        raise HTTPException(status_code=404, detail="Pelanggaran tidak ditemukan")
    return v


@app.post("/violations/{violation_id}/validate", tags=["Violations"])
async def validate_violation(violation_id: int, payload: dict,
                              current_user=Depends(auth.require_manager)):
    action = payload.get("action")
    note = payload.get("note")
    if action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="action harus 'approved' atau 'rejected'")
    v = db.get_violation_by_id(violation_id)
    if not v:
        raise HTTPException(status_code=404, detail="Pelanggaran tidak ditemukan")
    if v["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Sudah divalidasi: {v['status']}")
    result = db.validate_violation(violation_id, action, current_user["username"], note)
    return {"message": f"Pelanggaran berhasil di-{action}", "violation": result}


@app.delete("/violations/{violation_id}", tags=["Violations"])
async def delete_violation(violation_id: int, current_user=Depends(auth.require_hr)):
    if not db.delete_violation(violation_id):
        raise HTTPException(status_code=404, detail="Pelanggaran tidak ditemukan")
    return {"message": "Pelanggaran berhasil dihapus"}


@app.delete("/violations", tags=["Violations"])
async def clear_all_violations(current_user=Depends(auth.require_admin)):
    db.clear()
    return {"message": "Semua log pelanggaran berhasil dihapus"}


# ─── Export ────────────────────────────────────────────────────────────────────

@app.get("/violations/export/csv", tags=["Export"])
async def export_csv(
    start_date: str = None, end_date: str = None,
    camera_id: str = None, status: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_hr)
):
    data = db.get_all_for_export(start_date=start_date, end_date=end_date,
                                  camera_id=camera_id, status=status,
                                  severity=severity, date_range=date_range)
    csv_bytes = export_module.export_csv(data)
    filename = f"laporan_apd_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(io.BytesIO(csv_bytes), media_type="text/csv",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})


@app.get("/violations/export/pdf", tags=["Export"])
async def export_pdf(
    start_date: str = None, end_date: str = None,
    camera_id: str = None, status: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_hr)
):
    data = db.get_all_for_export(start_date=start_date, end_date=end_date,
                                  camera_id=camera_id, status=status,
                                  severity=severity, date_range=date_range)
    title = "Laporan Pelanggaran APD"
    try:
        pdf_bytes = export_module.export_pdf(data, title=title)
    except ImportError:
        raise HTTPException(status_code=503, detail="pip install reportlab")
    filename = f"laporan_apd_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename={filename}"})


# ─── Cameras ───────────────────────────────────────────────────────────────────

@app.get("/cameras", tags=["Cameras"])
async def get_cameras(current_user=Depends(auth.require_all)):
    return cam_module.get_all_cameras()


@app.post("/cameras", tags=["Cameras"])
async def create_camera(data: cam_module.CameraCreate, current_user=Depends(auth.require_manager)):
    return cam_module.create_camera(data)


@app.put("/cameras/{camera_id}", tags=["Cameras"])
async def update_camera(camera_id: int, data: cam_module.CameraUpdate,
                        current_user=Depends(auth.require_manager)):
    return cam_module.update_camera(camera_id, data)


@app.delete("/cameras/{camera_id}", tags=["Cameras"])
async def delete_camera(camera_id: int, current_user=Depends(auth.require_admin)):
    cam_module.delete_camera(camera_id)
    return {"message": "Kamera berhasil dihapus"}


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


# ─── WebSocket dengan cooldown & reconnect ─────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        # Cooldown: simpan timestamp terakhir notifikasi per kamera
        self._last_alert: dict[str, float] = {}
        self.COOLDOWN_SECONDS = 3  # jeda minimal antar notifikasi per kamera

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} terhubung. Total: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)
        self._last_alert.pop(client_id, None)
        logger.info(f"Client {client_id} terputus.")

    def is_cooldown_active(self, camera_id: str) -> bool:
        """Cek apakah kamera masih dalam cooldown — cegah notifikasi spam."""
        last = self._last_alert.get(camera_id, 0)
        return (time.time() - last) < self.COOLDOWN_SECONDS

    def update_cooldown(self, camera_id: str):
        self._last_alert[camera_id] = time.time()

    async def broadcast_violation(self, camera_id: str, data: dict):
        """Kirim event pelanggaran ke semua client yang terhubung."""
        dead = []
        for client_id, ws in self.active_connections.items():
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(client_id)
        for d in dead:
            self.disconnect(d)


manager = ConnectionManager()


@app.websocket("/ws/camera/{camera_id}")
async def websocket_camera(websocket: WebSocket, camera_id: str):
    """
    WebSocket real-time detection.
    - Cooldown 3 detik per kamera untuk cegah spam notifikasi
    - Broadcast pelanggaran ke semua client
    - Severity disertakan di setiap event
    """
    await manager.connect(websocket, camera_id)
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

                # Simpan ke DB dan kirim notifikasi hanya jika tidak dalam cooldown
                should_notify = True
                if result.has_violation:
                    if manager.is_cooldown_active(camera_id):
                        should_notify = False  # skip — masih cooldown
                    else:
                        db.log_violation(result)
                        manager.update_cooldown(camera_id)

                event = {
                    "type": "detection",
                    "camera_id": camera_id,
                    "timestamp": result.timestamp,
                    "has_violation": result.has_violation,
                    "violations": result.violations,
                    "severity": result.severity,
                    "detections": [d.dict() for d in result.detections],
                    "summary": result.summary,
                    "logged": result.has_violation and should_notify,
                }
                await websocket.send_json(event)

                # Broadcast ke client lain jika ada pelanggaran baru
                if result.has_violation and should_notify:
                    await manager.broadcast_violation(camera_id, {
                        **event, "type": "violation_alert"
                    })

    except WebSocketDisconnect:
        manager.disconnect(camera_id)
    except Exception as e:
        logger.error(f"WebSocket error [{camera_id}]: {e}")
        manager.disconnect(camera_id)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


# ─── Stats Dashboard ───────────────────────────────────────────────────────────
import stats as stats_module


@app.get("/stats/trend", tags=["Stats"])
async def stats_trend(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    """Line chart — jumlah pelanggaran per tanggal."""
    return stats_module.get_trend(
        start_date=start_date, end_date=end_date,
        camera_id=camera_id, date_range=date_range
    )


@app.get("/stats/distribution", tags=["Stats"])
async def stats_distribution(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    """Pie chart — distribusi jenis pelanggaran."""
    return stats_module.get_distribution(
        start_date=start_date, end_date=end_date,
        camera_id=camera_id, date_range=date_range
    )


@app.get("/stats/heatmap", tags=["Stats"])
async def stats_heatmap(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all)
):
    """Heatmap — jam rawan pelanggaran (format: {'08': 5, '09': 12, ...})."""
    return stats_module.get_heatmap(
        start_date=start_date, end_date=end_date,
        camera_id=camera_id, date_range=date_range
    )


@app.get("/stats/kpi", tags=["Stats"])
async def stats_kpi(current_user=Depends(auth.require_all)):
    """
    KPI Cards — ringkasan kondisi kepatuhan K3 real-time.
    - violations_today: total pelanggaran hari ini
    - compliance_rate: persentase pelanggaran yang sudah approved hari ini
    - pending_validation: total pelanggaran belum divalidasi (all time)
    - severity_today: breakdown severity hari ini
    - top_cameras_today: kamera dengan pelanggaran terbanyak hari ini
    """
    return stats_module.get_kpi()