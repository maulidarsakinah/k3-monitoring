import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  MapPin,
  XCircle,
} from "lucide-react";
import ViolationBadges from "./common/ViolationBadges.jsx";

const statusStyle = {
  detected: "bg-blue-50 text-blue-800 border-blue-100",
  staff_reviewed: "bg-slate-100 text-slate-700 border-slate-200",
  needs_manager: "bg-violet-50 text-violet-800 border-violet-100",
  pending: "bg-yellow-50 text-yellow-800 border-yellow-100",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-100",
  rejected: "bg-slate-100 text-slate-600 border-slate-200",
};

const severityStyle = {
  low: "bg-amber-50 text-amber-700 border-amber-100",
  medium: "bg-orange-50 text-orange-700 border-orange-100",
  high: "bg-red-50 text-red-700 border-red-100",
  none: "bg-slate-50 text-slate-600 border-slate-100",
};

const statusIcon = {
  pending: AlertTriangle,
  approved: CheckCircle2,
  rejected: XCircle,
};

function NotificationIcon({ status, read }) {
  const Icon = statusIcon[status] || Bell;

  return (
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
        read ? "bg-slate-100 text-slate-500" : "bg-violet-100 text-violet-600"
      }`}
    >
      <Icon size={18} />
    </div>
  );
}

function ViolationList({ violations }) {
  return (
    <ViolationBadges
      value={violations}
      emptyLabel="Pelanggaran APD"
      layout="list"
    />
  );
}

export default function NotificationPage({
  notifications = [],
  onMarkAllRead,
  onMarkRead,
}) {
  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notifikasi</h2>
          <p className="text-sm text-gray-500 mt-1">
            Daftar peringatan pelanggaran dan perubahan status validasi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-fit text-xs font-bold bg-violet-50 text-violet-700 border border-violet-100 px-3 py-1.5 rounded-full">
            {unreadCount} belum dibaca
          </span>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full"
            >
              Tandai dibaca
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <Bell size={34} className="mx-auto text-gray-400 mb-3" />
          <h3 className="font-bold text-gray-900">Belum ada notifikasi</h3>
          <p className="text-sm text-gray-500 mt-1">
            Peringatan baru akan muncul setelah kamera mendeteksi pelanggaran.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
          {notifications.map((notif) => (
            <article
              key={notif.id}
              onClick={() => onMarkRead?.(notif.id)}
              className={`grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_auto] gap-4 p-4 transition-colors hover:bg-slate-50 ${
                notif.read ? "bg-white" : "bg-violet-50/70"
              }`}
            >
              <NotificationIcon status={notif.status} read={notif.read} />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="min-w-0 text-sm font-bold text-gray-900 break-words">
                    {notif.title}
                  </h3>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      statusStyle[notif.status] || statusStyle.pending
                    }`}
                  >
                    {notif.statusText}
                  </span>
                  {!notif.read && (
                    <span className="text-[10px] font-bold uppercase bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                      Baru
                    </span>
                  )}
                  {notif.severity && notif.severity !== "none" && (
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase ${
                        severityStyle[notif.severity] || severityStyle.none
                      }`}
                    >
                      {notif.severity}
                    </span>
                  )}
                </div>

                <ViolationList violations={notif.violations} />

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} />
                    <span className="min-w-0 font-mono break-words">
                      {notif.camera}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 lg:hidden">
                    <Clock size={13} />
                    {notif.time}
                  </span>
                </div>

                {notif.summary && (
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed break-words">
                    {notif.summary}
                  </p>
                )}
              </div>

              <div className="hidden lg:flex flex-col items-end justify-start text-right">
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                  <Clock size={13} />
                  {notif.time}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
