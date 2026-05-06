// ============================================================
// ValidationPage.jsx
// Computer Vision detection verification queue.
// Operators can Approve or Dismiss AI-detected violations.
// ============================================================

import { useState } from "react";
import { ShieldCheck, ShieldX, Camera, Loader2 } from "lucide-react";
import { validateViolation } from "../../services/api";

export default function ValidationPage({
  validationQueue: queue,
  setValidationQueue: setQueue,
}) {
  const [loadingId, setLoadingId] = useState(null);

  // Handle operator action: "Approve" or "Dismiss"
  const handleAction = async (id, action) => {
    setLoadingId(id);
    try {
      // Map UI actions to backend actions: approve -> approved, dismiss -> rejected
      const backendAction = action === "approve" ? "approved" : "rejected";
      await validateViolation(id, backendAction, "Validated via Dashboard");

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
    } catch (err) {
      alert("Gagal melakukan validasi: " + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          Validasi Deteksi
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Verifikasi hasil deteksi Computer Vision sebelum tindak lanjut
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {queue.map((item) => {
            const isPending = item.status === "Pending";

            return (
              <div
                key={item.id}
                className="rounded-xl border border-gray-100 overflow-hidden"
              >
                {/* CCTV snapshot placeholder */}
                <div className="relative bg-[#0d1b2a] h-40 flex items-center justify-center">
                  <Camera size={40} className="text-white/20" />
                  <span className="absolute top-3 left-3 text-xs font-mono text-white/60 bg-white/10 px-2 py-0.5 rounded">
                    {item.camera}
                  </span>
                  {/* Confidence badge */}
                  <span className="absolute top-3 right-3 text-xs font-bold text-white bg-violet-600 px-2 py-0.5 rounded-full">
                    {item.confidence}% conf.
                  </span>
                  {/* Status overlay for non-pending */}
                  {!isPending && (
                    <div
                      className={`absolute inset-0 flex items-center justify-center text-white font-bold text-lg ${item.status === "Validated" ? "bg-green-900/60" : "bg-gray-900/60"}`}
                    >
                      {item.status === "Validated"
                        ? "✓ Validated"
                        : "✕ Dismissed"}
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4 space-y-2">
                  <p className="font-semibold text-gray-800 text-sm">
                    {item.detectedViolation}
                  </p>
                  <p className="text-xs text-gray-400">{item.time}</p>

                  {/* Action buttons — only shown when pending */}
                  {isPending && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleAction(item.id, "approve")}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors"
                      >
                        <ShieldCheck size={13} />
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(item.id, "dismiss")}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold py-2 rounded-lg transition-colors"
                      >
                        <ShieldX size={13} />
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {queue.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">
            Tidak ada item yang menunggu validasi.
          </p>
        )}
      </div>
    </div>
  );
}
