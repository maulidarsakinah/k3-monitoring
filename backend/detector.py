import cv2
import numpy as np
from ultralytics import YOLO
from datetime import datetime
import logging

from models import DetectionResult, Detection

logger = logging.getLogger(__name__)

APD_CLASS_CONFIG = {
    # APD wajib dipakai
    "helmet":    {"category": "pelindung_kepala",  "required": True},
    "gloves":    {"category": "pelindung_tangan",  "required": True},
    "goggles":   {"category": "pelindung_mata",    "required": True},
    "vest":      {"category": "pelindung_tubuh",   "required": True},
    "boots":     {"category": "pelindung_kaki",    "required": True},

    # Pelanggaran langsung
    "no-helmet":  {"category": "pelindung_kepala",  "required": False, "is_violation": True},
    "no-gloves":  {"category": "pelindung_tangan",  "required": False, "is_violation": True},
    "no-goggles": {"category": "pelindung_mata",    "required": False, "is_violation": True},
    "no-vest":    {"category": "pelindung_tubuh",   "required": False, "is_violation": True},
    "no-boots":   {"category": "pelindung_kaki",    "required": False, "is_violation": True},

    # Konteks
    "person":    {"category": "person",             "required": False},
}

VIOLATION_CONFIDENCE_THRESHOLD = 0.30


class APDDetector:
    def __init__(self, model_path: str = "best.pt"):
        self.model_path = model_path
        self.model = None
        self.class_names: list[str] = []
        self.apd_classes: dict = {}
        self._load_model()

    def _load_model(self):
        try:
            self.model = YOLO(self.model_path)
            self.class_names = list(self.model.names.values())
            logger.info(f"Model loaded. Classes ({len(self.class_names)}): {self.class_names}")

            self.apd_classes = {}
            for cls_name in self.class_names:
                if cls_name in APD_CLASS_CONFIG:
                    self.apd_classes[cls_name] = APD_CLASS_CONFIG[cls_name]
                else:
                    logger.warning(f"Class '{cls_name}' tidak ada di APD_CLASS_CONFIG")
                    self.apd_classes[cls_name] = {"category": "unknown", "required": False}

            logger.info(f"APD class mapping: {self.apd_classes}")
        except Exception as e:
            logger.error(f"Gagal memuat model: {e}")
            raise

    def detect_from_bytes(self, image_bytes: bytes, camera_id: str = "unknown") -> DetectionResult:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Gagal mendekode gambar. Pastikan format JPEG/PNG valid.")
        return self.detect_from_frame(frame, camera_id=camera_id)

    def detect_from_frame(self, frame: np.ndarray, camera_id: str = "unknown") -> DetectionResult:
        results = self.model(frame, verbose=False)[0]

        detections: list[Detection] = []
        violations: list[str] = []

        for box in results.boxes:
            conf = float(box.conf[0])
            if conf < VIOLATION_CONFIDENCE_THRESHOLD:
                continue

            cls_id = int(box.cls[0])
            cls_name = self.model.names[cls_id]
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

            apd_info = self.apd_classes.get(cls_name, {})
            is_violation = apd_info.get("is_violation", False)
            category = apd_info.get("category", "unknown")

            det = Detection(
                class_name=cls_name,
                confidence=round(conf, 3),
                bbox=[x1, y1, x2, y2],
                category=category,
                is_violation=is_violation,
            )
            detections.append(det)

            if is_violation:
                label = self._violation_label(cls_name)
                if label not in violations:
                    violations.append(label)

        missing = self._check_missing_apd(detections)
        for mv in missing:
            if mv not in violations:
                violations.append(mv)

        has_violation = len(violations) > 0
        summary = self._build_summary(detections, violations)

        return DetectionResult(
            camera_id=camera_id,
            timestamp=datetime.now().isoformat(),
            has_violation=has_violation,
            violations=violations,
            detections=detections,
            summary=summary,
        )

    def _check_missing_apd(self, detections: list[Detection]) -> list[str]:
        violations = []
        detected_classes = {d.class_name for d in detections}

        any_apd_detected = any(
            d.category not in ("person", "objek", "unknown")
            for d in detections
        )
        if not any_apd_detected:
            return violations

        apd_pairs = [
            ("helmet",  "no-helmet"),
            ("gloves",  "no-gloves"),
            ("goggles", "no-goggles"),
            ("vest",    "no-vest"),
            ("boots",   "no-boots"),
        ]
        for apd_class, no_apd_class in apd_pairs:
            if apd_class not in detected_classes and no_apd_class not in detected_classes:
                violations.append(self._violation_label(no_apd_class))

        return violations

    def _violation_label(self, class_name: str) -> str:
        labels = {
            "no-helmet":  "Tidak menggunakan helm",
            "no-gloves":  "Tidak menggunakan sarung tangan",
            "no-goggles": "Tidak menggunakan kacamata pelindung",
            "no-vest":    "Tidak menggunakan rompi keselamatan",
            "no-boots":   "Tidak menggunakan sepatu keselamatan",
        }
        return labels.get(class_name, f"Pelanggaran: {class_name}")

    def _build_summary(self, detections: list[Detection], violations: list[str]) -> str:
        if not detections:
            return "Tidak ada objek terdeteksi"
        n_compliant = sum(
            1 for d in detections
            if d.category not in ("unknown", "person", "objek") and not d.is_violation
        )
        if not violations:
            return f"✅ APD Lengkap — {n_compliant} item APD terdeteksi"
        return f"⚠️ {len(violations)} pelanggaran APD: {', '.join(violations)}"