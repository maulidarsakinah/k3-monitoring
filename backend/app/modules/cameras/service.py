from fastapi import HTTPException

import cameras as cam_module


class CameraService:
    def __init__(self, stream_service):
        self.stream_service = stream_service

    def list(self):
        return cam_module.get_all_cameras()

    async def create(self, data):
        camera = cam_module.create_camera(data)
        await self.stream_service.refresh()
        return camera

    async def update(self, camera_id: int, data):
        camera = cam_module.update_camera(camera_id, data)
        await self.stream_service.refresh()
        return camera

    async def delete(self, camera_id: int):
        cam_module.delete_camera(camera_id)
        await self.stream_service.refresh()
        return {"message": "Kamera berhasil dihapus"}

    def stream_status(self):
        statuses = []
        for camera in cam_module.get_all_cameras():
            stream_status = self.stream_service.status.get(camera["id"], {})
            statuses.append({
                "id": camera["id"],
                "name": camera["name"],
                "has_rtsp": bool(camera.get("rtsp_url")),
                "is_active": bool(camera.get("is_active")),
                "stream_state": stream_status.get("state", "idle"),
                "stream_message": stream_status.get("message", "Belum ada stream RTSP aktif"),
                "updated_at": stream_status.get("updated_at"),
                "last_frame_at": stream_status.get("last_frame_at"),
                "last_detection_at": stream_status.get("last_detection_at"),
                "last_violation_at": stream_status.get("last_violation_at"),
            })
        return statuses

    async def restart_stream(self, camera_id: int):
        camera = cam_module.get_camera_by_id(camera_id)
        if not camera.get("rtsp_url"):
            raise HTTPException(status_code=400, detail="Kamera belum memiliki RTSP URL")
        if not camera.get("is_active"):
            raise HTTPException(status_code=400, detail="Kamera sedang nonaktif")
        await self.stream_service.restart(camera)
        return {"message": "Stream kamera direstart", "camera": camera}

