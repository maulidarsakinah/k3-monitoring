from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import asyncio
import base64
import json
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from detector import APDDetector
from models import DetectionResult, ViolationLog, SystemStatus
from database import ViolationDatabase

logger = logging.getLogger(__name__)

# Global detector instance
detector: APDDetector = None
db: ViolationDatabase = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup, cleanup on shutdown"""
    global detector, db
    logger.info("Loading APD detection model...")
    detector = APDDetector(model_path="best.pt")
    db = ViolationDatabase()
    logger.info("Model loaded successfully!")
    yield
    logger.info("Shutting down...")


app = FastAPI(
    title="APD Violation Detection API",
    description="Backend untuk deteksi pelanggaran Alat Pelindung Diri (APD) menggunakan YOLO",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ganti dengan domain frontend Anda di production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── REST Endpoints ────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {"message": "APD Detection API is running", "status": "ok"}


@app.get("/status", response_model=SystemStatus, tags=["Health"])
async def get_status():
    return SystemStatus(
        model_loaded=detector is not None and detector.model is not None,
        model_path="best.pt",
        classes=detector.class_names if detector else [],
        apd_classes=detector.apd_classes if detector else {},
    )


@app.post("/detect/image", response_model=DetectionResult, tags=["Detection"])
async def detect_from_image(file: UploadFile = File(...)):
    """
    Upload gambar dan dapatkan hasil deteksi APD.
    Mengembalikan bounding box, label, confidence, dan status pelanggaran.
    """
    if not detector:
        raise HTTPException(status_code=503, detail="Model belum dimuat")

    contents = await file.read()
    result = detector.detect_from_bytes(contents)

    # Simpan log jika ada pelanggaran
    if result.has_violation:
        db.log_violation(result)

    return result


@app.post("/detect/base64", response_model=DetectionResult, tags=["Detection"])
async def detect_from_base64(payload: dict):
    """
    Kirim frame kamera sebagai base64 string.
    Format payload: {"image": "<base64_string>", "camera_id": "cam_01"}
    """
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


@app.get("/violations", tags=["Logs"])
async def get_violations(
    limit: int = 50,
    camera_id: str = None,
    start_date: str = None,
    end_date: str = None,
):
    """Ambil log pelanggaran APD"""
    logs = db.get_violations(
        limit=limit,
        camera_id=camera_id,
        start_date=start_date,
        end_date=end_date,
    )
    return {"total": len(logs), "violations": logs}


@app.get("/violations/stats", response_model=dict, tags=["Logs"])
async def get_violation_stats():
    """Statistik pelanggaran per jenis APD"""
    return db.get_stats()


@app.delete("/violations", tags=["Logs"])
async def clear_violations():
    db.clear()
    return {"message": "Log pelanggaran berhasil dihapus"}


# ─── WebSocket untuk Live Camera Stream ───────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} terhubung. Total: {len(self.active_connections)}")

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)
        logger.info(f"Client {client_id} terputus. Total: {len(self.active_connections)}")

    async def send_json(self, client_id: str, data: dict):
        ws = self.active_connections.get(client_id)
        if ws:
            await ws.send_json(data)


manager = ConnectionManager()


@app.websocket("/ws/camera/{camera_id}")
async def websocket_camera(websocket: WebSocket, camera_id: str):
    """
    WebSocket endpoint untuk streaming deteksi real-time dari kamera.
    
    Client mengirim frame sebagai:
    - Binary: raw JPEG/PNG bytes
    - Text JSON: {"image": "<base64>"}
    
    Server membalas dengan hasil deteksi JSON.
    """
    await manager.connect(websocket, camera_id)
    try:
        while True:
            # Terima data dari client
            try:
                data = await asyncio.wait_for(websocket.receive(), timeout=30.0)
            except asyncio.TimeoutError:
                # Kirim ping agar koneksi tetap hidup
                await websocket.send_json({"type": "ping"})
                continue

            image_bytes = None

            if "bytes" in data and data["bytes"]:
                # Frame dikirim sebagai binary
                image_bytes = data["bytes"]
            elif "text" in data and data["text"]:
                # Frame dikirim sebagai JSON dengan base64
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

                # Kirim hasil deteksi ke client
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