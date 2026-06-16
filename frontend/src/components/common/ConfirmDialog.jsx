import { AlertTriangle, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function ConfirmDialog({
  open,
  title = "Konfirmasi Aksi",
  message,
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  tone = "danger",
  loading = false,
  noteEnabled = false,
  noteLabel = "Catatan",
  notePlaceholder = "Tambahkan catatan opsional...",
  initialNote = "",
  onCancel,
  onConfirm,
}) {
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (open) setNote(initialNote);
  }, [open, initialNote]);

  if (!open) return null;

  const toneClass =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-violet-600 hover:bg-violet-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${
                tone === "danger"
                  ? "bg-red-50 text-red-600"
                  : "bg-violet-50 text-violet-600"
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{message}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Tutup dialog"
          >
            <X size={18} />
          </button>
        </div>

        {noteEnabled && (
          <div className="border-b border-slate-100 px-5 py-4">
            <label className="block">
              <span className="text-xs font-bold uppercase text-slate-500">
                {noteLabel}
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={notePlaceholder}
                rows={3}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-violet-100"
              />
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 p-5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="h-10 rounded-lg bg-slate-100 px-4 text-sm font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm?.(note)}
            disabled={loading}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-60 ${toneClass}`}
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
