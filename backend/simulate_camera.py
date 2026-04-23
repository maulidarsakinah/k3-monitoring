import cv2, asyncio, websockets, base64, json

async def simulate():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌ Webcam tidak ditemukan")
        return

    print("✅ Webcam terhubung, mulai streaming...")

    try:
        async with websockets.connect("ws://localhost:8000/ws/camera/cam_test") as ws:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                _, buf = cv2.imencode(".jpg", frame)
                await ws.send(json.dumps({"image": base64.b64encode(buf).decode()}))

                result = json.loads(await ws.recv())

                if result.get("type") != "detection":
                    continue

                print(result.get("summary", "-"))

                # Status
                color = (0, 0, 255) if result["has_violation"] else (0, 255, 0)
                status = "PELANGGARAN!" if result["has_violation"] else "APD LENGKAP"
                cv2.putText(frame, status, (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

                # Daftar pelanggaran — tiap item 1 baris
                violations = result.get("violations", [])
                for i, v in enumerate(violations):
                    cv2.putText(frame, v, (10, 60 + i * 25),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

                cv2.imshow("APD Detection", frame)

                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

                await asyncio.sleep(0.5)

    except websockets.exceptions.ConnectionClosed:
        print("❌ Koneksi terputus")
    except KeyboardInterrupt:
        print("⏹ Dihentikan")
    finally:
        cap.release()
        cv2.destroyAllWindows()

asyncio.run(simulate())