import asyncio
import base64
import json
import logging
import os
from datetime import datetime

import cv2
import numpy as np
from fastapi import WebSocket, WebSocketDisconnect

import cameras as cam_module
import rules as rule_module
from app.core.config import settings
from app.shared.evidence import save_evidence_image
from app.modules.detection.service import DetectionService
from app.modules.streams.websocket_manager import ConnectionManager
from models import DetectionResult
from detector import DISPLAY_ALLOWED_CLASSES, calculate_severity


logger = logging.getLogger(__name__)

VIEWER_IMAGE_MAX_WIDTH = int(os.getenv("VIEWER_IMAGE_MAX_WIDTH", "960"))
VIEWER_IMAGE_JPEG_QUALITY = int(os.getenv("VIEWER_IMAGE_JPEG_QUALITY", "82"))
VIEWER_PREVIEW_INTERVAL_SECONDS = float(
    os.getenv("VIEWER_PREVIEW_INTERVAL_SECONDS", "0.12"))
MAX_CAMERA_PAYLOAD_KB = int(os.getenv("MAX_CAMERA_PAYLOAD_KB", "4096"))
LATEST_PAYLOAD_TTL_SECONDS = float(
    os.getenv("LATEST_PAYLOAD_TTL_SECONDS", "30"))
RTSP_MAX_READ_FAILURES = int(os.getenv("RTSP_MAX_READ_FAILURES", "20"))


