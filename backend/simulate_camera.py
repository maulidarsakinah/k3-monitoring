# simulate_camera.py - test stream backend tanpa frontend.
import asyncio
import base64
import json

import cv2
import numpy as np
import websockets

WS_URL = "ws://localhost:8000/ws/camera/cam_test"
CAMERA_INDEX = 0
TARGET_FPS = 60
FRAME_INTERVAL_SEC = 1.0 / TARGET_FPS
RECV_TIMEOUT_SEC = 0.001
WINDOW_NAME = "APD Camera Simulator"
SIDEBAR_WIDTH = 320

ATTRIBUTE_ITEMS = [
    {"class_name": "Hardhat", "missing_class": "NO-Hardhat", "label": "Helmet"},
    {"class_name": "Safety Vest", "missing_class": "NO-Safety Vest", "label": "Safety Vest"},
    {"class_name": "Gloves", "missing_class": "NO-Gloves", "label": "Gloves"},
    {"class_name": "Goggles", "missing_class": "NO-Goggles", "label": "Goggles"},
    {"class_name": "Mask", "missing_class": "NO-Mask", "label": "Mask"},
]


def wrap_text(text: str, max_chars: int = 34) -> list[str]:
    words = text.split()
    if not words:
        return [""]

    lines = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def draw_overlay(frame, summary: str, has_violation: bool) -> None:
    """Draw compact status panel on the camera frame."""
    color = (0, 0, 255) if has_violation else (0, 180, 0)
    status = "VIOLATION" if has_violation else "OK"

    panel_right = min(frame.shape[1] - 10, 680)
    cv2.rectangle(frame, (10, 10), (panel_right, 72), (18, 18, 18), -1)
    cv2.putText(
        frame,
        f"Status: {status}",
        (20, 32),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        color,
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        frame,
        summary[:100],
        (20, 56),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.43,
        (230, 230, 230),
        1,
        cv2.LINE_AA,
    )
    cv2.putText(
        frame,
        "Press q or Esc to exit",
        (20, frame.shape[0] - 18),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.42,
        (245, 245, 245),
        1,
        cv2.LINE_AA,
    )


