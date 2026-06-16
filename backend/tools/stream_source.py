import argparse
import asyncio
import base64
import json
import time
from pathlib import Path
from urllib.parse import quote

import cv2
import websockets

TOOL_DIR = Path(__file__).resolve().parent
SAMPLE_VIDEO_DIR = TOOL_DIR / "sample_video"


def encode_frame_to_base64(frame, width=640, quality=76):
    h, w = frame.shape[:2]

    if w > width:
        scale = width / w
        new_w = int(w * scale)
        new_h = int(h * scale)
        frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_AREA)

    ok, buffer = cv2.imencode(
        ".jpg",
        frame,
        [int(cv2.IMWRITE_JPEG_QUALITY), quality],
    )

    if not ok:
        return None

    return base64.b64encode(buffer).decode("utf-8")


def parse_source(source: str):
    if source.isdigit():
        return int(source)

    path = Path(source)

    if path.exists():
        return str(path)

    sample_path = SAMPLE_VIDEO_DIR / source

    if sample_path.exists():
        return str(sample_path)

    return source


async def stream_source(
    source,
    camera_id: str,
    ws_base_url: str,
    fps: float,
    loop_video: bool,
    include_image: bool,
):
    safe_camera_id = quote(camera_id, safe="")
    ws_url = f"{ws_base_url.rstrip('/')}/ws/camera/{safe_camera_id}"
    delay = 1.0 / max(fps, 0.1)

    async def drain_server_messages(websocket):
        try:
            async for _message in websocket:
                pass
        except Exception:
            pass

    while True:
        print(f"[INFO] Connecting to {ws_url}")

        try:
            async with websockets.connect(ws_url, max_size=10_000_000) as websocket:
                print(f"[OK] Connected as camera_id={camera_id}")
                drain_task = asyncio.create_task(drain_server_messages(websocket))

                cap = cv2.VideoCapture(parse_source(source))

                if not cap.isOpened():
                    raise RuntimeError(f"Gagal membuka source: {source}")

                frame_count = 0
                last_log = time.time()

                try:
                    while True:
                        ret, frame = cap.read()

                        if not ret:
                            if loop_video:
                                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                                continue

                            print("[INFO] Video selesai.")
                            break

                        image_base64 = encode_frame_to_base64(frame)

                        if image_base64 is None:
                            continue

                        payload = {
                            "image": image_base64,
                            "include_image": include_image,
                        }

                        await websocket.send(json.dumps(payload))

                        frame_count += 1

                        now = time.time()
                        if now - last_log >= 5:
                            print(f"[INFO] Sent {frame_count} frames")
                            last_log = now

                        await asyncio.sleep(delay)
                finally:
                    drain_task.cancel()
                    await asyncio.gather(drain_task, return_exceptions=True)
                    cap.release()

                if not loop_video:
                    break

        except KeyboardInterrupt:
            print("\n[STOP] Stopped by user.")
            break

        except Exception as error:
            print(f"[ERROR] {error}")
            print("[INFO] Reconnecting in 3 seconds...")
            await asyncio.sleep(3)


def main():
    parser = argparse.ArgumentParser(
        description="Manual camera/video sender untuk K3 Monitoring backend."
    )

    parser.add_argument(
        "--source",
        required=True,
        help="Source video. Contoh: 0 untuk webcam, tools/sample_video/sample-k3.mp4, sample-k3.mp4, atau RTSP URL.",
    )

    parser.add_argument(
        "--camera-id",
        required=True,
        help="Camera ID yang akan muncul di frontend. Contoh: webcam_local, sample_k3, sample_cctv.",
    )

    parser.add_argument(
        "--ws",
        default="ws://127.0.0.1:8000",
        help="Base WebSocket backend. Default: ws://127.0.0.1:8000",
    )

    parser.add_argument(
        "--fps",
        type=float,
        default=8.0,
        help="FPS pengiriman frame preview ke backend. Default: 8 FPS; deteksi AI tetap di-throttle backend.",
    )

    parser.add_argument(
        "--no-loop",
        action="store_true",
        help="Jangan loop video ketika file video selesai.",
    )

    parser.add_argument(
        "--no-image",
        action="store_true",
        help="Jangan minta backend mengirim image ke viewer.",
    )

    args = parser.parse_args()

    asyncio.run(
        stream_source(
            source=args.source,
            camera_id=args.camera_id,
            ws_base_url=args.ws,
            fps=args.fps,
            loop_video=not args.no_loop,
            include_image=not args.no_image,
        )
    )


if __name__ == "__main__":
    main()
