import cv2
import numpy as np
from ultralytics import YOLO
from datetime import datetime
import logging
import os

from models import DetectionResult, Detection

logger = logging.getLogger(__name__)

APD_CLASS_CONFIG = {
    # APD wajib dipakai
    "helmet":    {"category": "pelindung_kepala",  "required": True},
    "gloves":    {"category": "pelindung_tangan",  "required": True},
    "goggles":   {"category": "pelindung_mata",    "required": True},
    "vest":      {"category": "pelindung_tubuh",   "required": True},
    "boots":     {"category": "pelindung_kaki",    "required": True},
    "safety-shoes": {"category": "pelindung_kaki", "required": True},
    "safety_shoes": {"category": "pelindung_kaki", "required": True},
    "safety shoes": {"category": "pelindung_kaki", "required": True},

    # Pelanggaran langsung
    "no-helmet":  {"category": "pelindung_kepala",  "required": False, "is_violation": True},
    "no-gloves":  {"category": "pelindung_tangan",  "required": False, "is_violation": True},
    "no-goggles": {"category": "pelindung_mata",    "required": False, "is_violation": True},
    "no-vest":    {"category": "pelindung_tubuh",   "required": False, "is_violation": True},
    "no-boots":   {"category": "pelindung_kaki",    "required": False, "is_violation": True},
    "no-safety-shoes": {"category": "pelindung_kaki", "required": False, "is_violation": True},
    "no_safety_shoes": {"category": "pelindung_kaki", "required": False, "is_violation": True},

    # Konteks
    "person":       {"category": "person",          "required": False},
}

CLASS_ALIASES = {
    "person": "person",
    "hardhat": "helmet",
    "helmet": "helmet",
    "no-hardhat": "no-helmet",
    "no_helmet": "no-helmet",
    "no-helmet": "no-helmet",
    "safety vest": "vest",
    "safety-vest": "vest",
    "safety_vest": "vest",
    "vest": "vest",
    "no-safety vest": "no-vest",
    "no-safety-vest": "no-vest",
    "no_vest": "no-vest",
    "no-vest": "no-vest",
    "gloves": "gloves",
    "glove": "gloves",
    "no-gloves": "no-gloves",
    "no_gloves": "no-gloves",
    "goggles": "goggles",
    "goggle": "goggles",
    "safety glasses": "goggles",
    "safety-glasses": "goggles",
    "safety_glasses": "goggles",
    "no-goggles": "no-goggles",
    "no_goggles": "no-goggles",
    "boots": "safety-shoes",
    "boot": "safety-shoes",
    "safety shoe": "safety-shoes",
    "safety-shoe": "safety-shoes",
    "safety shoes": "safety-shoes",
    "safety-shoes": "safety-shoes",
    "safety_shoes": "safety-shoes",
    "no-boots": "no-safety-shoes",
    "no_boots": "no-safety-shoes",
    "no-safety shoes": "no-safety-shoes",
    "no-safety-shoes": "no-safety-shoes",
    "no_safety_shoes": "no-safety-shoes",
}

DEFAULT_CONFIDENCE_THRESHOLD = float(
    os.getenv("APD_CONFIDENCE_THRESHOLD", "0.02"))
VIOLATION_CONFIDENCE_THRESHOLD = float(
    os.getenv("APD_VIOLATION_CONFIDENCE_THRESHOLD", "0.42"))
COMPLIANCE_SUPPRESS_CONFIDENCE = float(
    os.getenv("APD_COMPLIANCE_SUPPRESS_CONFIDENCE", "0.20"))
INFERENCE_IMAGE_SIZE_ENV = os.getenv("APD_IMAGE_SIZE")
INFERENCE_IOU_THRESHOLD = float(os.getenv("APD_IOU_THRESHOLD", "0.45"))
INFERENCE_MAX_DETECTIONS = int(os.getenv("APD_MAX_DETECTIONS", "30"))
INFER_MISSING_APD = os.getenv("APD_INFER_MISSING_FROM_ABSENCE", "auto").lower()
REQUIRED_APD_CLASSES_ENV = os.getenv("APD_REQUIRED_CLASSES")
ENABLE_RULE_VIOLATION_BOXES = os.getenv(
    "APD_ENABLE_RULE_VIOLATION_BOXES", "1").lower() in ("1", "true", "yes")
HIDE_UNRELIABLE_COMPLIANCE = os.getenv(
    "APD_HIDE_UNRELIABLE_COMPLIANCE", "0").lower() in ("1", "true", "yes")
