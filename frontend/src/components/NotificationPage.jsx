// ============================================================
// NotificationPage.jsx
// Alert center — lists all system notifications with read/
// unread status indicators and timestamps.
// ============================================================

import { Bell, CheckCircle } from "lucide-react";

export default function NotificationPage({ notifications }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Notifikasi</h2>
      <p className="text-sm text-gray-400 mb-6">Pusat peringatan dan pemberitahuan sistem</p>

      <div className="space-y-3">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
              notif.read
                ? "border-gray-100 bg-gray-50"          // read: muted
                : "border-violet-200 bg-violet-50"       // unread: violet tint
            }`}
          >
            {/* Icon */}
            <div className={`mt-0.5 shrink-0 ${notif.read ? "text-gray-400" : "text-violet-500"}`}>
              {notif.read ? <CheckCircle size={18} /> : <Bell size={18} />}
            </div>

            {/* Message + time */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${notif.read ? "text-gray-500" : "text-gray-800"}`}>
                {notif.message}
              </p>
              <p className="text-xs text-gray-400 mt-1">{notif.time}</p>
            </div>

            {/* Unread dot badge */}
            {!notif.read && (
              <div className="w-2 h-2 rounded-full bg-violet-500 mt-1.5 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
