# simulate_camera.py - test stream backend tanpa frontend.
import argparse
import asyncio
import base64
import json

import cv2
import numpy as np
import websockets

DEFAULT_WS_URL = "ws://localhost:8000/ws/camera/cam_test"
DEFAULT_CAMERA_INDEX = 0
DEFAULT_TARGET_FPS = 6
DEFAULT_MAX_WIDTH = 960
DEFAULT_JPEG_QUALITY = 70
DEFAULT_SEND_INTERVAL_SEC = 0.75
RECV_TIMEOUT_SEC = 0.001
WINDOW_NAME = "APD Camera Simulator"
SIDEBAR_WIDTH = 320
RECONNECT_DELAY = 3  # detik sebelum reconnect

ATTRIBUTE_ITEMS = [
    {"class_name": "helmet",  "missing_class": "no-helmet",  "label": "Helmet", "violation": "Tidak menggunakan helm"},
    {"class_name": "vest",    "missing_class": "no-vest",    "label": "Safety Vest", "violation": "Tidak menggunakan rompi keselamatan"},
    {"class_name": "gloves",  "missing_class": "no-gloves",  "label": "Gloves", "violation": "Tidak menggunakan sarung tangan"},
    {"class_name": "goggles", "missing_class": "no-goggles", "label": "Goggles", "violation": "Tidak menggunakan kacamata pelindung"},
    {"class_name": "safety-shoes", "missing_class": "no-safety-shoes", "label": "Safety Shoes", "violation": "Tidak menggunakan sepatu keselamatan"},
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
    color = (0, 0, 255) if has_violation else (0, 180, 0)
    status = "VIOLATION" if has_violation else "OK"
    panel_right = min(frame.shape[1] - 10, 680)
    cv2.rectangle(frame, (10, 10), (panel_right, 72), (18, 18, 18), -1)
    cv2.putText(frame, f"Status: {status}", (20, 32),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1, cv2.LINE_AA)
    cv2.putText(frame, summary[:100], (20, 56),
                cv2.FONT_HERSHEY_SIMPLEX, 0.43, (230, 230, 230), 1, cv2.LINE_AA)
    cv2.putText(frame, "Press q or Esc to exit", (20, frame.shape[0] - 18),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, (245, 245, 245), 1, cv2.LINE_AA)


def resize_to_max_width(frame, max_width: int):
    if not max_width or max_width <= 0 or frame.shape[1] <= max_width:
        return frame
    scale = max_width / frame.shape[1]
    new_size = (max_width, max(1, int(frame.shape[0] * scale)))
    return cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)


