// ============================================================
// HistoryPage.jsx
// Full event log table + an inline detail panel that slides
// open when the operator clicks "Detail" on any row.
//
// Detail panel shows:
//   - Bukti foto (CCTV snapshot placeholder)
//   - Tipe pelanggaran
//   - Timestamp lengkap
//   - Kamera
//   - Karyawan & tindakan
// ============================================================

import { useState } from "react";
import { X, Camera, Clock, Tv2, AlertTriangle, CheckCircle } from "lucide-react";

export default function HistoryPage({ historyLog, selectedId = null }) {
  // Which row's detail panel is open (null = none)
  const [detailId, setDetailId] = useState(selectedId);

  // Find the currently selected record
  const selected = historyLog.find((r) => r.id === detailId) ?? null;

  // Badge color per action type
  const actionStyle = {
    "Notified":       "bg-blue-100   text-blue-800",
    "Warning Issued": "bg-orange-100 text-orange-800",
    "Dismissed":      "bg-gray-100   text-gray-600",
  };

  // Icon per action for the detail panel
  const actionIcon = {
    "Notified":       <CheckCircle size={15} className="text-blue-500" />,
    "Warning Issued": <AlertTriangle size={15} className="text-orange-500" />,
    "Dismissed":      <X size={15} className="text-gray-400" />,
  };

  return (
    // Side-by-side: table on the left, detail panel on the right
    <div className="flex gap-5 items-start">

      {/* ── LEFT: History Table ── */}
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Riwayat Pelanggaran</h2>
        <p className="text-sm text-gray-400 mb-6">Log lengkap semua kejadian yang terdeteksi</p>

        {/* Scrollable on small screens */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4">Tanggal</th>
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4">Waktu</th>
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4">Karyawan</th>
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4">Pelanggaran</th>
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4">Kamera</th>
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4">Tindakan</th>
                <th className="pb-3 text-left text-blue-500 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {historyLog.map((row) => {
                const isActive = row.id === detailId;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-50 transition-colors ${
                      isActive ? "bg-violet-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="py-3 pr-4 text-gray-500">{row.date}</td>
                    <td className="py-3 pr-4 text-gray-500">{row.time}</td>
                    <td className="py-3 pr-4 font-medium text-gray-800">{row.employee}</td>
                    <td className="py-3 pr-4 text-gray-700">{row.violation}</td>
                    <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{row.camera}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${actionStyle[row.action] ?? "bg-gray-100 text-gray-600"}`}>
                        {row.action}
                      </span>
                    </td>

                    {/* ── Detail / Tutup button ── */}
                    <td className="py-3">
                      <button
                        onClick={() => setDetailId(isActive ? null : row.id)}
                        className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors ${
                          isActive
                            ? "bg-[#0d1b2a] text-white border-[#0d1b2a]"
                            : "border-gray-300 text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {isActive ? "Tutup" : "Detail"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── RIGHT: Detail Panel ── */}
      {selected && (
        <div className="w-72 shrink-0 bg-white rounded-2xl border border-gray-100 overflow-hidden">

          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">Detail Pelanggaran</h3>
            <button
              onClick={() => setDetailId(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Bukti Foto — CCTV snapshot placeholder ── */}
          <div className="relative bg-[#0d1b2a] h-44 flex flex-col items-center justify-center gap-2">
            <Camera size={36} className="text-white/20" />
            <span className="text-white/40 text-xs">Snapshot bukti CCTV</span>

            {/* Camera ID badge top-left */}
            <span className="absolute top-3 left-3 text-xs font-mono text-white/70 bg-white/10 px-2 py-0.5 rounded">
              {selected.camera}
            </span>

            {/* Timestamp bar at bottom */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-1.5">
              <p className="text-white/80 text-[11px] font-mono">
                {selected.date} — {selected.time}
              </p>
            </div>
          </div>

          {/* ── Info Rows ── */}
          <div className="px-5 py-4 space-y-4">

            {/* Tipe Pelanggaran */}
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Tipe Pelanggaran</p>
                <p className="text-sm font-semibold text-gray-800">{selected.violation}</p>
              </div>
            </div>

            {/* Timestamp */}
            <div className="flex items-start gap-3">
              <Clock size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Timestamp</p>
                <p className="text-sm font-semibold text-gray-800">
                  {selected.date}, {selected.time}
                </p>
              </div>
            </div>

            {/* Kamera */}
            <div className="flex items-start gap-3">
              <Tv2 size={16} className="text-violet-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Kamera</p>
                <p className="text-sm font-semibold text-gray-800 font-mono">{selected.camera}</p>
              </div>
            </div>

            {/* Karyawan */}
            <div className="flex items-start gap-3">
              <div className="w-4 h-4 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[8px] font-bold text-violet-600">
                  {selected.employee.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Karyawan</p>
                <p className="text-sm font-semibold text-gray-800">{selected.employee}</p>
              </div>
            </div>

            {/* Tindakan */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {actionIcon[selected.action] ?? <CheckCircle size={15} className="text-gray-400" />}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Tindakan</p>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${actionStyle[selected.action] ?? "bg-gray-100 text-gray-600"}`}>
                  {selected.action}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}