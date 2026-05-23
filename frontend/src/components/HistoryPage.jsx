// ============================================================
// HistoryPage.jsx
// Full event log table + an inline detail panel that slides
// open when the operator clicks "Detail" on any row.
//
// Detail panel shows:
//   - Photo evidence (CCTV snapshot placeholder)
//   - Violation type
//   - Full timestamp
//   - Camera
//   - Action taken
// ============================================================

import { useState, useEffect } from "react";
import {
  X,
  Camera,
  Clock,
  Tv2,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
} from "lucide-react";
import ViolationBadges from "./common/ViolationBadges.jsx";
import PaginationControls from "./common/PaginationControls.jsx";

const COMMENT_KEY = "violation_internal_comments";

function loadComments() {
  try {
    return JSON.parse(localStorage.getItem(COMMENT_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveComments(comments) {
  localStorage.setItem(COMMENT_KEY, JSON.stringify(comments));
}

export default function HistoryPage({
  historyLog,
  currentPage: serverPage,
  itemsPerPage: serverItemsPerPage,
  onPageChange,
  selectedId = null,
  totalItems,
}) {
  // Which row's detail panel is open (null = none)
  const [detailId, setDetailId] = useState(selectedId);
  const [comments, setComments] = useState(loadComments);
  const [commentDraft, setCommentDraft] = useState("");

  // Pagination state
  const [localPage, setLocalPage] = useState(1);
  const itemsPerPage = serverItemsPerPage || 10;
  const currentPage = serverPage || localPage;
  const handlePageChange = onPageChange || setLocalPage;
  const totalHistoryItems = totalItems ?? historyLog.length;

  // Reset to page 1 if data changes
  useEffect(() => {
    if (!onPageChange) setLocalPage(1);
  }, [historyLog]);

  // Sync internal state if selectedId prop changes (from Dashboard)
  useEffect(() => {
    if (selectedId) setDetailId(selectedId);
  }, [selectedId]);

  // Find the currently selected record
  const selected = historyLog.find((r) => r.id === detailId) ?? null;
  const selectedComments = selected ? comments[selected.id] || [] : [];

  const addComment = () => {
    if (!selected || !commentDraft.trim()) return;
    const next = {
      ...comments,
      [selected.id]: [
        ...(comments[selected.id] || []),
        {
          id: Date.now(),
          text: commentDraft.trim(),
          createdAt: new Date().toLocaleString("id-ID"),
        },
      ],
    };
    setComments(next);
    saveComments(next);
    setCommentDraft("");
  };

  // Pagination logic
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLog = onPageChange
    ? historyLog
    : historyLog.slice(startIndex, startIndex + itemsPerPage);

  // Badge color per action type
  const actionStyle = {
    Notified: "bg-blue-100   text-blue-800",
    "Warning Issued": "bg-orange-100 text-orange-800",
    Dismissed: "bg-gray-100   text-gray-600",
    Pending: "bg-yellow-100 text-yellow-800",
    Detected: "bg-blue-100 text-blue-800",
    "Staff Reviewed": "bg-slate-100 text-slate-700",
    "Needs Manager": "bg-violet-100 text-violet-800",
    Validated: "bg-green-100 text-green-800",
  };
  const severityStyle = {
    none: "bg-slate-100 text-slate-500",
    low: "bg-emerald-100 text-emerald-700",
    medium: "bg-amber-100 text-amber-700",
    high: "bg-red-100 text-red-700",
  };

  // Icon per action for the detail panel
  const actionIcon = {
    Notified: <CheckCircle size={15} className="text-blue-500" />,
    "Warning Issued": <AlertTriangle size={15} className="text-orange-500" />,
    Dismissed: <X size={15} className="text-gray-500" />,
    Pending: <AlertTriangle size={15} className="text-yellow-500" />,
    Validated: <CheckCircle size={15} className="text-green-500" />,
  };

  return (
    // Side-by-side: table on the left, detail panel on the right
    <div className="flex gap-5 items-start">
      {/* ── LEFT: History Table ── */}
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col h-[800px]">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          Riwayat Pelanggaran
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Log lengkap semua kejadian yang terdeteksi
        </p>

        {/* Scrollable on small screens */}
        <div className="overflow-auto flex-1 border-b border-gray-50">
          <table className="w-full text-sm min-w-[680px]">
            <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
              <tr className="border-b border-gray-100 bg-white">
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4 w-28">
                  Tanggal
                </th>
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4 w-20">
                  Waktu
                </th>
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4">
                  Pelanggaran
                </th>
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4 w-28">
                  Kamera
                </th>
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4 w-36">
                  Tindakan
                </th>
                <th className="pb-3 text-left text-blue-500 font-semibold pr-4 w-24">
                  Severity
                </th>
                <th className="pb-3 text-left text-blue-500 font-semibold w-24">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedLog.map((row) => {
                const isActive = row.id === detailId;

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-50 transition-colors ${
                      isActive ? "bg-violet-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="py-3 pr-4 text-gray-700 font-mono font-medium whitespace-nowrap">
                      {row.time}
                    </td>
                    <td className="py-3 pr-4 text-gray-700">
                <ViolationBadges value={row.violation} layout="list" />
                    </td>
                    <td className="py-3 pr-4 text-gray-500 font-mono text-xs">
                      {row.camera}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${actionStyle[row.action] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {row.action}
                      </span>
                      {row.autoReviewed && (
                        <span className="ml-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                          Auto Review
                        </span>
                      )}
                    </td>

                    <td className="py-3 pr-4">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${severityStyle[row.severity] ?? severityStyle.none}`}
                      >
                        {row.severity || "none"}
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

        <PaginationControls
          currentPage={currentPage}
          itemLabel="kejadian"
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          totalItems={totalHistoryItems}
        />
      </div>

      {/* ── RIGHT: Detail Panel ── */}
      {selected && (
        <div className="w-72 shrink-0 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-sm">
              Detail Pelanggaran
            </h3>
            <button
              onClick={() => setDetailId(null)}
              className="text-gray-500 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* ── Photo Evidence ── */}
          <div className="relative bg-[#0d1b2a] h-44 flex flex-col items-center justify-center gap-2 overflow-hidden">
            {selected.evidenceUrl ? (
              <img
                src={selected.evidenceUrl}
                alt={`Bukti pelanggaran ${selected.camera}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <>
                <Camera size={36} className="text-white/20" />
                <span className="text-white/40 text-[10px]">
                  BUKTI BELUM TERSEDIA
                </span>
              </>
            )}

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
              <AlertTriangle
                size={16}
                className="text-red-400 mt-0.5 shrink-0"
              />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Tipe Pelanggaran</p>
                <ViolationBadges value={selected.violation} layout="list" />
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-3">
              <p className="text-xs font-bold uppercase text-gray-500 mb-3">
                Alur Pelanggaran
              </p>
              <div className="space-y-3 text-xs">
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold">1</span>
                  <div>
                    <p className="font-bold text-gray-800">Terdeteksi kamera</p>
                    <p className="text-gray-500">{selected.date} {selected.time}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold">2</span>
                  <div>
                    <p className="font-bold text-gray-800">
                      {selected.reportSentBy ? "Dikirim staff" : "Belum dikirim staff"}
                    </p>
                    <p className="text-gray-500">
                      {selected.reportSentBy
                        ? `${selected.reportSentBy} - ${selected.reportSentAt}`
                        : "Menunggu staff operasional"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">3</span>
                  <div>
                    <p className="font-bold text-gray-800">
                      {selected.validatedBy ? "Divalidasi manager" : "Belum divalidasi"}
                    </p>
                    <p className="text-gray-500">
                      {selected.validatedBy || "Menunggu keputusan manager"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamp */}
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={16}
                className="text-amber-400 mt-0.5 shrink-0"
              />
              <div>
                <p className="text-xs text-gray-500 mb-1">Severity</p>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${severityStyle[selected.severity] ?? severityStyle.none}`}
                >
                  {selected.severity || "none"}
                </span>
              </div>
            </div>

            {/* Timestamp */}
            <div className="flex items-start gap-3">
              <Clock size={16} className="text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Timestamp</p>
                <p className="text-sm font-semibold text-gray-800">
                  {selected.summary || selected.date + ", " + selected.time}
                </p>
              </div>
            </div>

            {/* Kamera */}
            <div className="flex items-start gap-3">
              <Tv2 size={16} className="text-violet-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Kamera</p>
                <p className="text-sm font-semibold text-gray-800 font-mono">
                  {selected.camera}
                </p>
              </div>
            </div>

            {/* Tindakan */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {actionIcon[selected.action] ?? (
                  <CheckCircle size={15} className="text-gray-500" />
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Tindakan</p>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${actionStyle[selected.action] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {selected.action}
                </span>
              </div>
            </div>

            {selected.validatedBy && (
              <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                <p className="text-xs text-gray-500 mb-1">Validasi</p>
                <p className="text-xs font-semibold text-gray-700">
                  Oleh {selected.validatedBy}
                </p>
                {selected.note && (
                  <p className="text-xs text-gray-500 mt-1">{selected.note}</p>
                )}
              </div>
            )}

            {selected.autoReviewed && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                <p className="text-xs font-bold uppercase text-emerald-700 mb-1">
                  Auto Review
                </p>
                <p className="text-xs text-emerald-800">
                  Incident ini selesai otomatis oleh sistem karena confidence tinggi.
                </p>
                {selected.staffNote && (
                  <p className="text-xs text-emerald-800 mt-1">{selected.staffNote}</p>
                )}
              </div>
            )}

            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-3">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={15} className="text-violet-500" />
                <p className="text-xs font-bold uppercase text-gray-500">
                  Komentar Internal
                </p>
              </div>
              <div className="space-y-2 mb-3">
                {selectedComments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-white border border-slate-100 px-3 py-2">
                    <p className="text-xs text-gray-700">{comment.text}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{comment.createdAt}</p>
                  </div>
                ))}
                {selectedComments.length === 0 && (
                  <p className="text-xs text-gray-500">
                    Belum ada komentar.
                  </p>
                )}
              </div>
              <textarea
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
                placeholder="Tulis komentar internal..."
              />
              <button
                onClick={addComment}
                className="mt-2 w-full h-8 rounded-lg bg-violet-600 text-white text-xs font-bold"
              >
                Simpan Komentar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
