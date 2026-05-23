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
  notifications,
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
              className={`grid grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto] gap-4 p-4 ${
                notif.read ? "bg-white" : "bg-violet-50/70"
              }`}
            >
              <NotificationIcon status={notif.status} read={notif.read} />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-sm font-bold text-gray-900">
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
                </div>

                <ViolationList violations={notif.violations} />

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} />
                    <span className="font-mono">{notif.camera}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={13} />
                    {notif.time}
                  </span>
                </div>

                {notif.summary && (
                  <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                    {notif.summary}
                  </p>
                )}
              </div>

              <div className="hidden lg:flex flex-col items-end justify-between text-right">
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {notif.time}
                </span>
                <span className="text-[10px] font-semibold text-gray-500">
                  ID #{notif.id}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
