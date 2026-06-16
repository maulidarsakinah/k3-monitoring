import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import ViolationBadges from "../common/ViolationBadges.jsx";

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

export default function ReportsPage({ historyLog = [], onOpenExport }) {
  const [previewLimit, setPreviewLimit] = useState(10);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Generate Laporan</h2>
            <p className="text-sm text-slate-500 mt-1">
              Fokus untuk export data pelanggaran. Analitik dan tren ada di halaman Statistik.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onOpenExport}
              className="h-10 inline-flex items-center gap-2 rounded-lg bg-[#0d1b2a] px-4 text-sm font-bold text-white"
            >
              <Download size={15} />
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center mb-4">
            <FileText size={19} />
          </div>
          <p className="text-xs font-bold uppercase text-slate-500">Data Termuat</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{historyLog.length}</p>
          <p className="text-xs text-slate-500 mt-1">mengikuti filter/search aktif</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 md:col-span-2">
          <p className="text-xs font-bold uppercase text-slate-500 mb-2">Format Tersedia</p>
          <div className="flex flex-wrap gap-2">
            {["PDF", "CSV", "Excel"].map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {item}
              </span>
            ))}
          </div>
          <p className="text-sm text-slate-500 mt-3">
            Pilih rentang harian, mingguan, bulanan, tahunan, atau kustom melalui dialog export.
          </p>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-900">Preview Data Laporan</h3>
            <p className="text-sm text-slate-500">
              Tabel ini hanya preview. Filter detail tersedia saat export.
            </p>
          </div>
          <select
            value={previewLimit}
            onChange={(event) => setPreviewLimit(Number(event.target.value))}
            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 outline-none"
          >
            <option value={10}>10 baris</option>
            <option value={25}>25 baris</option>
            <option value={50}>50 baris</option>
          </select>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase text-slate-500">
                <th className="py-3 pr-4">Tanggal</th>
                <th className="py-3 pr-4">Kamera</th>
                <th className="py-3 pr-4">Pelanggaran</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Validasi</th>
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
                    {item.autoReviewed && (
                      <span className="ml-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                        Auto Review
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-xs text-slate-500">
                    {item.autoReviewed
                      ? "Auto-reviewed by system"
                      : item.validatedBy
                      ? `oleh ${item.validatedBy}`
                      : "Belum divalidasi"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {historyLog.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-8">
            Belum ada data laporan.
          </p>
        )}
      </section>
    </div>
  );
}
