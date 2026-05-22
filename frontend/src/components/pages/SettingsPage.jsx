import { TimerReset } from "lucide-react";

export default function SettingsPage({
  reminderHours,
  onReminderHoursChange,
}) {
  return (
    <div className="space-y-5">
      <section className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-xl font-bold text-slate-900">Pengaturan</h2>
        <p className="text-sm text-slate-400 mt-1">
          Preferensi tampilan dan reminder validasi untuk dashboard.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="bg-white rounded-2xl border border-slate-100 p-6">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-4">
            <TimerReset size={18} />
          </div>
          <h3 className="font-bold text-slate-900">Reminder Validasi</h3>
          <p className="text-sm text-slate-400 mt-1">
            Laporan yang belum divalidasi lebih dari batas ini akan ditandai sebagai SLA lewat.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <input
              type="number"
              min="1"
              max="168"
              value={reminderHours}
              onChange={(event) => onReminderHoursChange(Number(event.target.value))}
              className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold outline-none"
            />
            <span className="text-sm text-slate-500">jam</span>
          </div>
        </section>
      </div>
    </div>
  );
}
