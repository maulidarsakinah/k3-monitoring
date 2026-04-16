# simulate_camera.py — jalankan ini untuk test tanpa kamera fisik
import cv2, asyncio, websockets, base64, json

async def simulate():
    cap = cv2.VideoCapture(0)  # webcam laptop
    async with websockets.connect("ws://localhost:8000/ws/camera/cam_test") as ws:
        while True:
            ret, frame = cap.read()
            _, buf = cv2.imencode(".jpg", frame)
            await ws.send(json.dumps({"image": base64.b64encode(buf).decode()}))
            result = json.loads(await ws.recv())
            print(result["summary"])
            await asyncio.sleep(0.5)  # kirim 2 frame per detik

asyncio.run(simulate())