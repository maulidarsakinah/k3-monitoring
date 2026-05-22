const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || "ws://127.0.0.1:8000";

export const createCameraSocket = (cameraId) => {
  return new WebSocket(`${WS_BASE_URL}/ws/camera/${cameraId}`);
};

export const createViewerSocket = (cameraId) => {
  return new WebSocket(`${WS_BASE_URL}/ws/viewer/${cameraId}`);
};
