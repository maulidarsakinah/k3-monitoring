import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
} from "lucide-react";
import ViolationBadges from "../common/ViolationBadges.jsx";

function splitViolations(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item) || "Tidak diketahui";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(record, limit = 5) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function downloadExcelLikeCsv(rows) {
  const headers = [
    "ID",
    "Tanggal",
    "Waktu",
    "Kamera",
    "Pelanggaran",
    "Status",
    "Staff Pelapor",
    "Catatan Staff",
    "Validasi Oleh",
    "Catatan Validasi",
  ];
  const csv = [
    headers.join("\t"),
    ...rows.map((row) =>
      [
        row.id,
        row.date,
        row.time,
        row.camera,
        row.violation,
        row.action,
        row.reportSentBy || "",
        row.reportNote || "",
        row.validatedBy || "",
        row.note || "",
      ]
        .map((value) => String(value || "").replace(/\t/g, " "))
        .join("\t"),
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laporan_apd_${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function MetricCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center mb-4">
        <Icon size={19} />
      </div>
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function ReportsPage({
  cameraBreakdown = [],
  historyLog = [],
  hourlyBreakdown = [],
  stats = {},
  violationTypes = [],
  weeklyTrend = [],
  onOpenExport,
}) {
  const [previewLimit, setPreviewLimit] = useState(8);

  const analytics = useMemo(() => {
    const cameraRank = topEntries(countBy(historyLog, (item) => item.camera));
    const statusRank = countBy(historyLog, (item) => item.action);
    const allViolations = historyLog.flatMap((item) => splitViolations(item.violation));
    const topViolation = topEntries(countBy(allViolations, (item) => item), 1)[0];
    const topCamera = cameraRank[0];
    const topHour = [...hourlyBreakdown].sort((a, b) => b.count - a.count)[0];

    return { cameraRank, statusRank, topViolation, topCamera, topHour };
  }, [historyLog, hourlyBreakdown]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Ringkasan & Template Laporan
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Preview isi laporan sebelum export harian, mingguan, bulanan, atau tahunan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onOpenExport}
              className="h-10 inline-flex items-center gap-2 rounded-lg bg-[#0d1b2a] px-4 text-sm font-bold text-white"
            >
              <FileText size={15} />
              Export PDF/CSV
            </button>
            <button
              onClick={() => downloadExcelLikeCsv(historyLog)}
              className="h-10 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white"
            >
              <FileSpreadsheet size={15} />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          icon={CalendarDays}
          label="Pelanggaran Hari Ini"
          value={stats.totalViolationsToday || 0}
          hint="Ringkasan dashboard"
        />
        <MetricCard
          icon={TrendingUp}
          label="Top Pelanggaran"
          value={analytics.topViolation?.[0] || "-"}
          hint={analytics.topViolation ? `${analytics.topViolation[1]} kejadian` : "Belum ada data"}
        />
        <MetricCard
          icon={BarChart3}
          label="Area Paling Rawan"
          value={analytics.topCamera?.[0] || "-"}
          hint={analytics.topCamera ? `${analytics.topCamera[1]} deteksi` : "Belum ada data"}
        />
        <MetricCard
          icon={CalendarDays}
          label="Jam Rawan"
          value={analytics.topHour?.hour || "-"}
          hint={analytics.topHour ? `${analytics.topHour.count} deteksi` : "Belum ada data"}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        <section className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-900">Preview Laporan</h3>
              <p className="text-sm text-slate-400">
                Data mengikuti filter/search yang aktif di dashboard.
              </p>
            </div>
            <select
              value={previewLimit}
              onChange={(event) => setPreviewLimit(Number(event.target.value))}
              className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 outline-none"
            >
              <option value={8}>8 baris</option>
              <option value={15}>15 baris</option>
              <option value={30}>30 baris</option>
            </select>
          </div>

          <div className="overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase text-slate-400">
                  <th className="py-3 pr-4">Tanggal</th>
                  <th className="py-3 pr-4">Kamera</th>
                  <th className="py-3 pr-4">Pelanggaran</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Alur</th>
                </tr>
              </thead>
              <tbody>
                {historyLog.slice(0, previewLimit).map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 align-top">
                    <td className="py-3 pr-4 text-slate-500 whitespace-nowrap">
                      {item.date} {item.time}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                      {item.camera}
                    </td>
                    <td className="py-3 pr-4">
                      <ViolationBadges value={item.violation} layout="list" />
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {item.action}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-slate-500">
                      <div className="space-y-1">
                        <p>
                          <span className="font-semibold text-slate-700">Deteksi:</span>{" "}
                          tercatat
                        </p>
                        <p>
                          <span className="font-semibold text-slate-700">Laporan:</span>{" "}
                          {item.reportSentBy ? `dikirim ${item.reportSentBy}` : "belum dikirim"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-700">Validasi:</span>{" "}
                          {item.validatedBy ? `oleh ${item.validatedBy}` : "belum divalidasi"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Ranking Kamera</h3>
            <div className="space-y-3">
              {analytics.cameraRank.map(([camera, count], index) => (
                <div key={camera} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="font-mono text-xs text-slate-600">{camera}</span>
                  <span className="text-xs font-bold text-slate-500">{count}</span>
                </div>
              ))}
              {cameraBreakdown.length === 0 && (
                <p className="text-sm text-slate-400">Belum ada data kamera.</p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-100 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Breakdown Status</h3>
            <div className="space-y-3">
              {Object.entries(analytics.statusRank).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-sm font-semibold text-slate-700">{status}</span>
                  <span className="text-xs font-bold text-slate-500">{count}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
