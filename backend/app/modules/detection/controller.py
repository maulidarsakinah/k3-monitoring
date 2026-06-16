import base64

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

import auth
from models import DetectionResult

from app.modules.detection.service import DetectionService


router = APIRouter(tags=["Detection"])


def get_detection_service(request: Request) -> DetectionService:
    return request.app.state.detection_service


@router.post("/detect/image", response_model=DetectionResult)
async def detect_from_image(
    file: UploadFile = File(...),
    current_user=Depends(auth.require_all),
    service: DetectionService = Depends(get_detection_service),
):
    if not service.is_loaded():
        raise HTTPException(status_code=503, detail="Model belum dimuat")
    contents = await file.read()
    return await service.detect_and_log(contents)


@router.post("/detect/base64", response_model=DetectionResult)
async def detect_from_base64(
    payload: dict,
    current_user=Depends(auth.require_all),
    service: DetectionService = Depends(get_detection_service),
):
    if not service.is_loaded():
        raise HTTPException(status_code=503, detail="Model belum dimuat")
    image_b64 = payload.get("image")
    camera_id = payload.get("camera_id", "unknown")
    if not image_b64:
        raise HTTPException(status_code=400, detail="Field 'image' tidak ditemukan")
    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Format base64 tidak valid")
    return await service.detect_and_log(image_bytes, camera_id)

