import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import auth
import cameras as cam_module
import rules as rule_module
from database import ViolationDatabase
from detector import APDDetector
from models import SystemStatus

from app.core.config import settings
from app.modules.auth.controller import router as auth_router
from app.modules.cameras.controller import router as cameras_router
from app.modules.cameras.service import CameraService
from app.modules.detection.controller import router as detection_router
from app.modules.detection.service import DetectionService
from app.modules.exports.controller import router as exports_router
from app.modules.exports.service import ExportService
from app.modules.rules.controller import router as rules_router
from app.modules.stats.controller import router as stats_router
from app.modules.streams.controller import router as streams_router
from app.modules.streams.service import StreamService
from app.modules.users.controller import router as users_router
from app.modules.violations.controller import router as violations_router
from app.modules.violations.repository import ViolationRepository
from app.modules.violations.service import ViolationService


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading APD detection model...")
    detector = APDDetector(model_path=settings.model_path)
    db = ViolationDatabase(settings.db_path)
    auth.init_user_table()
    cam_module.init_camera_table()
    rule_module.init_rules_table()

    violation_repository = ViolationRepository(db)
    detection_service = DetectionService(detector, db)
    stream_service = StreamService(detection_service)

    app.state.detector = detector
    app.state.db = db
    app.state.violation_repository = violation_repository
    app.state.violation_service = ViolationService(violation_repository)
    app.state.export_service = ExportService(violation_repository)
    app.state.detection_service = detection_service
    app.state.stream_service = stream_service
    app.state.camera_service = CameraService(stream_service)

    await stream_service.refresh()
    logger.info("Startup selesai.")
    yield
    await stream_service.stop()
    detection_service.executor.shutdown(wait=False, cancel_futures=True)
    logger.info("Shutting down...")


def create_app() -> FastAPI:
    app = FastAPI(
        title="APD Violation Detection API",
        description="Backend deteksi pelanggaran APD - auth, kamera, aturan, validasi, export laporan",
        version="3.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )
    app.mount("/evidence", StaticFiles(directory=str(settings.evidence_dir), check_dir=False), name="evidence")

    @app.get("/", tags=["Health"])
    async def root():
        return {"message": "APD Detection API v3 is running", "status": "ok"}

    @app.get("/status", response_model=SystemStatus, tags=["Health"])
    async def get_status(request: Request, current_user=Depends(auth.require_all)):
        detector = request.app.state.detector
        return SystemStatus(
            model_loaded=detector is not None and detector.model is not None,
            model_path=settings.model_path,
            classes=detector.class_names if detector else [],
            apd_classes=detector.apd_classes if detector else {},
        )

    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(detection_router)
    app.include_router(violations_router)
    app.include_router(exports_router)
    app.include_router(cameras_router)
    app.include_router(rules_router)
    app.include_router(stats_router)
    app.include_router(streams_router)
    return app


app = create_app()