REPORTABLE_COMPLIANCE_CLASSES = {
    name.strip()
    for name in os.getenv(
        "APD_REPORTABLE_COMPLIANCE_CLASSES",
        "helmet,vest,gloves,goggles,boots,safety-shoes,safety_shoes,safety shoes",
    ).split(",")
    if name.strip()
}
DISPLAY_ALLOWED_CLASSES = {
    "person",
    "helmet",
    "no-helmet",
    "vest",
    "no-vest",
    "gloves",
    "no-gloves",
    "goggles",
    "no-goggles",
    "boots",
    "no-boots",
    "safety-shoes",
    "no-safety-shoes",
}

CLASS_CONFIDENCE_THRESHOLDS = {
    "person": 0.18,
    "helmet": 0.12,
    "vest": 0.12,
    "gloves": 0.04,
    "goggles": 0.04,
    "boots": 0.10,
    "safety-shoes": 0.08,
    "safety_shoes": 0.08,
    "safety shoes": 0.08,
    "no-helmet": VIOLATION_CONFIDENCE_THRESHOLD,
    "no-vest": VIOLATION_CONFIDENCE_THRESHOLD,
    "no-gloves": VIOLATION_CONFIDENCE_THRESHOLD,
    "no-goggles": VIOLATION_CONFIDENCE_THRESHOLD,
    "no-boots": max(0.55, VIOLATION_CONFIDENCE_THRESHOLD),
    "no-safety-shoes": max(0.55, VIOLATION_CONFIDENCE_THRESHOLD),
    "no_safety_shoes": max(0.55, VIOLATION_CONFIDENCE_THRESHOLD),
}

DISPLAY_CONFIDENCE_THRESHOLDS = {
    "person": 0.10,
    "helmet": 0.05,
    "vest": 0.05,
    "gloves": 0.01,
    "goggles": 0.01,
    "boots": 0.05,
    "safety-shoes": 0.03,
    "safety_shoes": 0.03,
    "safety shoes": 0.03,
    "no-helmet": 0.08,
    "no-vest": 0.08,
    "no-gloves": 0.08,
    "no-goggles": 0.08,
    "no-boots": 0.08,
    "no-safety-shoes": 0.08,
    "no_safety_shoes": 0.08,
}

APD_PAIRS = [
    ("helmet",  "no-helmet"),
    ("gloves",  "no-gloves"),
    ("goggles", "no-goggles"),
    ("vest",    "no-vest"),
    ("safety-shoes", "no-safety-shoes"),
]

SEVERITY_LEVELS = {
    0: "none",
    1: "low",
    2: "medium",
    3: "medium",
}


def calculate_severity(violations: list[str]) -> str:
    count = len(violations)
    if count == 0:
        return "none"
    if count >= 4:
        return "high"
    return SEVERITY_LEVELS.get(count, "medium")


def normalize_class_name(class_name: str) -> str:
    normalized = str(class_name or "").strip().lower().replace("_", "-")
    normalized = " ".join(normalized.split())
    normalized = normalized.replace("no ", "no-")
    normalized = normalized.replace("no-", "no-")
    return CLASS_ALIASES.get(normalized, normalized)


def required_apd_classes() -> set[str]:
    if REQUIRED_APD_CLASSES_ENV:
        return {
            normalize_class_name(name)
            for name in REQUIRED_APD_CLASSES_ENV.split(",")
            if name.strip()
        }
    return {apd_class for apd_class, _ in APD_PAIRS}


def is_negative_class(class_name: str) -> bool:
    return str(class_name or "").startswith(("no-", "no_"))


