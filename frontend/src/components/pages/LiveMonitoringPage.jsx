import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Camera,
  Radio,
  RefreshCw,
} from "lucide-react";
import { createViewerSocket } from "../../services/websocket.js";
import ViolationBadges from "../common/ViolationBadges.jsx";

const statusStyle = {
  Detected: "bg-blue-400/15 text-blue-100",
  Pending: "bg-yellow-400/15 text-yellow-100",
  "Staff Reviewed": "bg-slate-400/15 text-slate-100",
  "Needs Manager": "bg-violet-400/15 text-violet-100",
  Validated: "bg-emerald-400/15 text-emerald-100",
  Dismissed: "bg-slate-400/15 text-slate-100",
  Aman: "bg-emerald-400/15 text-emerald-100",
  Menunggu: "bg-slate-400/15 text-slate-100",
};

const manualCameraOptions = [
  {
    camera: "cam_test",
    label: "cam_test",
    source: "manual",
    description: "Default test camera",
  },
  {
    camera: "sample_k3",
    label: "sample_k3",
    source: "manual",
    description: "Manual sender: sample-k3.mp4",
  },
  {
    camera: "sample_cctv",
    label: "sample_cctv",
    source: "manual",
    description: "Manual sender: sample-k3-cctv.mp4",
  },
  {
    camera: "webcam_local",
    label: "webcam_local",
    source: "manual",
    description: "Manual sender: local webcam",
  },
];

const STALE_FRAME_MS = 25000;
const VIEWER_RECONNECT_BASE_MS = 1500;
const VIEWER_RECONNECT_MAX_MS = 12000;

const ALLOWED_BOX_CLASSES = new Set([
  "person",
  "helmet",
  "no-helmet",
  "vest",
  "no-vest",
  "gloves",
  "no-gloves",
  "goggles",
  "no-goggles",
  "boots",
  "no-boots",
  "safety-shoes",
  "no-safety-shoes",
]);

function boxStyle(detection) {
  if (detection.is_violation) {
    return {
      stroke: "#ef4444",
      fill: "rgba(239,68,68,0.08)",
      text: "#fecaca",
    };
  }

  if (String(detection.class_name || "").startsWith("no-")) {
    return {
      stroke: "#f97316",
      fill: "rgba(249,115,22,0.06)",
      text: "#fed7aa",
    };
  }

  if (detection.class_name === "person") {
    return {
      stroke: "#38bdf8",
      fill: "rgba(56,189,248,0.04)",
      text: "#bae6fd",
    };
  }

  return {
    stroke: "#22c55e",
    fill: "rgba(34,197,94,0.04)",
    text: "#bbf7d0",
  };
}

