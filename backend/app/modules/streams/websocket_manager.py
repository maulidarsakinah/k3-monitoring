import asyncio
import logging
import json

from fastapi import WebSocket


logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.camera_connections: dict[str, WebSocket] = {}
        self.viewer_connections: dict[str, set[WebSocket]] = {}

    async def connect_camera(self, websocket: WebSocket, camera_id: str):
        previous = self.camera_connections.get(camera_id)
        if previous is not None and previous is not websocket:
            try:
                await previous.close(code=1000, reason="Replaced by new camera connection")
            except Exception:
                pass
            logger.info("Camera connection replaced [%s]", camera_id)
        await websocket.accept()
        self.camera_connections[camera_id] = websocket

    def disconnect_camera(self, camera_id: str, websocket: WebSocket | None = None):
        if websocket is not None:
            current = self.camera_connections.get(camera_id)
            if current is not websocket:
                return
        self.camera_connections.pop(camera_id, None)

    async def connect_viewer(self, websocket: WebSocket, camera_id: str):
        await websocket.accept()
        self.viewer_connections.setdefault(camera_id, set()).add(websocket)

    def disconnect_viewer(self, websocket: WebSocket, camera_id: str):
        viewers = self.viewer_connections.get(camera_id)
        if not viewers:
            return
        viewers.discard(websocket)
        if not viewers:
            self.viewer_connections.pop(camera_id, None)

    def viewer_count(self, camera_id: str) -> int:
        return len(self.viewer_connections.get(camera_id, set()))

    async def broadcast_to_viewers(self, camera_id: str, payload: dict, timeout: float = 0.75):
        viewers = list(self.viewer_connections.get(camera_id, set()))
        if not viewers:
            return

        try:
            message = json.dumps(payload, separators=(",", ":"))
        except Exception:
            logger.exception("Failed to serialize viewer payload [%s]", camera_id)
            return

        async def send(viewer: WebSocket):
            try:
                await asyncio.wait_for(viewer.send_text(message), timeout=timeout)
            except Exception as exc:
                logger.warning("Viewer send failed [%s]: %s", camera_id, exc)
                self.disconnect_viewer(viewer, camera_id)

        await asyncio.gather(*(send(viewer) for viewer in viewers))