def bbox_iou(a: list[int], b: list[int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter_w, inter_h = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter_area = inter_w * inter_h
    if inter_area == 0:
        return 0.0

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter_area
    return inter_area / union if union else 0.0


class APDDetector:
    def __init__(self, model_path: str = "best.pt"):
        self.model_path = model_path
        self.model = None
        self.class_names: list[str] = []
        self.apd_classes: dict = {}
        self.infer_missing_apd = False
        self.has_negative_classes = False
        self.model_supported_classes: set[str] = set()
        self.inference_image_size = 640
        self._load_model()

    def _load_model(self):
        try:
            self.model = YOLO(self.model_path)
            self.class_names = list(self.model.names.values())
            logger.info(
                f"Model loaded. Classes ({len(self.class_names)}): {self.class_names}")
            canonical_classes = {normalize_class_name(
                name) for name in self.class_names}
            self.model_supported_classes = canonical_classes
            self.has_negative_classes = any(
                is_negative_class(name) for name in canonical_classes)
            self.infer_missing_apd = (
                INFER_MISSING_APD in ("1", "true", "yes")
                or (INFER_MISSING_APD == "auto" and not self.has_negative_classes)
            )
            self.inference_image_size = (
                int(INFERENCE_IMAGE_SIZE_ENV)
                if INFERENCE_IMAGE_SIZE_ENV
                else (960 if self.has_negative_classes else 640)
            )
            logger.info(
                f"Infer missing APD from absence: {self.infer_missing_apd}")
            logger.info(f"Inference image size: {self.inference_image_size}")

            self.apd_classes = {}
            for cls_name in self.class_names:
                canonical_name = normalize_class_name(cls_name)
                if canonical_name in APD_CLASS_CONFIG:
                    self.apd_classes[canonical_name] = APD_CLASS_CONFIG[canonical_name]
                else:
                    logger.warning(
                        f"Class '{cls_name}' tidak ada di APD_CLASS_CONFIG")
                    self.apd_classes[canonical_name] = {
                        "category": "unknown", "required": False}

            logger.info(f"APD class mapping: {self.apd_classes}")
        except Exception as e:
            logger.error(f"Gagal memuat model: {e}")
            raise

    def detect_from_bytes(self, image_bytes: bytes, camera_id: str = "unknown") -> DetectionResult:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError(
                "Gagal mendekode gambar. Pastikan format JPEG/PNG valid.")
        return self.detect_from_frame(frame, camera_id=camera_id)

    def detect_from_frame(self, frame: np.ndarray, camera_id: str = "unknown") -> DetectionResult:
        results = self.model(
            frame,
            imgsz=self.inference_image_size,
            conf=DEFAULT_CONFIDENCE_THRESHOLD,
            iou=INFERENCE_IOU_THRESHOLD,
            max_det=INFERENCE_MAX_DETECTIONS,
            verbose=False,
        )[0]

        detections: list[Detection] = []

        for box in results.boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            raw_cls_name = self.model.names[cls_id]
            cls_name = normalize_class_name(raw_cls_name)
            if cls_name not in DISPLAY_ALLOWED_CLASSES:
                continue
            min_conf = DISPLAY_CONFIDENCE_THRESHOLDS.get(
                cls_name, DEFAULT_CONFIDENCE_THRESHOLD)
            if conf < min_conf:
                continue
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

            apd_info = self.apd_classes.get(cls_name, {})
            violation_conf = CLASS_CONFIDENCE_THRESHOLDS.get(
                cls_name, VIOLATION_CONFIDENCE_THRESHOLD)
            is_violation = apd_info.get(
                "is_violation", False) and conf >= violation_conf
            category = apd_info.get("category", "unknown")

            det = Detection(
                class_name=cls_name,
                confidence=round(conf, 3),
                bbox=[x1, y1, x2, y2],
                category=category,
                is_violation=is_violation,
            )
            detections.append(det)

        resolved_detections = self._resolve_detection_conflicts(detections)
        violations = self._violations_from_detections(resolved_detections)

        if self.infer_missing_apd:
            missing_violation_classes = self._missing_apd_violation_classes(
                resolved_detections)

            for missing_class in missing_violation_classes:
                label = self._violation_label(missing_class)
                if label not in violations:
                    violations.append(label)

        display_detections = self._filter_display_detections(
            resolved_detections)
        has_violation = len(violations) > 0
        severity = calculate_severity(violations)
        summary = self._build_summary(display_detections, violations, severity)

        return DetectionResult(
            camera_id=camera_id,
            timestamp=datetime.now().isoformat(),
            has_violation=has_violation,
            violations=violations,
            detections=display_detections,
            summary=summary,
            severity=severity,
        )

    def _resolve_detection_conflicts(self, detections: list[Detection]) -> list[Detection]:
        if not detections:
            return detections

        compliant_by_category: dict[str, list[Detection]] = {}
        for det in detections:
            if (
                not det.is_violation
                and not is_negative_class(det.class_name)
                and det.category not in ("person", "unknown", "objek", "context")
            ):
                compliant_by_category.setdefault(det.category, []).append(det)

        filtered: list[Detection] = []
        for det in detections:
            if not det.is_violation:
                filtered.append(det)
                continue

            compliant_options = compliant_by_category.get(det.category, [])
            suppress_violation = any(
                good.confidence >= COMPLIANCE_SUPPRESS_CONFIDENCE
                or good.confidence >= det.confidence * 0.45
                or bbox_iou(good.bbox, det.bbox) >= 0.05
                for good in compliant_options
            )
            if suppress_violation:
                logger.info(
                    "Suppressing conflicting violation %s %.2f because compliant APD exists in %s",
                    det.class_name,
                    det.confidence,
                    det.category,
                )
                continue

            filtered.append(det)

        return filtered

    def _filter_display_detections(self, detections: list[Detection]) -> list[Detection]:
        display: list[Detection] = []
        hidden_classes: list[str] = []
        for det in detections:
            if det.class_name not in DISPLAY_ALLOWED_CLASSES:
                hidden_classes.append(det.class_name)
                continue

            if HIDE_UNRELIABLE_COMPLIANCE:
                is_apd_compliance = (
                    not det.is_violation
                    and not is_negative_class(det.class_name)
                    and det.category not in ("person", "unknown", "objek", "context")
                )
                if is_apd_compliance and det.class_name not in REPORTABLE_COMPLIANCE_CLASSES:
                    hidden_classes.append(det.class_name)
                    continue

            display.append(det)

        if hidden_classes:
            logger.debug(
                "Hiding non-display classes from UI: %s",
                sorted(set(hidden_classes)),
            )
        return display

    def _violations_from_detections(self, detections: list[Detection]) -> list[str]:
        violations: list[str] = []
        for det in detections:
            if det.is_violation:
                label = self._violation_label(det.class_name)
                if label not in violations:
                    violations.append(label)
        return violations

    def _required_apd_classes_for_model(self) -> set[str]:
        if REQUIRED_APD_CLASSES_ENV:
            return required_apd_classes()

        supported_required = set()
        for apd_class, no_apd_class in APD_PAIRS:
            if apd_class in self.model_supported_classes or no_apd_class in self.model_supported_classes:
                supported_required.add(apd_class)

        return supported_required

    def _missing_apd_violation_classes(self, detections: list[Detection]) -> list[str]:
        missing_classes: list[str] = []
        detected_classes = {d.class_name for d in detections}

        any_apd_detected = any(
            d.category not in ("person", "objek", "unknown", "context")
            for d in detections
        )
        if not any_apd_detected:
            return missing_classes

        required_classes = self._required_apd_classes_for_model()

        for apd_class, no_apd_class in APD_PAIRS:
            if apd_class not in required_classes:
                continue

            if apd_class not in detected_classes and no_apd_class not in detected_classes:
                missing_classes.append(no_apd_class)

        return missing_classes

    def _check_missing_apd(self, detections: list[Detection]) -> list[str]:
        return [
            self._violation_label(missing_class)
            for missing_class in self._missing_apd_violation_classes(detections)
        ]

    def _violation_label(self, class_name: str) -> str:
        labels = {
            "no-helmet":  "Tidak menggunakan helm",
            "no-gloves":  "Tidak menggunakan sarung tangan",
            "no-goggles": "Tidak menggunakan kacamata pelindung",
            "no-vest":    "Tidak menggunakan rompi keselamatan",
            "no-boots":   "Tidak menggunakan sepatu keselamatan",
            "no-safety-shoes": "Tidak menggunakan sepatu keselamatan",
        }
        return labels.get(class_name, f"Pelanggaran: {class_name}")

    def _build_summary(self, detections: list[Detection], violations: list[str], severity: str) -> str:
        if not detections:
            return "Tidak ada objek terdeteksi"
        n_compliant = sum(
            1 for d in detections
            if (
                d.category not in ("unknown", "person", "objek", "context")
                and not d.is_violation
                and not is_negative_class(d.class_name)
            )
        )
        if not violations:
            if n_compliant:
                return f"APD terdeteksi tanpa pelanggaran eksplisit - {n_compliant} item APD"
            if any(is_negative_class(d.class_name) for d in detections):
                return "Kandidat pelanggaran terlihat, tetapi confidence belum cukup untuk laporan"
            return "Objek terdeteksi, pelanggaran APD belum terkonfirmasi"
        severity_label = {
            "none": "", "low": "[LOW]", "medium": "[MEDIUM]", "high": "[HIGH]"}
        return f"{severity_label.get(severity, '')} {len(violations)} pelanggaran APD: {', '.join(violations)}"
