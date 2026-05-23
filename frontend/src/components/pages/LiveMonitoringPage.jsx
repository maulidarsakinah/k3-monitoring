import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Camera, Radio, RefreshCw } from "lucide-react";
import { createViewerSocket } from "../../services/websocket.js";
import ViolationBadges from "../common/ViolationBadges.jsx";

const statusStyle = {
  Detected: "bg-blue-400/15 text-blue-100",
  Pending: "bg-yellow-400/15 text-yellow-100",
  "Staff Reviewed": "bg-slate-400/15 text-slate-100",
  "Needs Manager": "bg-violet-400/15 text-violet-100",
  Validated: "bg-emerald-400/15 text-emerald-100",
  Dismissed: "bg-slate-400/15 text-slate-100",
};

export default function LiveMonitoringPage({
  cameraBreakdown = [],
  cameraStreamStatuses = [],
  latestViolations = [],
  loading,
  onRefresh,
}) {
  const [selectedCamera, setSelectedCamera] = useState("cam_test");
  const [liveDetection, setLiveDetection] = useState(null);
  const [connectionState, setConnectionState] = useState("connecting");
  const latest = latestViolations[0];
  const cameraOptions = useMemo(() => {
    const cameras = cameraBreakdown.map((item) => item.camera);
    return Array.from(new Set(["cam_test", ...cameras]));
  }, [cameraBreakdown]);
  const streamStatusByName = useMemo(
    () =>
      cameraStreamStatuses.reduce((acc, item) => {
        acc[item.name] = item;
        return acc;
      }, {}),
    [cameraStreamStatuses],
  );
  const selectedStreamStatus = streamStatusByName[selectedCamera];

  useEffect(() => {
    setConnectionState("connecting");
    setLiveDetection(null);

    const socket = createViewerSocket(selectedCamera);

    socket.onopen = () => setConnectionState("connected");
    socket.onclose = () => setConnectionState("closed");
    socket.onerror = () => setConnectionState("error");
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "detection") {
        setLiveDetection(payload);
      }
    };

    return () => socket.close();
  }, [selectedCamera]);

  const imageSrc = liveDetection?.image
    ? `data:image/jpeg;base64,${liveDetection.image}`
    : "";
  const activeViolation = liveDetection?.has_violation;
  const currentSummary =
    liveDetection?.summary ||
    (latest
      ? `${latest.waktu} - ${latest.pelanggaran}`
      : "Menunggu data deteksi terbaru");
  const currentCamera = liveDetection?.camera_id || latest?.kamera || selectedCamera;
  const currentViolation = liveDetection?.violations?.length
    ? liveDetection.violations.join(", ")
    : latest?.pelanggaran || "-";
  const currentStatus = liveDetection
    ? liveDetection.has_violation
      ? "Pending"
      : "Aman"
    : latest?.status || "Menunggu";

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
                    : "bg-amber-400"
                }`}
              />
              {connectionState === "connected" ? "Live Monitoring" : "Menghubungkan"}
            </div>
            <h2 className="text-2xl font-bold">Tampilan Real-Time CCTV</h2>
            <p className="text-sm text-slate-300 mt-1">
              Pantau frame kamera RTSP, status APD, dan hasil deteksi terbaru.
            </p>
            {selectedStreamStatus?.has_rtsp && (
              <p className="text-xs text-slate-400 mt-2">
                RTSP: {selectedStreamStatus.stream_state} - {selectedStreamStatus.stream_message}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedCamera}
              onChange={(event) => setSelectedCamera(event.target.value)}
              className="bg-white/10 border border-white/10 text-white text-xs font-bold rounded-lg px-3 py-2 outline-none"
            >
              {cameraOptions.map((camera) => (
                <option className="text-slate-900" key={camera} value={camera}>
                  {camera}
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
              <img
                src={imageSrc}
                alt={`Live camera ${selectedCamera}`}
                className="w-full h-full max-h-[520px] object-contain"
              />
            ) : (
              <Camera size={54} className="text-white/20" />
            )}
            <span className="absolute top-4 left-4 text-xs font-mono text-white/70 bg-white/10 px-2 py-1 rounded">
              {currentCamera}
            </span>
            <span
              className={`absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full ${
                activeViolation
                  ? "bg-red-500/90 text-white"
                  : "bg-emerald-500/90 text-white"
              }`}
            >
              {activeViolation ? "PELANGGARAN" : "APD LENGKAP"}
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
                        : `Cooldown ${liveDetection.log_cooldown_seconds || 10} detik`
                      : "Menunggu frame"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Status</p>
                  <span
                    className={`inline-flex mt-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                      statusStyle[currentStatus] || "bg-emerald-400/15 text-emerald-100"
                    }`}
                  >
                    {currentStatus}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Belum ada pelanggaran yang diterima.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-500" />
            <h3 className="font-bold text-gray-900">Feed Pelanggaran Terbaru</h3>
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
            {cameraBreakdown.map((camera) => (
              <div
                key={camera.camera}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="font-mono text-xs font-semibold text-gray-700">
                    {camera.camera}
                  </span>
                  <p className="text-[11px] text-gray-400 truncate">
                    {streamStatusByName[camera.camera]?.stream_message ||
                      (camera.source === "registered" ? "Menunggu stream" : "Deteksi historis")}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${
                      streamStatusByName[camera.camera]?.stream_state === "running"
                        ? "bg-emerald-50 text-emerald-700"
                        : streamStatusByName[camera.camera]?.stream_state === "error"
                          ? "bg-red-50 text-red-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {streamStatusByName[camera.camera]?.stream_state || "idle"}
                  </span>
                  <p className="mt-1 text-xs text-gray-500">{camera.count} deteksi</p>
                </div>
              </div>
            ))}
          </div>
          {cameraBreakdown.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">
              Belum ada kamera dengan deteksi.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
