import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, X } from "lucide-react";

export default function NotificationToasts({
  notifications = [],
  enabled,
  onOpenNotifications,
}) {
  const [dismissedIds, setDismissedIds] = useState(() => new Set());
  const [knownIds, setKnownIds] = useState(() => new Set());
  const [popupIds, setPopupIds] = useState(() => new Set());

  const pendingNotifications = useMemo(
    () =>
      notifications
        .filter(
          (item) =>
            !item.read && item.status === "needs_manager",
        )
        .slice(0, 3),
    [notifications],
  );

  useEffect(() => {
    if (!enabled) return;

    setKnownIds((prev) => {
      if (prev.size === 0) {
        return new Set(pendingNotifications.map((item) => item.id));
      }

      const nextKnown = new Set(prev);
      const nextPopup = new Set(popupIds);

      pendingNotifications.forEach((item) => {
        if (!nextKnown.has(item.id)) {
          nextPopup.add(item.id);
        }
        nextKnown.add(item.id);
      });

      setPopupIds(nextPopup);
      return nextKnown;
    });
  }, [enabled, pendingNotifications, popupIds]);

  const visibleNotifications = pendingNotifications.filter(
    (item) => popupIds.has(item.id) && !dismissedIds.has(item.id),
  );

  if (!enabled || visibleNotifications.length === 0) return null;

  return (
    <div className="fixed right-5 top-5 z-50 w-[360px] max-w-[calc(100vw-2rem)] space-y-3">
      {visibleNotifications.map((notif) => (
        <div
          key={notif.id}
          className="bg-white border border-violet-100 shadow-xl rounded-xl overflow-hidden"
        >
          <div className="flex items-start gap-3 p-4">
            <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle size={19} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Bell size={13} className="text-violet-600" />
                <p className="text-xs font-bold uppercase text-violet-700">
                  Notifikasi Baru
                </p>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {notif.violationText}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {notif.camera} - dikirim oleh{" "}
                {notif.reportSentBy || "Staff Operasional"}
              </p>
            </div>

            <button
              onClick={() =>
                setDismissedIds((prev) => new Set(prev).add(notif.id))
              }
              className="text-gray-400 hover:text-gray-600"
              aria-label="Tutup notifikasi"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 border-t border-gray-100">
            <button
              onClick={() => {
                onOpenNotifications?.(notif.id);
                setDismissedIds((prev) => new Set(prev).add(notif.id));
              }}
              className="py-2.5 text-xs font-bold text-violet-700 hover:bg-violet-50"
            >
              Lihat Detail
            </button>
            <button
              onClick={() =>
                setDismissedIds((prev) => new Set(prev).add(notif.id))
              }
              className="py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50 border-l border-gray-100"
            >
              Nanti
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
