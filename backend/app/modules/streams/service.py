import asyncio
import base64
import json
import logging
import os
from datetime import datetime

import cv2
from fastapi import WebSocket, WebSocketDisconnect

import cameras as cam_module
from app.core.config import settings
from app.shared.evidence import save_evidence_image
from app.modules.detection.service import DetectionService
from app.modules.streams.websocket_manager import ConnectionManager


logger = logging.getLogger(__name__)


class StreamService:
    def __init__(self, detection_service: DetectionService):
        self.detection_service = detection_service
        self.manager = ConnectionManager()
        self.tasks: dict[int, asyncio.Task] = {}
        self.status: dict[int, dict] = {}
        self.last_violation_log: dict[str, float] = {}

    def should_log_violation(self, camera_id: str, violations: list[str]) -> bool:
        key = f"{camera_id}:{','.join(sorted(violations))}"
        now = asyncio.get_running_loop().time()
        last_logged = self.last_violation_log.get(key, 0)
        if now - last_logged < settings.log_cooldown_seconds:
            return False
        self.last_violation_log[key] = now
        return True

    async def process_frame_bytes(self, image_bytes: bytes, camera_id: str) -> dict | None:
        if not self.detection_service.detector:
            return None
        result = await self.detection_service.detect_bytes(image_bytes, camera_id)
        logged = False
        if result.has_violation:
            logged = self.should_log_violation(camera_id, result.violations)
            if logged:
                evidence_path = save_evidence_image(image_bytes, camera_id, result.timestamp)
                self.detection_service.db.log_violation(result, evidence_path)
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
            "log_cooldown_seconds": settings.log_cooldown_seconds,
            "image": base64.b64encode(image_bytes).decode(),
        }

    async def rtsp_camera_loop(self, camera: dict):
        camera_db_id = camera["id"]
        camera_id = camera["name"]
        rtsp_url = camera.get("rtsp_url")
        os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")

        while True:
            cap = None
            try:
                self.status[camera_db_id] = {
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

                self.status[camera_db_id] = {
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
                        await asyncio.sleep(settings.rtsp_frame_interval_seconds)
                        continue

                    now_iso = datetime.now().isoformat()
                    current_status = self.status.get(camera_db_id, {})
                    self.status[camera_db_id] = {
                        **current_status,
                        "state": "running",
                        "message": "Frame diterima",
                        "updated_at": now_iso,
                        "last_frame_at": now_iso,
                    }

                    payload = await self.process_frame_bytes(buffer.tobytes(), camera_id)
                    if payload:
                        now_iso = datetime.now().isoformat()
                        current_status = self.status.get(camera_db_id, {})
                        self.status[camera_db_id] = {
                            **current_status,
                            "message": "Deteksi berjalan",
                            "updated_at": now_iso,
                            "last_detection_at": now_iso,
                            "last_violation_at": now_iso if payload.get("has_violation") else current_status.get("last_violation_at"),
                        }
                        await self.manager.broadcast_to_viewers(camera_id, payload)

                    await asyncio.sleep(settings.rtsp_frame_interval_seconds)

            except asyncio.CancelledError:
                self.status[camera_db_id] = {
                    "camera_id": camera_id,
                    "state": "stopped",
                    "message": "Stream dihentikan",
                    "updated_at": datetime.now().isoformat(),
                    "last_frame_at": self.status.get(camera_db_id, {}).get("last_frame_at"),
                    "last_detection_at": self.status.get(camera_db_id, {}).get("last_detection_at"),
                    "last_violation_at": self.status.get(camera_db_id, {}).get("last_violation_at"),
                }
                raise
            except Exception as exc:
                logger.warning(f"RTSP stream error [{camera_id}]: {exc}")
                self.status[camera_db_id] = {
                    "camera_id": camera_id,
                    "state": "error",
                    "message": str(exc),
                    "updated_at": datetime.now().isoformat(),
                    "last_frame_at": self.status.get(camera_db_id, {}).get("last_frame_at"),
                    "last_detection_at": self.status.get(camera_db_id, {}).get("last_detection_at"),
                    "last_violation_at": self.status.get(camera_db_id, {}).get("last_violation_at"),
                }
                await asyncio.sleep(settings.rtsp_reconnect_seconds)
            finally:
                if cap:
                    await asyncio.to_thread(cap.release)

    async def stop(self):
        tasks = list(self.tasks.values())
        self.tasks.clear()
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def refresh(self):
        cameras = cam_module.get_all_cameras()
        active_rtsp = {
            camera["id"]: camera
            for camera in cameras
            if camera.get("is_active") and camera.get("rtsp_url")
        }
        await self.stop()
        for camera_id, camera in active_rtsp.items():
            self.tasks[camera_id] = asyncio.create_task(self.rtsp_camera_loop(camera))

    async def restart(self, camera: dict):
        camera_id = camera["id"]
        task = self.tasks.pop(camera_id, None)
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        self.tasks[camera_id] = asyncio.create_task(self.rtsp_camera_loop(camera))
        self.status[camera_id] = {
            "camera_id": camera["name"],
            "state": "connecting",
            "message": "Stream direstart",
            "updated_at": datetime.now().isoformat(),
        }

    async def websocket_camera(self, websocket: WebSocket, camera_id: str):
        await self.manager.connect_camera(websocket, camera_id)
        try:
            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive(), timeout=30.0)
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "ping"})
                    continue

                image_bytes = None
                if data.get("bytes"):
                    image_bytes = data["bytes"]
                elif data.get("text"):
                    try:
                        payload = json.loads(data["text"])
                        if "image" in payload:
                            image_bytes = base64.b64decode(payload["image"])
                    except Exception as exc:
                        await websocket.send_json({"type": "error", "message": str(exc)})
                        continue

                if image_bytes and self.detection_service.detector:
                    payload = await self.process_frame_bytes(image_bytes, camera_id)
                    if payload:
                        await websocket.send_json(payload)
                        await self.manager.broadcast_to_viewers(camera_id, payload)

        except WebSocketDisconnect:
            self.manager.disconnect_camera(camera_id)
        except Exception as exc:
            logger.error(f"WebSocket error [{camera_id}]: {exc}")
            self.manager.disconnect_camera(camera_id)

    async def websocket_viewer(self, websocket: WebSocket, camera_id: str):
        await self.manager.connect_viewer(websocket, camera_id)
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
            self.manager.disconnect_viewer(websocket, camera_id)
        except Exception as exc:
            logger.error(f"Viewer WebSocket error [{camera_id}]: {exc}")
            self.manager.disconnect_viewer(websocket, camera_id)

