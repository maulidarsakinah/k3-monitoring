from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
import uvicorn
import asyncio
import base64
import json
import io
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from detector import APDDetector
from models import DetectionResult, ViolationLog, SystemStatus
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
    logger.info("Loading APD detection model...")
    detector = APDDetector(model_path="best.pt")
    db = ViolationDatabase()
    auth.init_user_table()
    cam_module.init_camera_table()
    rule_module.init_rules_table()
    logger.info("✅ Startup selesai!")
    yield
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
)


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
    limit: int = 50,
    camera_id: str = None,
    start_date: str = None,
    end_date: str = None,
    status: str = Query(None, description="Filter: pending / approved / rejected"),
    current_user=Depends(auth.require_all)
):
    """Daftar pelanggaran. Operator hanya lihat, Manager bisa filter status."""
    logs = db.get_violations(limit=limit, camera_id=camera_id,
                             start_date=start_date, end_date=end_date, status=status)
    return {"total": len(logs), "violations": logs}


@app.get("/violations/stats", tags=["Violations"])
async def get_violation_stats(
    start_date: str = None,
    end_date: str = None,
    current_user=Depends(auth.require_all)
):
    """Statistik tanpa bias limit. Bisa filter tanggal."""
    return db.get_stats(start_date=start_date, end_date=end_date)


@app.get("/violations/trend", tags=["Violations"])
async def get_violation_trend(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    current_user=Depends(auth.require_all)
):
    """Data trend pelanggaran per tanggal untuk grafik."""
    return db.get_trend(start_date=start_date, end_date=end_date, camera_id=camera_id)


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
    if v["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Pelanggaran sudah divalidasi sebelumnya: {v['status']}")

    result = db.validate_violation(violation_id, action, current_user["username"], note)
    return {
        "message": f"Pelanggaran berhasil di-{action}",
        "violation": result
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

@app.get("/violations/export/csv", tags=["Export"])
async def export_csv(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    status: str = None,
    current_user=Depends(auth.require_hr)
):
    """
    Export laporan pelanggaran ke CSV.
    Akses: HR/CAO, Manager, Admin.
    """
    data = db.get_all_for_export(start_date=start_date, end_date=end_date,
                                  camera_id=camera_id, status=status)
    csv_bytes = export_module.export_csv(data)
    filename = f"laporan_apd_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/violations/export/pdf", tags=["Export"])
async def export_pdf(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    status: str = None,
    current_user=Depends(auth.require_hr)
):
    """
    Export laporan pelanggaran ke PDF.
    Akses: HR/CAO, Manager, Admin.
    """
    data = db.get_all_for_export(start_date=start_date, end_date=end_date,
                                  camera_id=camera_id, status=status)
    title = "Laporan Pelanggaran APD"
    if start_date or end_date:
        title += f" ({start_date or '...'} s/d {end_date or '...'})"

    try:
        pdf_bytes = export_module.export_pdf(data, title=title)
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Library reportlab belum terinstall. Jalankan: pip install reportlab"
        )

    filename = f"laporan_apd_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


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


# ─── WebSocket ─────────────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)


manager = ConnectionManager()


@app.websocket("/ws/camera/{camera_id}")
async def websocket_camera(websocket: WebSocket, camera_id: str):
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
                if result.has_violation:
                    db.log_violation(result)
                await websocket.send_json({
                    "type": "detection",
                    "camera_id": camera_id,
                    "timestamp": result.timestamp,
                    "has_violation": result.has_violation,
                    "violations": result.violations,
                    "detections": [d.dict() for d in result.detections],
                    "summary": result.summary,
                })

    except WebSocketDisconnect:
        manager.disconnect(camera_id)
    except Exception as e:
        logger.error(f"WebSocket error [{camera_id}]: {e}")
        manager.disconnect(camera_id)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)