function DetectionOverlay({ detections = [], imageSize }) {
  const visibleDetections = detections.filter((detection) =>
    ALLOWED_BOX_CLASSES.has(String(detection.class_name || "").toLowerCase()),
  );

  if (!imageSize.width || !imageSize.height || visibleDetections.length === 0) {
    return null;
  }

  const strokeWidth = Math.max(1.5, imageSize.width / 640);

  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {visibleDetections.map((detection, index) => {
        const [x1, y1, x2, y2] = detection.bbox || [];

        if ([x1, y1, x2, y2].some((value) => typeof value !== "number")) {
          return null;
        }

        const width = Math.max(0, x2 - x1);
        const height = Math.max(0, y2 - y1);

        if (!width || !height) {
          return null;
        }

        const style = boxStyle(detection);
        const label = `${detection.class_name} ${Math.round(
          (detection.confidence || 0) * 100,
        )}%`;

        const labelY = Math.max(16, y1 - 6);

        return (
          <g key={`${detection.class_name}-${index}-${x1}-${y1}`}>
            <rect
              x={x1}
              y={y1}
              width={width}
              height={height}
              rx={4}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={strokeWidth}
            />

            <text
              x={x1 + 4}
              y={labelY}
              fill={style.text}
              fontSize={Math.max(11, imageSize.width / 92)}
              fontWeight="700"
              paintOrder="stroke"
              stroke="rgba(0,0,0,0.72)"
              strokeWidth="3"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function LiveMonitoringPage({
  cameraBreakdown = [],
  cameraStreamStatuses = [],
  latestViolations = [],
  loading,
  onRefresh,
}) {
  const [selectedCamera, setSelectedCamera] = useState("cam_test");
  const [liveDetection, setLiveDetection] = useState(null);
  const [liveImage, setLiveImage] = useState("");
  const [lastFrameAt, setLastFrameAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [streamMessage, setStreamMessage] = useState("");
  const [connectionState, setConnectionState] = useState("connecting");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const latest = latestViolations[0];

  const streamStatusByName = useMemo(
    () =>
      cameraStreamStatuses.reduce((acc, item) => {
        acc[item.name] = item;
        return acc;
      }, {}),
    [cameraStreamStatuses],
  );

  const cameraOptions = useMemo(() => {
    const map = new Map();

    for (const item of manualCameraOptions) {
      map.set(item.camera, {
        camera: item.camera,
        label: item.label,
        source: item.source,
        description: item.description,
        count: 0,
      });
    }

    for (const item of cameraBreakdown) {
      map.set(item.camera, {
        camera: item.camera,
        label: item.camera,
        source: item.source || "registered",
        description:
          streamStatusByName[item.camera]?.stream_message ||
          (item.source === "registered"
            ? "Kamera terdaftar / RTSP"
            : "Riwayat deteksi"),
        count: item.count || 0,
      });
    }

    for (const item of cameraStreamStatuses) {
      if (!map.has(item.name)) {
        map.set(item.name, {
          camera: item.name,
          label: item.name,
          source: "registered",
          description: item.stream_message || "Kamera terdaftar",
          count: 0,
        });
      }
    }

    return Array.from(map.values());
  }, [cameraBreakdown, cameraStreamStatuses, streamStatusByName]);

  useEffect(() => {
    if (
      cameraOptions.length > 0 &&
      !cameraOptions.some((camera) => camera.camera === selectedCamera)
    ) {
      setSelectedCamera(cameraOptions[0].camera);
    }
  }, [cameraOptions, selectedCamera]);

  const selectedStreamStatus = streamStatusByName[selectedCamera];

  useEffect(() => {
    let disposed = false;
    let socket = null;
    let reconnectTimer = null;
    let rafId = null;
    let reconnectAttempt = 0;
    let receivedFrames = 0;
    let renderedFrames = 0;
    let lastFpsLogAt = Date.now();

    const pendingFrame = {
      detection: null,
      image: null,
      streamMessage: null,
      clearImage: false,
    };

    const flushPendingFrame = () => {
      rafId = null;
      if (disposed) {
        return;
      }

      if (pendingFrame.clearImage) {
        setLiveDetection(null);
        setLiveImage("");
        setLastFrameAt(0);
        setImageSize({ width: 0, height: 0 });
        pendingFrame.clearImage = false;
      }

      if (pendingFrame.streamMessage !== null) {
        setStreamMessage(pendingFrame.streamMessage);
        pendingFrame.streamMessage = null;
      }

      if (pendingFrame.detection) {
        setLiveDetection(pendingFrame.detection);
        setStreamMessage("");
        setLastFrameAt(Date.now());
        renderedFrames += 1;
      }

      if (pendingFrame.image) {
        setLiveImage(pendingFrame.image);
      }

      pendingFrame.detection = null;
      pendingFrame.image = null;
    };

    const scheduleFrameFlush = () => {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(flushPendingFrame);
    };

    const logViewerStats = () => {
      const now = Date.now();
      const elapsed = (now - lastFpsLogAt) / 1000;
      if (elapsed < 5) {
        return;
      }
      console.info(
        `[viewer:${selectedCamera}] recv=${receivedFrames} (${(receivedFrames / elapsed).toFixed(1)}/s) render=${renderedFrames} (${(renderedFrames / elapsed).toFixed(1)}/s)`,
      );
      receivedFrames = 0;
      renderedFrames = 0;
      lastFpsLogAt = now;
    };

    const connectViewer = () => {
      if (disposed) {
        return;
      }

      if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      setConnectionState("connecting");
      socket = createViewerSocket(selectedCamera);

      socket.onopen = () => {
        if (disposed) {
          return;
        }
        reconnectAttempt = 0;
        setConnectionState("connected");
      };

      socket.onclose = (event) => {
        if (disposed) {
          return;
        }
        setConnectionState("closed");
        console.warn(
          `[viewer:${selectedCamera}] closed code=${event.code} reason=${event.reason || "none"}`,
        );
        const delay = Math.min(
          VIEWER_RECONNECT_BASE_MS * 2 ** reconnectAttempt,
          VIEWER_RECONNECT_MAX_MS,
        );
        reconnectAttempt += 1;
        reconnectTimer = window.setTimeout(connectViewer, delay);
      };

      socket.onerror = () => {
        if (disposed) {
          return;
        }
        setConnectionState("error");
        console.warn(`[viewer:${selectedCamera}] websocket error`);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === "ping") {
            return;
          }

          if (payload.type === "status") {
            pendingFrame.streamMessage = payload.message || "";
            if (payload.clear_image === true) {
              pendingFrame.clearImage = true;
            }
            scheduleFrameFlush();
            return;
          }

          if (payload.type === "detection") {
            receivedFrames += 1;
            const { image, ...detectionPayload } = payload;
            pendingFrame.detection = detectionPayload;
            if (image) {
              pendingFrame.image = image;
            }
            scheduleFrameFlush();
            logViewerStats();
          }
        } catch (error) {
          console.error("Gagal membaca payload viewer", error);
        }
      };
    };

    setLiveDetection(null);
    setLiveImage("");
    setLastFrameAt(0);
    setStreamMessage("");
    setImageSize({ width: 0, height: 0 });
    connectViewer();

    return () => {
      disposed = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (socket) {
        socket.onopen = null;
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close(1000, "viewer unmount");
        }
      }
    };
  }, [selectedCamera]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const isFrameStale = lastFrameAt > 0 && now - lastFrameAt > STALE_FRAME_MS;

  useEffect(() => {
    if (!isFrameStale) return;
    setLiveDetection(null);
    setLiveImage("");
    setImageSize({ width: 0, height: 0 });
    setStreamMessage("Stream tidak menerima frame baru");
  }, [isFrameStale]);

  const currentImage = isFrameStale ? "" : liveImage;

  const imageSrc = currentImage ? `data:image/jpeg;base64,${currentImage}` : "";

  const activeViolation = Boolean(currentImage && liveDetection?.has_violation);

  const currentSummary =
    currentImage && liveDetection?.summary
      ? liveDetection.summary
      : streamMessage || "Menunggu frame deteksi terbaru";

  const currentCamera =
    liveDetection?.camera_id ||
    (currentImage ? latest?.kamera : null) ||
    selectedCamera;

  const currentViolation = liveDetection
    ? liveDetection.violations?.length
      ? liveDetection.violations.join(", ")
      : "-"
    : currentImage
      ? latest?.pelanggaran || "-"
      : "-";

  const currentStatus = liveDetection
    ? liveDetection.has_violation
      ? "Pending"
      : "Aman"
    : currentImage
      ? latest?.status || "Menunggu"
      : "Menunggu";

  const selectedOption = cameraOptions.find(
    (camera) => camera.camera === selectedCamera,
  );

  const liveBadgeText = currentImage
    ? activeViolation
      ? "PELANGGARAN"
      : "APD LENGKAP"
    : connectionState === "connected"
      ? "MENUNGGU FRAME"
      : "OFFLINE";

  return (
    <div className="space-y-5">
      <div className="bg-[#0d1b2a] rounded-2xl border border-slate-800 p-6 text-white overflow-hidden relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/15 text-emerald-200 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionState === "connected"
                    ? "bg-emerald-400 animate-pulse"
                    : connectionState === "error"
                      ? "bg-red-400"
                      : "bg-amber-400"
                }`}
              />

              {connectionState === "connected"
                ? "Live Monitoring"
                : connectionState === "error"
                  ? "Koneksi Error"
                  : "Menghubungkan"}
            </div>

            <h2 className="text-2xl font-bold">Tampilan Real-Time CCTV</h2>

            {selectedOption?.description && (
              <p className="text-xs text-slate-400 mt-2">
                Source: {selectedOption.description}
              </p>
            )}

            {selectedStreamStatus?.has_rtsp && (
              <p className="text-xs text-slate-400 mt-2">
                RTSP: {selectedStreamStatus.stream_state} -{" "}
                {selectedStreamStatus.stream_message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCamera}
              onChange={(event) => setSelectedCamera(event.target.value)}
              className="bg-white/10 border border-white/10 text-white text-xs font-bold rounded-lg px-3 py-2 outline-none max-w-[260px]"
            >
              {cameraOptions.map((camera) => (
                <option
                  className="text-slate-900"
                  key={camera.camera}
                  value={camera.camera}
                >
                  {camera.label}
                </option>
              ))}
            </select>

            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold px-4 py-2 rounded-lg"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 min-h-72 rounded-xl bg-black/35 border border-white/10 flex items-center justify-center relative overflow-hidden">
            {imageSrc ? (
              <>
                <img
                  src={imageSrc}
                  alt={`Live camera ${selectedCamera}`}
                  className="w-full h-full max-h-[520px] object-contain"
                  onLoad={(event) => {
                    setImageSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    });
                  }}
                />

                <DetectionOverlay
                  detections={liveDetection?.detections || []}
                  imageSize={imageSize}
                />
              </>
            ) : (
              <div className="text-center text-white/40 px-6">
                <Camera size={54} className="mx-auto text-white/20 mb-3" />
                <p className="text-sm font-semibold">Menunggu frame deteksi</p>
                <p className="text-xs mt-1">
                  {streamMessage ||
                    "Jalankan script stream_source.py sesuai camera id yang dipilih."}
                </p>
              </div>
            )}

            <span className="absolute top-4 left-4 text-xs font-mono text-white/70 bg-white/10 px-2 py-1 rounded">
              {currentCamera}
            </span>

            <span
              className={`absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full ${
                !currentImage
                  ? "bg-slate-500/90 text-white"
                  : activeViolation
                    ? "bg-red-500/90 text-white"
                    : "bg-emerald-500/90 text-white"
              }`}
            >
              {liveBadgeText}
            </span>

            <span className="absolute bottom-4 left-4 right-4 text-xs text-white/80 bg-black/55 px-3 py-2 rounded-lg">
              {currentSummary}
            </span>
          </div>

          <div className="rounded-xl bg-white/10 border border-white/10 p-4">
            <div className="flex items-center gap-2 text-slate-200 text-sm font-bold mb-4">
              <Radio size={16} />
              Deteksi Terakhir
            </div>

            {latest || liveDetection ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400">Kamera</p>
                  <p className="font-mono text-sm">{currentCamera}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Pelanggaran</p>
                  <div className="mt-1">
                    <ViolationBadges
                      value={currentViolation}
                      layout="list"
                      emptyLabel="APD Lengkap"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Log Database</p>
                  <p className="text-xs text-slate-200">
                    {liveDetection
                      ? liveDetection.logged
                        ? "Disimpan"
                        : liveDetection.stability?.state === "pending"
                          ? `Menunggu konfirmasi ${liveDetection.stability.violation_streak}/${liveDetection.stability.required_frames} frame, ${liveDetection.stability.elapsed_seconds || 0}/${liveDetection.stability.required_seconds || 0} detik`
                          : `Cooldown ${liveDetection.log_cooldown_seconds || 20} detik`
                      : "Menunggu frame"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Status</p>

                  <span
                    className={`inline-flex mt-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                      statusStyle[currentStatus] ||
                      "bg-emerald-400/15 text-emerald-100"
                    }`}
                  >
                    {currentStatus}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Belum ada data deteksi yang diterima.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-500" />

            <h3 className="font-bold text-gray-900">
              Feed Pelanggaran Terbaru
            </h3>
          </div>

          <div className="space-y-3">
            {latestViolations.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-gray-100 px-4 py-3"
              >
                <div className="min-w-0">
                  <ViolationBadges value={item.pelanggaran} layout="list" />

                  <p className="text-xs text-gray-400">{item.waktu}</p>
                </div>

                <span className="font-mono text-xs text-gray-500 bg-slate-50 px-2 py-1 rounded">
                  {item.kamera}
                </span>

                <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-50 text-red-700">
                  {item.status}
                </span>
              </div>
            ))}
          </div>

          {latestViolations.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">
              Belum ada feed pelanggaran.
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-violet-500" />

            <h3 className="font-bold text-gray-900">Status Kamera</h3>
          </div>

          <div className="space-y-3">
            {cameraOptions.map((camera) => {
              const streamStatus = streamStatusByName[camera.camera];
              const effectiveStreamState =
                streamStatus?.stream_state ||
                (camera.source === "manual" &&
                camera.camera === selectedCamera &&
                currentImage
                  ? "running"
                  : camera.source || "idle");

              return (
                <button
                  type="button"
                  key={camera.camera}
                  onClick={() => setSelectedCamera(camera.camera)}
                  className={`w-full grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 py-2 text-left border ${
                    camera.camera === selectedCamera
                      ? "bg-violet-50 border-violet-200"
                      : "bg-slate-50 border-transparent hover:border-slate-200"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-gray-700">
                      {camera.label}
                    </span>

                    <p className="text-[11px] text-gray-400 truncate">
                      {streamStatus?.stream_message ||
                        camera.description ||
                        "Menunggu stream"}
                    </p>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${
                        effectiveStreamState === "running"
                          ? "bg-emerald-50 text-emerald-700"
                          : effectiveStreamState === "error" ||
                              effectiveStreamState === "offline"
                            ? "bg-red-50 text-red-700"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {effectiveStreamState}
                    </span>

                    <p className="mt-1 text-xs text-gray-500">
                      {camera.count || 0} deteksi
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {cameraOptions.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">
              Belum ada kamera dengan deteksi.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
