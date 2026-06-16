import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings:
    base_dir: Path = BASE_DIR

    db_path: str = os.getenv("VIOLATIONS_DB_PATH",
                             str(BASE_DIR / "violations.db"))
    model_path: str = os.getenv(
        "APD_MODEL_PATH", str(BASE_DIR / "best.pt"))
    evidence_dir: Path = Path(
        os.getenv("EVIDENCE_DIR", str(BASE_DIR / "evidence")))

    log_cooldown_seconds: int = int(os.getenv("LOG_COOLDOWN_SECONDS", "20"))
    detect_endpoint_log_cooldown_seconds: int = int(
        os.getenv("DETECT_ENDPOINT_LOG_COOLDOWN_SECONDS", str(log_cooldown_seconds)))

    incident_duplicate_window_seconds: int = int(
        os.getenv("INCIDENT_DUPLICATE_WINDOW_SECONDS", "180"))

    incident_window_minutes: int = int(
        os.getenv("INCIDENT_WINDOW_MINUTES", "3"))

    websocket_detection_interval_seconds: float = float(
        os.getenv("WEBSOCKET_DETECTION_INTERVAL_SECONDS", "0.66"))
    rtsp_frame_interval_seconds: float = float(
        os.getenv("RTSP_FRAME_INTERVAL_SECONDS", "0.5"))
    rtsp_reconnect_seconds: float = float(
        os.getenv("RTSP_RECONNECT_SECONDS", "5.0"))

    detection_workers: int = int(os.getenv("DETECTION_WORKERS", "1"))

    violation_confirm_frames: int = int(
        os.getenv("VIOLATION_CONFIRM_FRAMES", "3"))
    rtsp_violation_confirm_frames: int = int(
        os.getenv("RTSP_VIOLATION_CONFIRM_FRAMES", "6"))
    violation_confirm_seconds: float = float(
        os.getenv("VIOLATION_CONFIRM_SECONDS", "2.5"))
    rtsp_violation_confirm_seconds: float = float(
        os.getenv("RTSP_VIOLATION_CONFIRM_SECONDS", "6.0"))
    violation_clear_frames: int = int(os.getenv("VIOLATION_CLEAR_FRAMES", "2"))


settings = Settings()
