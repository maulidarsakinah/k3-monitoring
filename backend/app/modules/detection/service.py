import asyncio
import base64
from concurrent.futures import ThreadPoolExecutor

from database import ViolationDatabase
from detector import APDDetector, calculate_severity
from models import DetectionResult

import cameras as cam_module
import rules as rule_module

from app.core.config import settings
from app.shared.evidence import save_evidence_image


class DetectionService:
    def __init__(self, detector: APDDetector | None, db: ViolationDatabase):
        self.detector = detector
        self.db = db
        self.executor = ThreadPoolExecutor(
            max_workers=settings.detection_workers)
        self.last_violation_log: dict[str, float] = {}

    def should_log_violation(self, camera_id: str, violations: list[str]) -> bool:
        if not violations:
            return False

        key = f"{camera_id}:{','.join(sorted(violations))}"
        loop = asyncio.get_running_loop()
        now = loop.time()
        cooldown = max(0, settings.detect_endpoint_log_cooldown_seconds)
        last_logged = self.last_violation_log.get(key, 0)

        if cooldown and now - last_logged < cooldown:
            return False

        self.last_violation_log[key] = now
        return True

    def is_loaded(self) -> bool:
        return self.detector is not None and self.detector.model is not None

    def _copy_result(self, result: DetectionResult, **updates) -> DetectionResult:
        if hasattr(result, "model_copy"):
            return result.model_copy(update=updates)
        return result.copy(update=updates)

    def _active_rule_for_camera(self, camera_id: str) -> dict | None:
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

    def apply_camera_rule(self, result: DetectionResult) -> DetectionResult:
        rule = self._active_rule_for_camera(result.camera_id)
        if not rule:
            return result

        required_apd = set(rule.get("required_apd") or [])
        filtered_violations = [
            violation
            for violation in result.violations
            if self._apd_for_violation_label(violation) in required_apd
        ]
        filtered_detections = []

        for detection in result.detections:
            if not detection.is_violation:
                filtered_detections.append(detection)
                continue

            if self._apd_for_violation_class(detection.class_name) in required_apd:
                filtered_detections.append(detection)

        severity = calculate_severity(filtered_violations)
        if filtered_violations:
            severity_label = {
                "none": "",
                "low": "[LOW]",
                "medium": "[MEDIUM]",
                "high": "[HIGH]",
            }
            summary = f"{severity_label.get(severity, '')} {len(filtered_violations)} pelanggaran APD: {', '.join(filtered_violations)}"
        else:
            required = [
                rule_module.APD_LABELS.get(apd, apd)
                for apd in rule.get("required_apd", [])
            ]
            summary = f"Sesuai aturan APD kamera: {', '.join(required)}"

        return self._copy_result(
            result,
            has_violation=bool(filtered_violations),
            violations=filtered_violations,
            detections=filtered_detections,
            severity=severity,
            summary=summary,
        )

    async def detect_bytes(
        self,
        image_bytes: bytes,
        camera_id: str = "unknown",
        apply_rules: bool = True,
    ) -> DetectionResult:
        if not self.detector:
            raise RuntimeError("Model belum dimuat")
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            self.executor,
            self.detector.detect_from_bytes,
            image_bytes,
            camera_id,
        )
        return self.apply_camera_rule(result) if apply_rules else result

    async def detect_and_log(self, image_bytes: bytes, camera_id: str = "unknown") -> DetectionResult:
        result = await self.detect_bytes(image_bytes, camera_id)

        if result.has_violation and self.should_log_violation(result.camera_id, result.violations):
            evidence_path = save_evidence_image(
                image_bytes, result.camera_id, result.timestamp, result)
            self.db.log_violation(result, evidence_path)

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
