// ============================================================
// TodayViolations.jsx
// Table showing today's violations with Waktu, Pelanggaran,
// and a "Lihat" (View) action button — matching the homepage.
// ============================================================

export default function TodayViolations({ violations, onViewDetail }) {

  // Map status to badge styles
  const statusStyle = {
    Pending:   "bg-yellow-100 text-yellow-800",
    Validated: "bg-green-100  text-green-800",
    Dismissed: "bg-gray-100   text-gray-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">

      {/* Section heading */}
      <h2 className="text-xl font-bold text-gray-900 mb-5">Today Violations</h2>

      {/* Table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            {/* Column headers styled in violet-ish blue to match design */}
            <th className="pb-3 text-blue-500 font-semibold w-52">Waktu</th>
            <th className="pb-3 text-blue-500 font-semibold">Pelanggaran</th>
            <th className="pb-3 text-blue-500 font-semibold">Detail</th>
          </tr>
          {/* Thin divider line under headers */}
          <tr>
            <td colSpan={3} className="pb-2">
              <div className="h-px bg-gray-200" />
            </td>
          </tr>
        </thead>

        <tbody>
          {violations.map((row, idx) => (
            <>
              <tr key={row.id} className="text-gray-700">
                {/* Time column */}
                <td className="py-3 pr-4 text-gray-500 text-sm">{row.waktu}</td>

                {/* Violation type */}
                <td className="py-3 pr-4 font-medium">{row.pelanggaran}</td>

                {/* Action button */}
                <td className="py-3">
                  <button
                    onClick={() => onViewDetail && onViewDetail(row)}
                    className="bg-[#0d1b2a] hover:bg-[#1a2f47] text-white text-xs font-semibold px-5 py-2 rounded-full transition-colors duration-150"
                  >
                    Lihat Detail
                  </button>
                </td>
              </tr>

              {/* Divider between rows (skip after last row) */}
              {idx < violations.length - 1 && (
                <tr key={`divider-${row.id}`}>
                  <td colSpan={3}>
                    <div className="h-px bg-gray-100" />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      {/* Empty state */}
      {violations.length === 0 && (
        <p className="text-center text-gray-400 py-8 text-sm">
          Tidak ada pelanggaran hari ini.
        </p>
      )}
    </div>
  );
}