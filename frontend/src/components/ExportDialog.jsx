import { useMemo, useState } from "react";
import { Download, FileText, X } from "lucide-react";
import { EXPORT_PERIODS, getExportDateRange } from "../utils/exportRanges.js";

const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "detected", label: "Perlu Review Staff" },
  { value: "staff_reviewed", label: "Selesai Staff" },
  { value: "needs_manager", label: "Perlu Manager" },
  { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "Semua Severity" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function ExportDialog({
  cameras = [],
  historyLog = [],
  exporting,
  onClose,
  onExport,
  selectedCamera,
  selectedSeverity,
}) {
  const [format, setFormat] = useState("csv");
  const [period, setPeriod] = useState("weekly");
  const [cameraId, setCameraId] = useState(selectedCamera || "");
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState(selectedSeverity || "");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [error, setError] = useState("");

  const dateRange = useMemo(
    () => getExportDateRange(period, customStartDate, customEndDate),
    [period, customStartDate, customEndDate],
  );

  const estimatedRows = useMemo(() => {
    return historyLog.filter((item) => {
      if (cameraId && item.camera !== cameraId) return false;
      if (status && item.rawStatus !== status && item.action !== status) return false;
      if (severity && item.severity !== severity) return false;
      return true;
    }).length;
  }, [historyLog, cameraId, status, severity]);

  const handleSubmit = () => {
    setError("");
    if (period === "custom" && (!customStartDate || !customEndDate)) {
      setError("Tanggal mulai dan selesai wajib diisi untuk periode kustom.");
      return;
    }

    onExport(format, {
      ...dateRange,
      camera_id: cameraId,
      status,
      severity,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <section className="w-full max-w-lg bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Export Laporan</h2>
            <p className="text-sm text-slate-500">
              Pilih format dan rentang data pelanggaran.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-600"
            aria-label="Tutup export"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-2">
              Format File
            </p>
            <div className="grid grid-cols-2 gap-2">
              {["csv", "pdf"].map((item) => (
                <button
                  key={item}
                  onClick={() => setFormat(item)}
                  className={`h-10 rounded-lg border text-sm font-bold uppercase ${
                    format === item
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-2">
              Periode
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {EXPORT_PERIODS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPeriod(item.id)}
                  className={`h-9 rounded-lg text-xs font-bold ${
                    period === item.id
                      ? "bg-[#0d1b2a] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {period === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="text-xs font-bold uppercase text-slate-500">
                  Mulai
                </span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-100"
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-slate-500">
                  Selesai
                </span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-100"
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label>
              <span className="text-xs font-bold uppercase text-slate-500">
                Kamera
              </span>
              <select
                value={cameraId}
                onChange={(event) => setCameraId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
              >
                <option value="">Semua Kamera</option>
                {cameras.map((camera) => (
                  <option key={camera.camera} value={camera.camera}>
                    {camera.camera}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold uppercase text-slate-500">
                Status
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-bold uppercase text-slate-500">
                Severity
              </span>
              <select
                value={severity}
                onChange={(event) => setSeverity(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none"
              >
                {SEVERITY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-3 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <FileText size={14} />
              Preview export: {estimatedRows} data dari hasil yang sedang termuat
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1">
                {format.toUpperCase()}
              </span>
              <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1">
                {dateRange.start_date || "awal"} s/d {dateRange.end_date || "akhir"}
              </span>
              <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1">
                {cameraId || "Semua kamera"}
              </span>
              <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1">
                {STATUS_OPTIONS.find((item) => item.value === status)?.label || "Semua status"}
              </span>
              <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1">
                {SEVERITY_OPTIONS.find((item) => item.value === severity)?.label || "Semua severity"}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-lg bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200"
          >
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={Boolean(exporting)}
            className="h-10 px-4 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Download size={15} />
            {exporting ? "Mengunduh..." : "Download"}
          </button>
        </div>
      </section>
    </div>
  );
}
