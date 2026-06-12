import re
from datetime import datetime
from pathlib import Path

from app.core.config import settings


def save_evidence_image(image_bytes: bytes, camera_id: str, timestamp: str) -> str:
    evidence_dir: Path = settings.evidence_dir
    evidence_dir.mkdir(parents=True, exist_ok=True)
    safe_camera = re.sub(r"[^a-zA-Z0-9_-]+", "_", camera_id or "camera")
    safe_timestamp = re.sub(r"[^0-9a-zA-Z_-]+", "_", timestamp or datetime.now().isoformat())
    filename = f"{safe_camera}_{safe_timestamp}.jpg"
    path = evidence_dir / filename
    path.write_bytes(image_bytes)
    return f"/evidence/{filename}"

