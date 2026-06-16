from fastapi import APIRouter, Depends, Request

import auth
import cameras as cam_module
from app.modules.cameras.service import CameraService


router = APIRouter(tags=["Cameras"])


def get_camera_service(request: Request) -> CameraService:
    return request.app.state.camera_service


@router.get("/cameras")
async def get_cameras(
    current_user=Depends(auth.require_all),
    service: CameraService = Depends(get_camera_service),
):
    return service.list()


@router.post("/cameras")
async def create_camera(
    data: cam_module.CameraCreate,
    current_user=Depends(auth.require_manager),
    service: CameraService = Depends(get_camera_service),
):
    return await service.create(data)


@router.put("/cameras/{camera_id}")
async def update_camera(
    camera_id: int,
    data: cam_module.CameraUpdate,
    current_user=Depends(auth.require_manager),
    service: CameraService = Depends(get_camera_service),
):
    return await service.update(camera_id, data)


@router.delete("/cameras/{camera_id}")
async def delete_camera(
    camera_id: int,
    current_user=Depends(auth.require_manager),
    service: CameraService = Depends(get_camera_service),
):
    return await service.delete(camera_id)


@router.get("/cameras/streams/status")
async def get_camera_stream_status(
    current_user=Depends(auth.require_all),
    service: CameraService = Depends(get_camera_service),
):
    return service.stream_status()


@router.post("/cameras/{camera_id}/restart-stream")
async def restart_camera_stream(
    camera_id: int,
    current_user=Depends(auth.require_manager),
    service: CameraService = Depends(get_camera_service),
):
    return await service.restart_stream(camera_id)

