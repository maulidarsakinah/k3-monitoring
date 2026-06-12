from fastapi import APIRouter, WebSocket


router = APIRouter()


@router.websocket("/ws/camera/{camera_id}")
async def websocket_camera(websocket: WebSocket, camera_id: str):
    await websocket.app.state.stream_service.websocket_camera(websocket, camera_id)


@router.websocket("/ws/viewer/{camera_id}")
async def websocket_viewer(websocket: WebSocket, camera_id: str):
    await websocket.app.state.stream_service.websocket_viewer(websocket, camera_id)