def draw_detections(frame, detections: list[dict]) -> None:
    for det in detections:
        bbox = det.get("bbox") or []
        if len(bbox) != 4:
            continue

        try:
            x1, y1, x2, y2 = [int(v) for v in bbox]
            confidence = float(det.get("confidence", 0.0))
        except (TypeError, ValueError):
            continue

        class_name = str(det.get("class_name", "unknown"))
        is_violation = bool(det.get("is_violation", False))
        is_candidate_violation = class_name.startswith(("no-", "no_")) and not is_violation
        if is_violation:
            color = (60, 80, 255)
        elif is_candidate_violation:
            color = (0, 190, 255)
        else:
            color = (60, 220, 120)
        label = f"{class_name} {int(confidence * 100)}%"
        if is_candidate_violation:
            label = f"{label} candidate"

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        label_y = max(18, y1 - 8)
        (label_w, label_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)
        cv2.rectangle(frame, (x1, label_y - label_h - 6), (x1 + label_w + 8, label_y + 4), color, -1)
        cv2.putText(frame, label, (x1 + 4, label_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (255, 255, 255), 1, cv2.LINE_AA)


def build_attribute_checklist(detections: list[dict], violations: list[str] | None = None) -> list[dict]:
    top_conf: dict[str, float] = {}
    top_violation_conf: dict[str, float] = {}
    violation_set = set(violations or [])
    for det in detections:
        class_name = str(det.get("class_name", ""))
        try:
            confidence = float(det.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
        if class_name and confidence > top_conf.get(class_name, -1.0):
            top_conf[class_name] = confidence
        if bool(det.get("is_violation", False)) and class_name and confidence > top_violation_conf.get(class_name, -1.0):
            top_violation_conf[class_name] = confidence

    checklist = []
    for item in ATTRIBUTE_ITEMS:
        used_cls = item["class_name"]
        missing_cls = item["missing_class"]
        violation_label = item.get("violation")
        if used_cls in top_conf:
            checklist.append({"label": item["label"], "state": "used",    "confidence": top_conf[used_cls]})
        elif violation_label in violation_set:
            checklist.append({"label": item["label"], "state": "missing", "confidence": None})
        elif missing_cls in top_violation_conf:
            checklist.append({"label": item["label"], "state": "missing", "confidence": top_violation_conf[missing_cls]})
        elif missing_cls in top_conf:
            checklist.append({"label": item["label"], "state": "candidate", "confidence": top_conf[missing_cls]})
        else:
            checklist.append({"label": item["label"], "state": "unknown", "confidence": None})
    return checklist


def compose_frame_with_sidebar(frame, summary, has_violation, detections,
                                checklist, severity="none", logged=True,
                                stability=None, raw_violations=None):
    height, width = frame.shape[:2]
    canvas = np.zeros((height, width + SIDEBAR_WIDTH, 3), dtype=np.uint8)
    canvas[:, :width] = frame

    sidebar_left = width
    cv2.rectangle(canvas, (sidebar_left, 0), (width + SIDEBAR_WIDTH, height), (18, 22, 30), -1)
    cv2.line(canvas, (sidebar_left, 0), (sidebar_left, height), (64, 70, 84), 1)

    title_color = (239, 242, 247)
    label_color = (148, 163, 184)

    cv2.putText(canvas, "Checklist APD", (sidebar_left + 18, 36),
                cv2.FONT_HERSHEY_SIMPLEX, 0.72, title_color, 2, cv2.LINE_AA)

    status_line = "Status: VIOLATION" if has_violation else "Status: OK"
    status_color = (70, 90, 255) if has_violation else (80, 220, 120)
    cv2.putText(canvas, status_line, (sidebar_left + 18, 62),
                cv2.FONT_HERSHEY_SIMPLEX, 0.48, status_color, 1, cv2.LINE_AA)

    # Severity + logged indicator
    severity_colors = {
        "none": (150, 150, 150), "low": (80, 220, 120),
        "medium": (0, 165, 255), "high": (70, 90, 255)
    }
    sev_color = severity_colors.get(severity, (150, 150, 150))
    logged_text = "SAVED" if logged else "COOLDOWN"
    logged_color = (80, 220, 120) if logged else (0, 165, 255)
    cv2.putText(canvas, f"Severity: {severity.upper()}",
                (sidebar_left + 18, 82),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, sev_color, 1, cv2.LINE_AA)
    cv2.putText(canvas, f"[{logged_text}]",
                (sidebar_left + 160, 82),
                cv2.FONT_HERSHEY_SIMPLEX, 0.42, logged_color, 1, cv2.LINE_AA)

    stability = stability or {}
    raw_violations = raw_violations or []
    cv2.putText(canvas, f"Stability: {stability.get('state', '-')}",
                (sidebar_left + 18, 100),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, label_color, 1, cv2.LINE_AA)

    y = 124
    cv2.putText(canvas, "Status atribut model", (sidebar_left + 18, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.44, label_color, 1, cv2.LINE_AA)

    y += 28
    for item in checklist:
        if item["state"] == "used":
            prefix, color = "[x]", (80, 220, 120)
        elif item["state"] == "missing":
            prefix, color = "[ ]", (70, 90, 255)
        elif item["state"] == "candidate":
            prefix, color = "[?]", (0, 190, 255)
        else:
            prefix, color = "[-]", (167, 176, 191)
        conf = item["confidence"]
        line = f"{prefix} {item['label']}  ({int(conf * 100)}%)" if conf is not None else f"{prefix} {item['label']}"
        cv2.putText(canvas, line, (sidebar_left + 18, y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.47, color, 1, cv2.LINE_AA)
        y += 29

    y += 8
    cv2.putText(canvas, "Ringkasan deteksi", (sidebar_left + 18, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.44, label_color, 1, cv2.LINE_AA)
    y += 24
    for line in wrap_text(summary, max_chars=36)[:4]:
        cv2.putText(canvas, line, (sidebar_left + 18, y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.44, (225, 229, 236), 1, cv2.LINE_AA)
        y += 22

    detected_classes = sorted(
        {str(d.get("class_name", "")).strip() for d in detections if d.get("class_name")}
    )
    y += 8
    cv2.putText(canvas, "Class terdeteksi", (sidebar_left + 18, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.44, label_color, 1, cv2.LINE_AA)
    y += 24
    class_text = ", ".join(detected_classes) if detected_classes else "-"
    for line in wrap_text(class_text, max_chars=36)[:5]:
        cv2.putText(canvas, line, (sidebar_left + 18, y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (210, 217, 228), 1, cv2.LINE_AA)
        y += 20

    if raw_violations:
        y += 8
        cv2.putText(canvas, "Kandidat sebelum stabil", (sidebar_left + 18, y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.44, label_color, 1, cv2.LINE_AA)
        y += 24
        raw_text = ", ".join(raw_violations)
        for line in wrap_text(raw_text, max_chars=36)[:3]:
            cv2.putText(canvas, line, (sidebar_left + 18, y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.40, (205, 214, 226), 1, cv2.LINE_AA)
            y += 19

    return canvas


def parse_args():
    parser = argparse.ArgumentParser(
        description="Simulasi kamera APD dari webcam, file video lokal, atau URL video."
    )
    parser.add_argument(
        "--source",
        default=str(DEFAULT_CAMERA_INDEX),
        help="Sumber video. Contoh: 0 untuk webcam, sample.mp4, atau URL video.",
    )
    parser.add_argument(
        "--ws-url",
        default=DEFAULT_WS_URL,
        help="URL WebSocket backend. Default: ws://localhost:8000/ws/camera/cam_test",
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Putar ulang video dari awal saat file video selesai.",
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=DEFAULT_TARGET_FPS,
        help=f"FPS pengiriman frame ke backend. Default: {DEFAULT_TARGET_FPS}.",
    )
    parser.add_argument(
        "--max-width",
        type=int,
        default=DEFAULT_MAX_WIDTH,
        help=f"Lebar maksimum frame yang dikirim/ditampilkan. Default: {DEFAULT_MAX_WIDTH}.",
    )
    parser.add_argument(
        "--jpeg-quality",
        type=int,
        default=DEFAULT_JPEG_QUALITY,
        help=f"Kualitas JPEG 1-100. Default: {DEFAULT_JPEG_QUALITY}.",
    )
    parser.add_argument(
        "--send-interval",
        type=float,
        default=DEFAULT_SEND_INTERVAL_SEC,
        help=f"Jarak kirim frame ke backend dalam detik. Default: {DEFAULT_SEND_INTERVAL_SEC}.",
    )
    parser.add_argument(
        "--no-preview",
        action="store_true",
        help="Kirim frame tanpa membuka window preview OpenCV.",
    )
    return parser.parse_args()


def open_capture(source: str):
    capture_source = int(source) if source.isdigit() else source
    cap = cv2.VideoCapture(capture_source)
    if not cap.isOpened():
        raise RuntimeError(
            f"Gagal membuka sumber video '{source}'. "
            "Pakai angka webcam seperti 0/1, path file .mp4, atau URL video yang bisa dibaca OpenCV."
        )
    return cap


async def simulate() -> None:
    args = parse_args()
    cap = open_capture(args.source)
    target_fps = max(1.0, min(args.fps, 30.0))
    jpeg_quality = max(35, min(args.jpeg_quality, 95))
    send_interval = max(0.15, args.send_interval)
    frame_interval_sec = 1.0 / target_fps
    cap.set(cv2.CAP_PROP_FPS, target_fps)

    if not args.no_preview:
        cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(WINDOW_NAME, 1320, 620)

    # State deteksi — dipertahankan saat reconnect
    summary = "Menunggu hasil deteksi..."
    has_violation = False
    severity = "none"
    logged = True
    stability: dict = {}
    raw_violations: list[str] = []
    latest_violations: list[str] = []
    latest_detections: list[dict] = []

    try:
        while True:  # loop reconnect
            try:
                print(f"Menghubungkan ke {args.ws_url}...")
                async with websockets.connect(
                    args.ws_url,
                    ping_interval=None,
                    ping_timeout=None,
                    close_timeout=10,
                ) as ws:
                    print(f"Terhubung! | source: {args.source} | target FPS: {target_fps:g}")
                    loop = asyncio.get_running_loop()
                    last_send_at = 0.0

                    while True:
                        frame_start = loop.time()
                        ret, frame = cap.read()
                        if not ret:
                            if args.loop:
                                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                                continue
                            print("Video selesai atau frame gagal dibaca.")
                            return

                        frame = resize_to_max_width(frame, args.max_width)
                        now = loop.time()
                        if now - last_send_at >= send_interval:
                            ok, buf = cv2.imencode(
                                ".jpg",
                                frame,
                                [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality],
                            )
                            if ok:
                                await ws.send(json.dumps({
                                    "image": base64.b64encode(buf).decode("ascii"),
                                    "include_image": False,
                                }))
                                last_send_at = now

                        try:
                            while True:
                                raw_message = await asyncio.wait_for(
                                    ws.recv(), timeout=RECV_TIMEOUT_SEC
                                )
                                result = json.loads(raw_message)
                                msg_type = result.get("type")

                                if msg_type == "detection":
                                    summary           = result.get("summary", summary)
                                    has_violation     = bool(result.get("has_violation", False))
                                    severity          = result.get("severity", "none")
                                    logged            = result.get("logged", True)
                                    stability         = result.get("stability", {})
                                    raw_violations    = result.get("raw_violations", [])
                                    latest_violations = result.get("violations", [])
                                    latest_detections = result.get("detections", [])
                                    logged_tag = "SAVED" if logged else "COOLDOWN"
                                    print(f"{summary} | severity: {severity} | {logged_tag}")
                                elif msg_type == "ping":
                                    summary, has_violation = "Ping dari server", False
                                elif msg_type == "error":
                                    summary = f"Server error: {result.get('message', 'unknown')}"
                                    has_violation = True
                        except asyncio.TimeoutError:
                            pass

                        if not args.no_preview:
                            preview = frame.copy()
                            draw_detections(preview, latest_detections)
                            draw_overlay(preview, summary, has_violation)
                            checklist = build_attribute_checklist(latest_detections, latest_violations)
                            combined = compose_frame_with_sidebar(
                                preview, summary=summary, has_violation=has_violation,
                                detections=latest_detections, checklist=checklist,
                                severity=severity, logged=logged,
                                stability=stability, raw_violations=raw_violations,
                            )
                            cv2.imshow(WINDOW_NAME, combined)

                            key = cv2.waitKey(1) & 0xFF
                            if key in (ord("q"), 27):
                                print("Keluar dari simulator kamera.")
                                return  # keluar total

                        elapsed = loop.time() - frame_start
                        sleep_time = frame_interval_sec - elapsed
                        if sleep_time > 0:
                            await asyncio.sleep(sleep_time)

            except (
                websockets.exceptions.ConnectionClosedError,
                websockets.exceptions.ConnectionClosedOK,
                OSError,
            ) as e:
                print(f"Koneksi terputus: {e}")
                print(f"Reconnect dalam {RECONNECT_DELAY} detik...")
                await asyncio.sleep(RECONNECT_DELAY)
                continue

    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    asyncio.run(simulate())
