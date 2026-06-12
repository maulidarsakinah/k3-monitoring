import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings:
    db_path: str = os.getenv("VIOLATIONS_DB_PATH", str(BASE_DIR / "violations.db"))
    model_path: str = os.getenv("APD_MODEL_PATH", str(BASE_DIR / "best.pt"))
    evidence_dir: Path = Path(os.getenv("EVIDENCE_DIR", str(BASE_DIR / "evidence")))
    log_cooldown_seconds: int = int(os.getenv("LOG_COOLDOWN_SECONDS", "10"))
    rtsp_frame_interval_seconds: float = float(os.getenv("RTSP_FRAME_INTERVAL_SECONDS", "2.0"))
    rtsp_reconnect_seconds: float = float(os.getenv("RTSP_RECONNECT_SECONDS", "5.0"))
    detection_workers: int = int(os.getenv("DETECTION_WORKERS", "2"))


settings = Settings()