def build_attribute_checklist(detections: list[dict]) -> list[dict]:
    top_conf: dict[str, float] = {}
    for det in detections:
        class_name = str(det.get("class_name", ""))
        try:
            confidence = float(det.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
        if class_name and confidence > top_conf.get(class_name, -1.0):
            top_conf[class_name] = confidence

    checklist = []
    for item in ATTRIBUTE_ITEMS:
        used_cls = item["class_name"]
        missing_cls = item["missing_class"]

        if used_cls in top_conf:
            checklist.append(
                {
                    "label": item["label"],
                    "state": "used",
                    "confidence": top_conf[used_cls],
                }
            )
        elif missing_cls in top_conf:
            checklist.append(
                {
                    "label": item["label"],
                    "state": "missing",
                    "confidence": top_conf[missing_cls],
                }
            )
        else:
            checklist.append({"label": item["label"], "state": "unknown", "confidence": None})

    return checklist


def compose_frame_with_sidebar(
    frame, summary: str, has_violation: bool, detections: list[dict], checklist: list[dict]
):
    height, width = frame.shape[:2]
    canvas = np.zeros((height, width + SIDEBAR_WIDTH, 3), dtype=np.uint8)
    canvas[:, :width] = frame

    sidebar_left = width
    cv2.rectangle(canvas, (sidebar_left, 0), (width + SIDEBAR_WIDTH, height), (18, 22, 30), -1)
    cv2.line(canvas, (sidebar_left, 0), (sidebar_left, height), (64, 70, 84), 1)

    title_color = (239, 242, 247)
    label_color = (148, 163, 184)
    cv2.putText(
        canvas,
        "Checklist APD",
        (sidebar_left + 18, 36),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.72,
        title_color,
        2,
        cv2.LINE_AA,
    )

    status_line = "Status: VIOLATION" if has_violation else "Status: OK"
    status_color = (70, 90, 255) if has_violation else (80, 220, 120)
    cv2.putText(
        canvas,
        status_line,
        (sidebar_left + 18, 62),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.48,
        status_color,
        1,
        cv2.LINE_AA,
    )

    y = 98
    cv2.putText(
        canvas,
        "Atribut yang sedang dipakai",
        (sidebar_left + 18, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.44,
        label_color,
        1,
        cv2.LINE_AA,
    )

    y += 28
    for item in checklist:
        if item["state"] == "used":
            prefix = "[x]"
            color = (80, 220, 120)
        elif item["state"] == "missing":
            prefix = "[ ]"
            color = (70, 90, 255)
        else:
            prefix = "[-]"
            color = (167, 176, 191)

        conf = item["confidence"]
        if conf is not None:
            line = f"{prefix} {item['label']}  ({int(conf * 100)}%)"
        else:
            line = f"{prefix} {item['label']}"

        cv2.putText(
            canvas,
            line,
            (sidebar_left + 18, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.47,
            color,
            1,
            cv2.LINE_AA,
        )
        y += 29

    y += 8
    cv2.putText(
        canvas,
        "Ringkasan deteksi",
        (sidebar_left + 18, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.44,
        label_color,
        1,
        cv2.LINE_AA,
    )

    y += 24
    for line in wrap_text(summary, max_chars=36)[:4]:
        cv2.putText(
            canvas,
            line,
            (sidebar_left + 18, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.44,
            (225, 229, 236),
            1,
            cv2.LINE_AA,
        )
        y += 22

    detected_classes = sorted(
        {str(d.get("class_name", "")).strip() for d in detections if d.get("class_name")}
    )
    y += 8
    cv2.putText(
        canvas,
        "Class terdeteksi",
        (sidebar_left + 18, y),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.44,
        label_color,
        1,
        cv2.LINE_AA,
    )

    y += 24
    class_text = ", ".join(detected_classes) if detected_classes else "-"
    for line in wrap_text(class_text, max_chars=36)[:5]:
        cv2.putText(
            canvas,
            line,
            (sidebar_left + 18, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (210, 217, 228),
            1,
            cv2.LINE_AA,
        )
        y += 20

    return canvas


async def simulate() -> None:
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        raise RuntimeError(
            f"Gagal membuka kamera index {CAMERA_INDEX}. Coba ganti ke 1 atau 2."
        )
    cap.set(cv2.CAP_PROP_FPS, TARGET_FPS)

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, 1320, 620)

    try:
        async with websockets.connect(WS_URL) as ws:
            print(f"Connected to {WS_URL} | target FPS: {TARGET_FPS}")
            summary = "Menunggu hasil deteksi..."
            has_violation = False
            latest_detections: list[dict] = []
            loop = asyncio.get_running_loop()

            while True:
                frame_start = loop.time()
                ret, frame = cap.read()
                if not ret:
                    print("Frame kamera gagal dibaca.")
                    break

                ok, buf = cv2.imencode(".jpg", frame)
                if not ok:
                    print("Gagal encode frame ke JPEG.")
                    continue

                payload = {"image": base64.b64encode(buf).decode("ascii")}
                await ws.send(json.dumps(payload))

                try:
                    # Ambil response terbaru tanpa menahan loop terlalu lama.
                    while True:
                        raw_message = await asyncio.wait_for(
                            ws.recv(), timeout=RECV_TIMEOUT_SEC
                        )
                        result = json.loads(raw_message)
                        msg_type = result.get("type")

                        if msg_type == "detection":
                            summary = result.get("summary", summary)
                            has_violation = bool(result.get("has_violation", False))
                            latest_detections = result.get("detections", [])
                            print(summary)
                        elif msg_type == "ping":
                            summary = "Ping dari server"
                            has_violation = False
                        elif msg_type == "error":
                            summary = f"Server error: {result.get('message', 'unknown')}"
                            has_violation = True
                        else:
                            summary = str(result)
                except asyncio.TimeoutError:
                    pass

                preview = frame.copy()
                draw_overlay(preview, summary, has_violation)
                checklist = build_attribute_checklist(latest_detections)
                combined = compose_frame_with_sidebar(
                    preview,
                    summary=summary,
                    has_violation=has_violation,
                    detections=latest_detections,
                    checklist=checklist,
                )
                cv2.imshow(WINDOW_NAME, combined)

                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), 27):
                    print("Keluar dari simulator kamera.")
                    break

                elapsed = loop.time() - frame_start
                sleep_time = FRAME_INTERVAL_SEC - elapsed
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    asyncio.run(simulate())
