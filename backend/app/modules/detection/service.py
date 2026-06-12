import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor

from database import ViolationDatabase
from detector import APDDetector
from models import DetectionResult

from app.core.config import settings
from app.shared.evidence import save_evidence_image


class DetectionService:
    def __init__(self, detector: APDDetector | None, db: ViolationDatabase):
        self.detector = detector
        self.db = db
        self.executor = ThreadPoolExecutor(max_workers=settings.detection_workers)

    def is_loaded(self) -> bool:
        return self.detector is not None and self.detector.model is not None

    async def detect_bytes(self, image_bytes: bytes, camera_id: str = "unknown") -> DetectionResult:
        if not self.detector:
            raise RuntimeError("Model belum dimuat")
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            self.executor,
            self.detector.detect_from_bytes,
            image_bytes,
            camera_id,
        )

    async def detect_and_log(self, image_bytes: bytes, camera_id: str = "unknown") -> DetectionResult:
        result = await self.detect_bytes(image_bytes, camera_id)
        if result.has_violation:
            self.db.log_violation(result, save_evidence_image(image_bytes, result.camera_id, result.timestamp))
        return result

    async def detection_payload(self, image_bytes: bytes, camera_id: str, logged: bool = False) -> dict:
        result = await self.detect_bytes(image_bytes, camera_id)
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
            "_result": result,
        }

