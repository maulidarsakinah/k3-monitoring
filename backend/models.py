from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Detection(BaseModel):
    class_name: str
    confidence: float
    bbox: list[int]          # [x1, y1, x2, y2]
    category: str
    is_violation: bool


class DetectionResult(BaseModel):
    camera_id: str
    timestamp: str
    has_violation: bool
    violations: list[str]    # Daftar nama pelanggaran APD
    detections: list[Detection]
    summary: str


class ViolationLog(BaseModel):
    id: Optional[int] = None
    camera_id: str
    timestamp: str
    violations: list[str]
    summary: str


class SystemStatus(BaseModel):
    model_loaded: bool
    model_path: str
    classes: list[str]
    apd_classes: dict