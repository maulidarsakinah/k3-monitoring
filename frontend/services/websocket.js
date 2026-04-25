export const createCameraSocket = (cameraId) => {
  return new WebSocket(`ws://127.0.0.1:8000/ws/camera/${cameraId}`);
};
