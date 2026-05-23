import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  ShieldCheck,
  ShieldX,
  XCircle,
} from "lucide-react";
import {
  canSubmitReport,
  canValidate,
  staffReviewViolation,
  submitViolationReport,
  validateViolation,
} from "../services/api.js";
import ConfirmDialog from "./common/ConfirmDialog.jsx";
import ViolationBadges from "./common/ViolationBadges.jsx";

const statusStyle = {
  Detected: "bg-blue-50 text-blue-800 border-blue-100",
  Pending: "bg-yellow-50 text-yellow-800 border-yellow-100",
  "Staff Reviewed": "bg-slate-100 text-slate-700 border-slate-200",
  "Needs Manager": "bg-violet-50 text-violet-800 border-violet-100",
  Validated: "bg-emerald-50 text-emerald-800 border-emerald-100",
  Dismissed: "bg-slate-100 text-slate-600 border-slate-200",
};

const statusLabel = {
  Detected: "Review Staff",
  Pending: "Menunggu",
  "Staff Reviewed": "Selesai Staff",
  "Needs Manager": "Perlu Manager",
  Validated: "Disetujui",
  Dismissed: "Ditolak",
};

function ValidationStats({ items, mode }) {
  const stats = useMemo(
    () => ({
      total: items.length,
      pending: items.filter((item) => ["Detected", "Pending"].includes(item.status)).length,
      reported: items.filter((item) => item.rawStatus === "needs_manager").length,
      reviewed: items.filter((item) => item.rawStatus === "staff_reviewed").length,
      validated: items.filter((item) => item.status === "Validated").length,
      dismissed: items.filter((item) => item.status === "Dismissed").length,
    }),
    [items],
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        {
          label: mode === "manager" ? "Perlu Validasi" : "Incident Baru",
          value: stats.total,
        },
        { label: mode === "manager" ? "Needs Manager" : "Perlu Review", value: stats.pending },
        { label: mode === "manager" ? "Dikirim Staff" : "Dikirim Manager", value: stats.reported },
        { label: "Selesai Staff", value: stats.reviewed },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase">
            {item.label}
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function EvidencePreview({ item }) {
  return (
    <div className="relative bg-[#0d1b2a] h-56 rounded-xl overflow-hidden flex items-center justify-center">
      {item.evidenceUrl ? (
        <img
          src={item.evidenceUrl}
          alt={`Bukti pelanggaran ${item.camera}`}
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Camera size={44} className="text-white/20" />
          <span className="text-white/40 text-[10px] font-bold uppercase">
            Bukti belum tersedia
          </span>
        </div>
      )}
      <span className="absolute top-3 left-3 text-xs font-mono text-white/70 bg-white/10 px-2 py-1 rounded">
        {item.camera}
      </span>
      <span
        className={`absolute top-3 right-3 text-xs font-bold px-3 py-1 rounded-full border ${
          statusStyle[item.status] || statusStyle.Pending
        }`}
      >
        {statusLabel[item.status] || item.status}
      </span>
      <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-4 py-3">
        <p className="text-white/80 text-xs font-mono">{item.time}</p>
      </div>
    </div>
  );
}

function ViolationTags({ value }) {
  return <ViolationBadges value={value} />;
}

function QueueItem({ item, active, checked, onCheck, onSelect }) {
  const StatusIcon =
    item.status === "Validated"
      ? CheckCircle2
      : item.status === "Dismissed"
        ? XCircle
        : AlertCircle;

  return (
    <div
      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
        active
          ? "border-violet-300 bg-violet-50"
          : "border-gray-100 bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onCheck(item.id, event.target.checked)}
          className="mt-1"
          aria-label={`Pilih item ${item.id}`}
        />
        <div className="min-w-0">
          <button
            onClick={() => onSelect(item.id)}
            className="text-left"
            type="button"
          >
            <ViolationTags value={item.detectedViolation} />
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="font-mono">{item.camera}</span>
            <span>{item.time}</span>
            {item.reportSent && (
              <span className="font-semibold text-violet-600">
                Masuk manager
              </span>
            )}
            {item.occurrenceCount > 1 && (
              <span className="font-semibold text-amber-600">
                {item.occurrenceCount} kejadian
              </span>
            )}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
            statusStyle[item.status] || statusStyle.Pending
          }`}
        >
          <StatusIcon size={12} />
          {statusLabel[item.status] || item.status}
        </span>
      </div>
    </div>
  );
}

export default function ValidationPage({
  validationQueue: queue,
  setValidationQueue: setQueue,
  user,
  onValidated,
}) {
  const [loadingId, setLoadingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const allowedToValidate = canValidate(user?.role);
  const allowedToSubmitReport = canSubmitReport(user?.role);
  const mode = allowedToValidate ? "manager" : "staff";
  const isManagerQueueItem = (item) =>
    item.rawStatus === "needs_manager" || (item.rawStatus === "pending" && item.reportSent);

  useEffect(() => {
    if (!queue.length) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !queue.some((item) => item.id === selectedId)) {
      setSelectedId(queue[0].id);
    }
  }, [queue, selectedId]);

  const selected = queue.find((item) => item.id === selectedId) || null;

  const actionableIds = queue
    .filter((item) => ["Detected", "Pending", "Needs Manager"].includes(item.status))
    .filter((item) =>
      allowedToValidate
        ? isManagerQueueItem(item)
        : allowedToSubmitReport && ["detected", "pending"].includes(item.rawStatus),
    )
    .map((item) => item.id);

  const checkedActionableIds = checkedIds.filter((id) => actionableIds.includes(id));

  const handleCheck = (id, checked) => {
    setCheckedIds((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id),
    );
  };

  const toggleAll = () => {
    setCheckedIds((prev) =>
      checkedActionableIds.length === actionableIds.length ? [] : actionableIds,
    );
  };

  const confirmAndRun = ({
    title,
    message,
    confirmLabel,
    tone = "primary",
    noteEnabled = true,
    initialNote = "",
    noteLabel = "Catatan",
    task,
  }) => {
    setConfirmState({
      title,
      message,
      confirmLabel,
      tone,
      noteEnabled,
      initialNote,
      noteLabel,
      task,
    });
  };

  const handleConfirmAction = async (note) => {
    if (!confirmState?.task) return;
    await confirmState.task(note);
    setConfirmState(null);
  };

  const handleAction = (id, action) => {
    const label = action === "approve" ? "setujui" : "tolak";
    confirmAndRun({
      title: action === "approve" ? "Setujui Laporan" : "Tolak Laporan",
      message: `Laporan ini akan di-${label} oleh Manager.`,
      confirmLabel: action === "approve" ? "Setujui" : "Tolak",
      tone: action === "approve" ? "primary" : "danger",
      initialNote: action === "approve" ? "Disetujui Manager" : "Ditolak Manager",
      task: async (note) => {
        const finalNote = note || (action === "approve" ? "Disetujui Manager" : "Ditolak Manager");
        setLoadingId(id);
        setErrorMessage("");
        try {
          const backendAction = action === "approve" ? "approved" : "rejected";
          await validateViolation(id, backendAction, finalNote);

          setQueue((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: action === "approve" ? "Validated" : "Dismissed",
                  }
                : item,
            ),
          );
          onValidated?.();
        } catch (err) {
          setErrorMessage(err.message || "Gagal memproses validasi.");
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  const handleSubmitReport = (id) => {
    confirmAndRun({
      title: "Kirim ke Manager",
      message: "Incident ini akan masuk antrean Manager untuk validasi formal.",
      confirmLabel: "Kirim Manager",
      tone: "primary",
      initialNote: "Dikirim Staff Operasional untuk proses validasi manager",
      task: async (note) => {
        const finalNote = note || "Dikirim Staff Operasional untuk proses validasi manager";
        setLoadingId(id);
        setErrorMessage("");
        try {
          const response = await submitViolationReport(id, finalNote);

          setQueue((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    rawStatus: "needs_manager",
                    status: "Needs Manager",
                    reportSent: true,
                    reportSentBy: response.violation?.report_sent_by || user?.username,
                    reportSentAt: "Baru saja",
                    reportNote: response.violation?.report_note,
                  }
                : item,
            ),
          );
          onValidated?.();
        } catch (err) {
          setErrorMessage(err.message || "Gagal mengirim laporan ke manager.");
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  const handleStaffReview = (id) => {
    confirmAndRun({
      title: "Review Internal",
      message: "Incident ini akan ditandai selesai di level Staff dan tidak dikirim ke Manager.",
      confirmLabel: "Selesaikan",
      tone: "primary",
      initialNote: "Incident valid dan cukup ditangani di level staff",
      task: async (note) => {
        const finalNote = note || "Incident valid dan cukup ditangani di level staff";
        setLoadingId(id);
        setErrorMessage("");
        try {
          await staffReviewViolation(id, finalNote);
          setQueue((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    rawStatus: "staff_reviewed",
                    status: "Staff Reviewed",
                    staffReviewedBy: user?.username,
                    staffReviewedAt: "Baru saja",
                    staffNote: finalNote,
                  }
                : item,
            ),
          );
          onValidated?.();
        } catch (err) {
          setErrorMessage(err.message || "Gagal menyimpan review staff.");
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  const handleBulkSubmit = () => {
    if (checkedActionableIds.length === 0) return;
    confirmAndRun({
      title: "Kirim Banyak Laporan",
      message: `${checkedActionableIds.length} laporan akan dikirim ke Manager.`,
      confirmLabel: "Kirim Semua",
      tone: "primary",
      initialNote: "Dikirim Staff Operasional untuk proses validasi manager",
      task: async (note) => {
        const finalNote = note || "Dikirim Staff Operasional untuk proses validasi manager";
        setLoadingId("bulk");
        setErrorMessage("");
        try {
          await Promise.all(checkedActionableIds.map((id) => submitViolationReport(id, finalNote)));
          setCheckedIds([]);
          onValidated?.();
        } catch (err) {
          setErrorMessage(err.message || "Gagal mengirim laporan terpilih.");
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  const handleBulkStaffReview = () => {
    if (checkedActionableIds.length === 0) return;
    confirmAndRun({
      title: "Review Internal Massal",
      message: `${checkedActionableIds.length} incident akan ditandai selesai di level Staff.`,
      confirmLabel: "Selesaikan",
      tone: "primary",
      initialNote: "Incident valid dan cukup ditangani di level staff",
      task: async (note) => {
        const finalNote = note || "Incident valid dan cukup ditangani di level staff";
        setLoadingId("bulk");
        setErrorMessage("");
        try {
          await Promise.all(checkedActionableIds.map((id) => staffReviewViolation(id, finalNote)));
          setCheckedIds([]);
          onValidated?.();
        } catch (err) {
          setErrorMessage(err.message || "Gagal mereview incident terpilih.");
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  const handleBulkValidate = (action) => {
    if (checkedActionableIds.length === 0) return;
    const label = action === "approved" ? "setujui" : "tolak";
    confirmAndRun({
      title: action === "approved" ? "Setujui Massal" : "Tolak Massal",
      message: `${checkedActionableIds.length} laporan akan di-${label}.`,
      confirmLabel: action === "approved" ? "Setujui Semua" : "Tolak Semua",
      tone: action === "approved" ? "primary" : "danger",
      initialNote: action === "approved" ? "Disetujui Manager" : "Ditolak Manager",
      task: async (note) => {
        const finalNote = note || (action === "approved" ? "Disetujui Manager" : "Ditolak Manager");
        setLoadingId("bulk");
        setErrorMessage("");
        try {
          await Promise.all(checkedActionableIds.map((id) => validateViolation(id, action, finalNote)));
          setCheckedIds([]);
          onValidated?.();
        } catch (err) {
          setErrorMessage(err.message || "Gagal memvalidasi laporan terpilih.");
        } finally {
          setLoadingId(null);
        }
      },
    });
  };

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        loading={Boolean(loadingId)}
        noteEnabled={confirmState?.noteEnabled}
        initialNote={confirmState?.initialNote}
        noteLabel={confirmState?.noteLabel}
        onCancel={() => setConfirmState(null)}
        onConfirm={handleConfirmAction}
      />

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {allowedToValidate
                ? "Validasi Laporan Staff"
                : "Review Incident Staff"}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {allowedToValidate
                ? "Manager hanya menerima incident tertentu yang dikirim Staff Operasional."
                : "Review incident. Kirim ke Manager hanya jika perlu keputusan formal."}
            </p>
          </div>

          {!allowedToValidate && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 max-w-xl">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>
                {allowedToSubmitReport
                  ? `Role ${user?.roleLabel || user?.role} dapat mengirim laporan ke Manager. Proses setujui atau tolak hanya dilakukan Manager.`
                  : `Role ${user?.roleLabel || user?.role} hanya dapat melihat antrean validasi.`}
              </span>
            </div>
          )}
        </div>

        <ValidationStats items={queue} mode={mode} />

        {errorMessage && (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {queue.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <ShieldCheck size={36} className="mx-auto text-emerald-500 mb-3" />
          <h3 className="font-bold text-gray-900">
            {allowedToValidate
              ? "Belum ada laporan dari staff"
              : "Tidak ada incident baru untuk direview"}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {allowedToValidate
              ? "Laporan akan muncul setelah Staff Operasional mengirimkannya."
              : "Incident baru akan muncul setelah sistem mendeteksi pelanggaran."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-900">
                  {allowedToValidate ? "Incident untuk Manager" : "Incident Perlu Review"}
                </h3>
                <button
                  onClick={toggleAll}
                  className="mt-1 text-xs font-bold text-violet-600"
                >
                  {checkedActionableIds.length === actionableIds.length
                    ? "Batalkan pilihan"
                    : "Pilih semua yang bisa diproses"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {checkedActionableIds.length}/{queue.length} dipilih
                </span>
                {allowedToSubmitReport && (
                  <>
                    <button
                      disabled={checkedActionableIds.length === 0 || loadingId === "bulk"}
                      onClick={handleBulkStaffReview}
                      className="h-9 px-3 rounded-lg bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-bold"
                    >
                      Review Internal
                    </button>
                    <button
                      disabled={checkedActionableIds.length === 0 || loadingId === "bulk"}
                      onClick={handleBulkSubmit}
                      className="h-9 px-3 rounded-lg bg-violet-600 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-bold"
                    >
                      Kirim Manager
                    </button>
                  </>
                )}
                {allowedToValidate && (
                  <>
                    <button
                      disabled={checkedActionableIds.length === 0 || loadingId === "bulk"}
                      onClick={() => handleBulkValidate("approved")}
                      className="h-9 px-3 rounded-lg bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-bold"
                    >
                      Setujui
                    </button>
                    <button
                      disabled={checkedActionableIds.length === 0 || loadingId === "bulk"}
                      onClick={() => handleBulkValidate("rejected")}
                      className="h-9 px-3 rounded-lg bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold"
                    >
                      Tolak
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {queue.map((item) => (
                <QueueItem
                  key={item.id}
                  item={item}
                  active={item.id === selectedId}
                  checked={checkedIds.includes(item.id)}
                  onCheck={handleCheck}
                  onSelect={setSelectedId}
                />
              ))}
            </div>
          </div>

          {selected && (
            <aside className="bg-white rounded-2xl border border-gray-100 p-6 xl:sticky xl:top-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">
                    Detail Validasi
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    ID #{selected.id}
                  </p>
                  {selected.occurrenceCount > 1 && (
                    <p className="text-xs text-amber-600 font-semibold mt-1">
                      Incident gabungan: {selected.occurrenceCount} kejadian
                    </p>
                  )}
                </div>
                <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  {selected.confidence}% confidence
                </span>
                <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full uppercase">
                  {selected.severity || "none"}
                </span>
              </div>

              <EvidencePreview item={selected} />

              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 mb-2">
                    Jenis Pelanggaran
                  </p>
                  <ViolationTags value={selected.detectedViolation} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-gray-500">Kamera</p>
                    <p className="text-sm font-mono font-semibold text-gray-800">
                      {selected.camera}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-gray-500">Terakhir Terdeteksi</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {selected.lastDetectedAt || selected.time}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-gray-500">Pertama Terdeteksi</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {selected.firstDetectedAt || selected.time}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-gray-500">Jumlah Kejadian</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {selected.occurrenceCount || 1} kali
                    </p>
                  </div>
                </div>

                {selected.summary && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs text-gray-500 mb-1">Ringkasan</p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {selected.summary}
                    </p>
                  </div>
                )}

                {selected.reportSent && (
                  <div className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-violet-500 mb-1">
                      Laporan Staff
                    </p>
                    <p className="text-sm font-semibold text-violet-900">
                      Dikirim oleh {selected.reportSentBy || "Staff Operasional"}
                    </p>
                    {selected.reportSentAt && (
                      <p className="text-xs text-violet-700 mt-1">
                        {selected.reportSentAt}
                      </p>
                    )}
                    {selected.reportNote && (
                      <p className="text-xs text-violet-700 mt-1">
                        {selected.reportNote}
                      </p>
                    )}
                  </div>
                )}

                {selected.staffReviewedBy && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-emerald-600 mb-1">
                      Review Staff
                    </p>
                    <p className="text-sm font-semibold text-emerald-900">
                      Direview oleh {selected.staffReviewedBy}
                    </p>
                    {selected.staffReviewedAt && (
                      <p className="text-xs text-emerald-700 mt-1">
                        {selected.staffReviewedAt}
                      </p>
                    )}
                    {selected.staffNote && (
                      <p className="text-xs text-emerald-700 mt-1">
                        {selected.staffNote}
                      </p>
                    )}
                  </div>
                )}

                {isManagerQueueItem(selected) && allowedToValidate ? (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => handleAction(selected.id, "approve")}
                      disabled={loadingId === selected.id}
                      className="h-10 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      {loadingId === selected.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={15} />
                      )}
                      Setujui
                    </button>
                    <button
                      onClick={() => handleAction(selected.id, "dismiss")}
                      disabled={loadingId === selected.id}
                      className="h-10 flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 disabled:opacity-60 text-slate-700 text-xs font-bold rounded-lg transition-colors"
                    >
                      {loadingId === selected.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <ShieldX size={15} />
                      )}
                      Tolak
                    </button>
                  </div>
                ) : ["detected", "pending"].includes(selected.rawStatus) && allowedToSubmitReport ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <button
                      onClick={() => handleStaffReview(selected.id)}
                      disabled={loadingId === selected.id}
                      className="h-10 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      {loadingId === selected.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={15} />
                      )}
                      Review Internal
                    </button>
                    <button
                      onClick={() => handleSubmitReport(selected.id)}
                      disabled={loadingId === selected.id || selected.reportSent}
                      className="h-10 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      {loadingId === selected.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Send size={15} />
                      )}
                      Kirim Manager
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    <Clock size={16} />
                    <span>
                      {["Detected", "Pending", "Needs Manager"].includes(selected.status)
                        ? "Item ini menunggu validasi manager."
                        : `Item sudah ${statusLabel[selected.status]?.toLowerCase() || selected.status}.`}
                    </span>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