class StreamService:
    def __init__(self, detection_service: DetectionService):
        self.detection_service = detection_service
        self.manager = ConnectionManager()
        self.tasks: dict[int, asyncio.Task] = {}
        self.status: dict[int, dict] = {}
        self.last_violation_log: dict[str, float] = {}
        self.last_detection_at: dict[str, float] = {}
        self.stability: dict[str, dict] = {}
        self.latest_payloads: dict[str, dict] = {}
        self.latest_payload_seen_at: dict[str, float] = {}

    def _encode_viewer_image_base64(self, image_bytes: bytes) -> str:
        frame = cv2.imdecode(
            np.frombuffer(image_bytes, dtype=np.uint8),
            cv2.IMREAD_COLOR,
        )
        if frame is None:
            return base64.b64encode(image_bytes).decode()

        height, width = frame.shape[:2]
        if width > VIEWER_IMAGE_MAX_WIDTH:
            scale = VIEWER_IMAGE_MAX_WIDTH / width
            frame = cv2.resize(
                frame,
                (VIEWER_IMAGE_MAX_WIDTH, max(1, int(height * scale))),
                interpolation=cv2.INTER_AREA,
            )

        ok, buffer = cv2.imencode(
            ".jpg",
            frame,
            [int(cv2.IMWRITE_JPEG_QUALITY), VIEWER_IMAGE_JPEG_QUALITY],
        )
        if not ok:
            return base64.b64encode(image_bytes).decode()
        return base64.b64encode(buffer).decode()

    async def _viewer_image_base64(self, image_bytes: bytes) -> str:
        return await asyncio.to_thread(self._encode_viewer_image_base64, image_bytes)

    def _log_ws_camera_stats(self, camera_id: str, stats: dict):
        loop = asyncio.get_running_loop()
        now = loop.time()
        elapsed = now - stats["last_log"]
        if elapsed < 5.0:
            return
        logger.info(
            "[%s] recv=%d (%.1f/s) proc=%d (%.1f/s) det_sent=%d (%.1f/s) preview_sent=%d (%.1f/s) dropped=%d infer_avg=%.0fms process_avg=%.0fms payload_avg=%.0fKB viewers=%d",
            camera_id,
            stats["received"],
            stats["received"] / elapsed,
            stats["processed"],
            stats["processed"] / elapsed,
            stats["sent"],
            stats["sent"] / elapsed,
            stats["preview_sent"],
            stats["preview_sent"] / elapsed,
            stats["dropped"],
            stats["inference_ms_total"] / max(1, stats["processed"]),
            stats["processing_ms_total"] / max(1, stats["processed"]),
            stats["payload_kb_total"] / max(1, stats["sent"] + stats["preview_sent"]),
            self.manager.viewer_count(camera_id),
        )
        stats["received"] = 0
        stats["processed"] = 0
        stats["sent"] = 0
        stats["preview_sent"] = 0
        stats["dropped"] = 0
        stats["inference_ms_total"] = 0.0
        stats["processing_ms_total"] = 0.0
        stats["payload_kb_total"] = 0.0
        stats["last_log"] = now

    async def _decode_camera_image(self, image_base64: str, camera_id: str) -> bytes:
        encoded_size_kb = len(image_base64) / 1024
        if encoded_size_kb > MAX_CAMERA_PAYLOAD_KB:
            raise ValueError(
                f"Frame terlalu besar ({encoded_size_kb:.0f}KB > {MAX_CAMERA_PAYLOAD_KB}KB)"
            )
        return await asyncio.to_thread(base64.b64decode, image_base64)

    def _payload_size_kb(self, payload: dict) -> float:
        try:
            return len(json.dumps(payload, separators=(",", ":")).encode("utf-8")) / 1024
        except Exception:
            image = payload.get("image") or ""
            return len(image) / 1024

    async def _preview_payload(self, image_bytes: bytes, camera_id: str) -> dict:
        return {
            "type": "preview",
            "camera_id": camera_id,
            "timestamp": datetime.now().isoformat(),
            "image": await self._viewer_image_base64(image_bytes),
        }

    def _is_latest_payload_fresh(self, camera_id: str) -> bool:
        seen_at = self.latest_payload_seen_at.get(camera_id)
        if seen_at is None:
            return False
        return asyncio.get_running_loop().time() - seen_at <= LATEST_PAYLOAD_TTL_SECONDS

    def _has_live_camera_source(self, camera_id: str) -> bool:
        if camera_id in self.manager.camera_connections:
            return True
        camera = cam_module.get_camera_by_name(camera_id)
        if not camera:
            return False
        task = self.tasks.get(camera["id"])
        return task is not None and not task.done()

    async def _notify_stream_status(
        self,
        camera_id: str,
        state: str,
        message: str,
        clear_image: bool = False,
    ):
        await self.manager.broadcast_to_viewers(camera_id, {
            "type": "status",
            "camera_id": camera_id,
            "state": state,
            "message": message,
            "clear_image": clear_image,
            "timestamp": datetime.now().isoformat(),
        })

    async def _mark_stream_offline(self, camera_id: str, message: str):
        if self._has_live_camera_source(camera_id):
            await self._notify_stream_status(
                camera_id, "degraded", message, clear_image=False)
            return
        self.latest_payloads.pop(camera_id, None)
        self.latest_payload_seen_at.pop(camera_id, None)
        await self._notify_stream_status(
            camera_id, "offline", message, clear_image=True)

    async def _send_camera_detection_ack(
        self, websocket: WebSocket, payload: dict, camera_id: str
    ):
        camera_payload = {key: value for key, value in payload.items() if key != "image"}
        try:
            await websocket.send_json(camera_payload)
        except Exception as exc:
            logger.warning(
                "Camera ack send failed [%s]: %s", camera_id, exc)

    def should_log_violation(self, camera_id: str, violations: list[str]) -> bool:
        if not violations:
            return False

        key = f"{camera_id}:{','.join(sorted(violations))}"
        now = asyncio.get_running_loop().time()

        last_logged = self.last_violation_log.get(key, 0)
        if now - last_logged < settings.incident_duplicate_window_seconds:
            return False

        self.last_violation_log[key] = now
        return True

    def should_process_frame(self, camera_id: str, interval_seconds: float | None) -> bool:
        if not interval_seconds or interval_seconds <= 0:
            return True
        now = asyncio.get_running_loop().time()
        last_seen = self.last_detection_at.get(camera_id, 0)
        if now - last_seen < interval_seconds:
            return False
        self.last_detection_at[camera_id] = now
        return True

    def _copy_result(self, result: DetectionResult, **updates) -> DetectionResult:
        if hasattr(result, "model_copy"):
            return result.model_copy(update=updates)
        return result.copy(update=updates)

    def _active_rule_for_stream_camera(self, camera_id: str) -> dict | None:
        camera = cam_module.get_camera_by_name(camera_id)
        if not camera:
            return None
        return rule_module.get_active_rule_by_camera(camera["id"])

    def _apd_for_violation_label(self, label: str) -> str | None:
        for apd, violation_label in rule_module.APD_VIOLATION_LABELS.items():
            if label == violation_label:
                return apd
        return None

    def _apd_for_violation_class(self, class_name: str) -> str | None:
        mapping = {
            "no-helmet": "helmet",
            "no-vest": "vest",
            "no-boots": "safety-shoes",
            "no-safety-shoes": "safety-shoes",
            "no_safety_shoes": "safety-shoes",
            "no-goggles": "goggles",
            "no-gloves": "gloves",
        }
        return mapping.get(class_name)

    def _apd_for_detection_class(self, class_name: str) -> str | None:
        mapping = {
            "helmet": "helmet",
            "hardhat": "helmet",
            "vest": "vest",
            "safety-vest": "vest",
            "safety_vest": "vest",
            "safety vest": "vest",
            "boots": "safety-shoes",
            "safety-shoes": "safety-shoes",
            "safety_shoes": "safety-shoes",
            "safety shoes": "safety-shoes",
            "goggles": "goggles",
            "glasses": "goggles",
            "safety-glasses": "goggles",
            "safety_glasses": "goggles",
            "safety glasses": "goggles",
            "gloves": "gloves",
            "glove": "gloves",
        }
        return mapping.get(class_name)

    def _summary_for_rule_result(
        self,
        result: DetectionResult,
        violations: list[str],
        severity: str,
        rule: dict,
    ) -> str:
        if violations:
            severity_label = {
                "none": "",
                "low": "[LOW]",
                "medium": "[MEDIUM]",
                "high": "[HIGH]",
            }
            return f"{severity_label.get(severity, '')} {len(violations)} pelanggaran APD: {', '.join(violations)}"

        required = [
            rule_module.APD_LABELS.get(apd, apd)
            for apd in rule.get("required_apd", [])
        ]
        if required:
            return f"Sesuai aturan APD kamera: {', '.join(required)}"
        return result.summary

    def apply_camera_rule(self, result: DetectionResult) -> tuple[DetectionResult, dict | None]:
        rule = self._active_rule_for_stream_camera(result.camera_id)
        if not rule:
            return result, None

        required_apd = set(rule.get("required_apd") or [])
        filtered_violations = [
            violation
            for violation in result.violations
            if self._apd_for_violation_label(violation) in required_apd
        ]

        filtered_detections = []
        for detection in result.detections:
            if detection.class_name not in DISPLAY_ALLOWED_CLASSES:
                continue
            if detection.class_name == "person":
                filtered_detections.append(detection)
                continue

            if not detection.is_violation:
                detection_apd = self._apd_for_detection_class(detection.class_name)
                if detection_apd is not None and detection_apd in required_apd:
                    filtered_detections.append(detection)
                continue

            violation_apd = self._apd_for_violation_class(detection.class_name)
            if violation_apd in required_apd:
                filtered_detections.append(detection)

        severity = calculate_severity(filtered_violations)
        return self._copy_result(
            result,
            has_violation=bool(filtered_violations),
            violations=filtered_violations,
            detections=filtered_detections,
            severity=severity,
            summary=self._summary_for_rule_result(
                result,
                filtered_violations,
                severity,
                rule,
            ),
        ), {
            "id": rule.get("id"),
            "name": rule.get("name"),
            "required_apd": list(required_apd),
        }

    def stabilize_result(
        self,
        result: DetectionResult,
        confirm_frames_override: int | None = None,
        confirm_seconds_override: float | None = None,
    ) -> tuple[DetectionResult, dict]:
        state = self.stability.setdefault(result.camera_id, {
            "candidate_key": (),
            "candidate_since": None,
            "violation_streak": 0,
            "clear_streak": 0,
            "stable_result": None,
        })

        confirm_frames = max(
            1,
            confirm_frames_override
            if confirm_frames_override is not None
            else settings.violation_confirm_frames,
        )
        confirm_seconds = max(
            0.0,
            confirm_seconds_override
            if confirm_seconds_override is not None
            else settings.violation_confirm_seconds,
        )
        clear_frames = max(1, settings.violation_clear_frames)
        violation_key = tuple(sorted(result.violations or []))
        now = asyncio.get_running_loop().time()

        if result.has_violation and violation_key:
            if violation_key == state["candidate_key"]:
                state["violation_streak"] += 1
            else:
                state["candidate_key"] = violation_key
                state["candidate_since"] = now
                state["violation_streak"] = 1
            state["clear_streak"] = 0
            candidate_since = state.get("candidate_since") or now
            candidate_elapsed = now - candidate_since

            if (
                state["violation_streak"] >= confirm_frames
                and candidate_elapsed >= confirm_seconds
            ):
                state["stable_result"] = result
                return result, {
                    "state": "confirmed",
                    "violation_streak": state["violation_streak"],
                    "required_frames": confirm_frames,
                    "elapsed_seconds": round(candidate_elapsed, 1),
                    "required_seconds": confirm_seconds,
                }

            stable_result = state.get("stable_result")
            if stable_result and stable_result.has_violation:
                return stable_result, {
                    "state": "holding_previous",
                    "violation_streak": state["violation_streak"],
                    "required_frames": confirm_frames,
                    "elapsed_seconds": round(candidate_elapsed, 1),
                    "required_seconds": confirm_seconds,
                }

            return self._copy_result(
                result,
                has_violation=False,
                violations=[],
                severity="none",
                summary=(
                    f"Menunggu konfirmasi pelanggaran "
                    f"({state['violation_streak']}/{confirm_frames}, "
                    f"{candidate_elapsed:.1f}/{confirm_seconds:.1f} detik)"
                ),
            ), {
                "state": "pending",
                "violation_streak": state["violation_streak"],
                "required_frames": confirm_frames,
                "elapsed_seconds": round(candidate_elapsed, 1),
                "required_seconds": confirm_seconds,
            }

        state["clear_streak"] += 1
        state["violation_streak"] = 0
        state["candidate_key"] = ()
        state["candidate_since"] = None

        stable_result = state.get("stable_result")
        if stable_result and stable_result.has_violation and state["clear_streak"] < clear_frames:
            return stable_result, {
                "state": "holding_previous",
                "clear_streak": state["clear_streak"],
                "required_frames": clear_frames,
            }

        state["stable_result"] = result
        return result, {
            "state": "clear",
            "clear_streak": state["clear_streak"],
            "required_frames": clear_frames,
        }

    async def process_frame_bytes(
        self,
        image_bytes: bytes,
        camera_id: str,
        throttle_interval: float | None = None,
        include_image: bool = True,
        confirm_frames: int | None = None,
        confirm_seconds: float | None = None,
    ) -> dict | None:
        if not self.detection_service.detector:
            return None
        if not self.should_process_frame(camera_id, throttle_interval):
            return None

        loop = asyncio.get_running_loop()
        processing_started_at = loop.time()
        inference_started_at = loop.time()
        detected_result = await self.detection_service.detect_bytes(
            image_bytes,
            camera_id,
            apply_rules=False,
        )
        inference_ms = (loop.time() - inference_started_at) * 1000
        raw_result, active_rule = self.apply_camera_rule(detected_result)
        result, stability = self.stabilize_result(
            raw_result,
            confirm_frames_override=confirm_frames,
            confirm_seconds_override=confirm_seconds,
        )
        logged = False
        if result.has_violation and stability.get("state") == "confirmed":
            logged = self.should_log_violation(camera_id, result.violations)
            if logged:
                evidence_path = save_evidence_image(
                    image_bytes, camera_id, result.timestamp, result)
                self.detection_service.db.log_violation(result, evidence_path)
        payload = {
            "type": "detection",
            "camera_id": camera_id,
            "timestamp": result.timestamp,
            "frame_sent_at": datetime.now().isoformat(),
            "has_violation": result.has_violation,
            "violations": result.violations,
            "severity": result.severity,
            "detections": [d.dict() for d in result.detections],
            "summary": result.summary,
            "logged": logged,
            "log_cooldown_seconds": settings.log_cooldown_seconds,
            "stability": stability,
            "active_rule": active_rule,
            "raw_has_violation": detected_result.has_violation,
            "raw_violations": detected_result.violations,
        }
        if include_image:
            payload["image"] = await self._viewer_image_base64(image_bytes)

        payload["server_timing"] = {
            "inference_ms": round(inference_ms, 1),
            "processing_ms": round((loop.time() - processing_started_at) * 1000, 1),
        }

        self.latest_payloads[camera_id] = payload
        self.latest_payload_seen_at[camera_id] = loop.time()
        return payload

    async def rtsp_camera_loop(self, camera: dict):
        camera_db_id = camera["id"]
        camera_id = camera["name"]
        rtsp_url = camera.get("rtsp_url")
        os.environ.setdefault(
            "OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
        throttle_interval = settings.websocket_detection_interval_seconds

        while True:
            cap = None
            latest: dict = {"bytes": None}
            frame_ready = asyncio.Event()
            shutdown = False

            async def process_loop():
                while not shutdown:
                    await frame_ready.wait()
                    frame_ready.clear()
                    while not shutdown:
                        image_bytes = latest["bytes"]
                        if image_bytes is None:
                            break
                        latest["bytes"] = None

                        if not self.detection_service.detector:
                            break

                        if not self.should_process_frame(camera_id, throttle_interval):
                            if latest["bytes"] is not None:
                                continue
                            break

                        try:
                            payload = await self.process_frame_bytes(
                                image_bytes,
                                camera_id,
                                throttle_interval=None,
                                confirm_frames=settings.rtsp_violation_confirm_frames,
                                confirm_seconds=settings.rtsp_violation_confirm_seconds,
                            )
                            if payload:
                                now_iso = datetime.now().isoformat()
                                current_status = self.status.get(camera_db_id, {})
                                self.status[camera_db_id] = {
                                    **current_status,
                                    "state": "running",
                                    "message": "Deteksi berjalan",
                                    "updated_at": now_iso,
                                    "last_detection_at": now_iso,
                                    "last_violation_at": now_iso if payload.get("logged") else current_status.get("last_violation_at"),
                                }
                                await self.manager.broadcast_to_viewers(camera_id, payload)
                        except Exception as exc:
                            logger.warning(
                                "RTSP frame processing error [%s]: %s",
                                camera_id,
                                exc,
                            )

                        if latest["bytes"] is not None:
                            continue
                        break

            processor_task = asyncio.create_task(process_loop())

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

                read_failures = 0
                while True:
                    ret, frame = await asyncio.to_thread(cap.read)
                    if not ret or frame is None:
                        read_failures += 1
                        if read_failures >= RTSP_MAX_READ_FAILURES:
                            raise RuntimeError("Frame RTSP gagal dibaca")
                        await asyncio.sleep(0.05)
                        continue
                    read_failures = 0

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

                    latest["bytes"] = buffer.tobytes()
                    frame_ready.set()
                    await asyncio.sleep(settings.rtsp_frame_interval_seconds)

            except asyncio.CancelledError:
                await self._mark_stream_offline(camera_id, "Stream dihentikan")
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
                if camera_id not in self.manager.camera_connections:
                    await self._notify_stream_status(
                        camera_id,
                        "reconnecting",
                        str(exc),
                        clear_image=False,
                    )
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
                shutdown = True
                frame_ready.set()
                processor_task.cancel()
                await asyncio.gather(processor_task, return_exceptions=True)
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
            self.tasks[camera_id] = asyncio.create_task(
                self.rtsp_camera_loop(camera))

    async def restart(self, camera: dict):
        camera_id = camera["id"]
        task = self.tasks.pop(camera_id, None)
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        self.tasks[camera_id] = asyncio.create_task(
            self.rtsp_camera_loop(camera))
        self.status[camera_id] = {
            "camera_id": camera["name"],
            "state": "connecting",
            "message": "Stream direstart",
            "updated_at": datetime.now().isoformat(),
        }

    async def websocket_camera(self, websocket: WebSocket, camera_id: str):
        await self.manager.connect_camera(websocket, camera_id)
        loop = asyncio.get_running_loop()
        stats = {
            "received": 0,
            "processed": 0,
            "sent": 0,
            "preview_sent": 0,
            "dropped": 0,
            "inference_ms_total": 0.0,
            "processing_ms_total": 0.0,
            "payload_kb_total": 0.0,
            "last_log": loop.time(),
        }
        latest: dict = {"bytes": None, "include_image": True}
        latest_preview: dict = {"bytes": None}
        frame_ready = asyncio.Event()
        preview_ready = asyncio.Event()
        shutdown = False
        throttle_interval = settings.websocket_detection_interval_seconds

        async def preview_loop():
            last_preview_at = 0.0
            min_interval = max(0.04, VIEWER_PREVIEW_INTERVAL_SECONDS)
            while not shutdown:
                await preview_ready.wait()
                preview_ready.clear()
                while not shutdown:
                    if self.manager.viewer_count(camera_id) <= 0:
                        latest_preview["bytes"] = None
                        break

                    now = loop.time()
                    wait_seconds = min_interval - (now - last_preview_at)
                    if wait_seconds > 0:
                        await asyncio.sleep(wait_seconds)

                    image_bytes = latest_preview["bytes"]
                    if image_bytes is None:
                        break
                    latest_preview["bytes"] = None

                    try:
                        payload = await self._preview_payload(image_bytes, camera_id)
                        await self.manager.broadcast_to_viewers(camera_id, payload)
                        last_preview_at = loop.time()
                        stats["preview_sent"] += 1
                        stats["payload_kb_total"] += self._payload_size_kb(payload)
                    except Exception as exc:
                        logger.warning(
                            "Preview frame send error [%s]: %s", camera_id, exc)

                    if latest_preview["bytes"] is not None:
                        continue
                    break

        async def process_loop():
            while not shutdown:
                await frame_ready.wait()
                frame_ready.clear()
                while not shutdown:
                    image_bytes = latest["bytes"]
                    include_image = latest["include_image"]
                    if image_bytes is None:
                        break
                    latest["bytes"] = None

                    if not self.detection_service.detector:
                        break

                    if not self.should_process_frame(camera_id, throttle_interval):
                        stats["dropped"] += 1
                        if latest["bytes"] is not None:
                            continue
                        break

                    try:
                        started_at = loop.time()
                        payload = await self.process_frame_bytes(
                            image_bytes,
                            camera_id,
                            throttle_interval=None,
                            include_image=False,
                        )
                        if payload:
                            stats["processed"] += 1
                            timing = payload.get("server_timing") or {}
                            stats["inference_ms_total"] += float(timing.get("inference_ms") or 0)
                            stats["processing_ms_total"] += float(
                                timing.get("processing_ms") or ((loop.time() - started_at) * 1000)
                            )
                            stats["payload_kb_total"] += self._payload_size_kb(payload)
                            await self._send_camera_detection_ack(
                                websocket, payload, camera_id)
                            await self.manager.broadcast_to_viewers(camera_id, payload)
                            stats["sent"] += 1
                    except Exception as exc:
                        logger.warning(
                            "Frame processing error [%s]: %s", camera_id, exc)

                    if latest["bytes"] is not None:
                        continue
                    break

        processor_task = asyncio.create_task(process_loop())
        preview_task = asyncio.create_task(preview_loop())

        try:
            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive(), timeout=30.0)
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "ping"})
                    self._log_ws_camera_stats(camera_id, stats)
                    continue

                stats["received"] += 1
                image_bytes = None
                include_image = True

                if data.get("bytes"):
                    image_bytes = data["bytes"]
                elif data.get("text"):
                    try:
                        payload = json.loads(data["text"])
                        if "image" in payload:
                            image_bytes = await self._decode_camera_image(
                                payload["image"], camera_id)
                        include_image = bool(payload.get("include_image", True))
                    except Exception as exc:
                        logger.warning(
                            "Invalid camera payload [%s]: %s", camera_id, exc)
                        try:
                            await websocket.send_json(
                                {"type": "error", "message": str(exc)})
                        except Exception:
                            pass
                        self._log_ws_camera_stats(camera_id, stats)
                        continue

                if image_bytes:
                    if latest["bytes"] is not None:
                        stats["dropped"] += 1
                    latest["bytes"] = image_bytes
                    latest["include_image"] = include_image
                    frame_ready.set()
                    if include_image:
                        if latest_preview["bytes"] is not None:
                            stats["dropped"] += 1
                        latest_preview["bytes"] = image_bytes
                        preview_ready.set()

                self._log_ws_camera_stats(camera_id, stats)

        except WebSocketDisconnect:
            self.manager.disconnect_camera(camera_id, websocket)
            if self.manager.camera_connections.get(camera_id) is None:
                await self._mark_stream_offline(camera_id, "Camera sender terputus")
        except Exception as exc:
            logger.error(f"WebSocket error [{camera_id}]: {exc}")
            self.manager.disconnect_camera(camera_id, websocket)
            if self.manager.camera_connections.get(camera_id) is None:
                await self._mark_stream_offline(camera_id, str(exc))
        finally:
            shutdown = True
            frame_ready.set()
            preview_ready.set()
            processor_task.cancel()
            preview_task.cancel()
            await asyncio.gather(processor_task, preview_task, return_exceptions=True)
            self._log_ws_camera_stats(camera_id, stats)

    async def websocket_viewer(self, websocket: WebSocket, camera_id: str):

        await self.manager.connect_viewer(websocket, camera_id)

        try:
            await websocket.send_json({
                "type": "status",
                "camera_id": camera_id,
                "message": "Viewer connected",
            })

            latest_payload = self.latest_payloads.get(camera_id)
            if latest_payload and self._is_latest_payload_fresh(camera_id):
                await websocket.send_json(latest_payload)
            elif latest_payload:
                self.latest_payloads.pop(camera_id, None)
                self.latest_payload_seen_at.pop(camera_id, None)
                await websocket.send_json({
                    "type": "status",
                    "camera_id": camera_id,
                    "state": "offline",
                    "message": "Frame terakhir sudah kedaluwarsa",
                    "clear_image": True,
                })

            while True:
                try:
                    await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                except asyncio.TimeoutError:
                    await websocket.send_json({
                        "type": "ping",
                        "camera_id": camera_id,
                    })

        except WebSocketDisconnect:
            self.manager.disconnect_viewer(websocket, camera_id)

        except Exception as exc:
            logger.error(f"Viewer WebSocket error [{camera_id}]: {exc}")
            self.manager.disconnect_viewer(websocket, camera_id)
