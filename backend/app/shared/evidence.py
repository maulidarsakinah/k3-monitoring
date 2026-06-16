import re
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

from app.core.config import settings
from detector import DISPLAY_ALLOWED_CLASSES


def _is_negative_class(class_name: str) -> bool:
    return str(class_name or "").startswith(("no-", "no_", "missing-"))


def _draw_label(image, text: str, x: int, y: int, color: tuple[int, int, int]) -> None:
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.42
    thickness = 1

    (text_w, text_h), baseline = cv2.getTextSize(text, font, scale, thickness)

    y = max(text_h + 6, y)
    x = max(0, min(x, image.shape[1] - text_w - 12))

    cv2.rectangle(
        image,
        (x, y - text_h - baseline - 6),
        (x + text_w + 8, y + baseline),
        color,
        -1,
    )

    cv2.putText(
        image,
        text,
        (x + 4, y - 4),
        font,
        scale,
        (255, 255, 255),
        thickness,
        cv2.LINE_AA,
    )


def _draw_violation_panel(image, violations: list[str]) -> None:
    if not violations:
        return

    max_lines = min(len(violations), 4)
    panel_w = min(image.shape[1] - 20, 520)
    line_h = 20
    panel_h = 34 + max_lines * line_h

    x1 = 10
    y2 = image.shape[0] - 10
    y1 = max(10, y2 - panel_h)

    overlay = image.copy()

    cv2.rectangle(
        overlay,
        (x1, y1),
        (x1 + panel_w, y2),
        (20, 20, 24),
        -1,
    )

    cv2.addWeighted(overlay, 0.50, image, 0.50, 0, image)

    cv2.rectangle(
        image,
        (x1, y1),
        (x1 + panel_w, y2),
        (55, 55, 65),
        1,
    )

    cv2.putText(
        image,
        "PELANGGARAN APD",
        (x1 + 12, y1 + 22),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.48,
        (90, 120, 255),
        1,
        cv2.LINE_AA,
    )

    for idx, violation in enumerate(violations[:max_lines], start=1):
        cv2.putText(
            image,
            f"- {violation}",
            (x1 + 12, y1 + 24 + idx * line_h),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (235, 235, 240),
            1,
            cv2.LINE_AA,
        )


def annotate_evidence_image(image_bytes: bytes, result) -> bytes:
    np_arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    if image is None:
        return image_bytes

    detections = getattr(result, "detections", []) or []

    for detection in detections:
        if detection.class_name not in DISPLAY_ALLOWED_CLASSES:
            continue
        x1, y1, x2, y2 = [int(v) for v in detection.bbox]

        x1 = max(0, min(x1, image.shape[1] - 1))
        x2 = max(0, min(x2, image.shape[1] - 1))
        y1 = max(0, min(y1, image.shape[0] - 1))
        y2 = max(0, min(y2, image.shape[0] - 1))

        if x2 <= x1 or y2 <= y1:
            continue

        if detection.is_violation:
            color = (60, 80, 255)
            thickness = 2
            label = f"{detection.class_name} {int(detection.confidence * 100)}%"
        elif _is_negative_class(detection.class_name):
            color = (0, 190, 255)
            thickness = 1
            label = f"{detection.class_name} {int(detection.confidence * 100)}%"
        else:
            color = (70, 220, 120)
            thickness = 1
            label = ""

        cv2.rectangle(
            image,
            (x1, y1),
            (x2, y2),
            color,
            thickness,
        )

        # APD aman tidak diberi label agar screenshot bukti tidak penuh tulisan.
        if label:
            _draw_label(image, label, x1, y1 - 6, color)

    _draw_violation_panel(image, getattr(result, "violations", []) or [])

    ok, buffer = cv2.imencode(
        ".jpg",
        image,
        [int(cv2.IMWRITE_JPEG_QUALITY), 92],
    )

    return buffer.tobytes() if ok else image_bytes


def save_evidence_image(image_bytes: bytes, camera_id: str, timestamp: str, result=None) -> str:
    evidence_dir: Path = settings.evidence_dir
    evidence_dir.mkdir(parents=True, exist_ok=True)

    safe_camera = re.sub(r"[^a-zA-Z0-9_-]+", "_", camera_id or "camera")
    safe_timestamp = re.sub(
        r"[^0-9a-zA-Z_-]+",
        "_",
        timestamp or datetime.now().isoformat(),
    )

    filename = f"{safe_camera}_{safe_timestamp}.jpg"
    path = evidence_dir / filename

    if result is not None:
        image_bytes = annotate_evidence_image(image_bytes, result)

    path.write_bytes(image_bytes)

    return f"/evidence/{filename}"
