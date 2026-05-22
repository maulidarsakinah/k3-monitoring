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
    violations: list[str]
    detections: list[Detection]
    summary: str
    severity: str = "none"   # none / low / medium / high


class ViolationLog(BaseModel):
    id: Optional[int] = None
    camera_id: str
    timestamp: str
    violations: list[str]
    summary: str
    severity: str = "none"


class SystemStatus(BaseModel):
    model_loaded: bool
    model_path: str
    classes: list[str]
    apd_classes: dict


class PaginatedViolations(BaseModel):
    total: int
    page: int
    limit: int
    total_pages: int
    violations: list[dict]