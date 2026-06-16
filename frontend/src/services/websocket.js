const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://127.0.0.1:8000";

const safeCameraId = (cameraId) => encodeURIComponent(cameraId || "cam_test");

export const createCameraSocket = (cameraId) => {
  return new WebSocket(`${WS_BASE_URL}/ws/camera/${safeCameraId(cameraId)}`);
};

export const createViewerSocket = (cameraId) => {
  return new WebSocket(`${WS_BASE_URL}/ws/viewer/${safeCameraId(cameraId)}`);
};
