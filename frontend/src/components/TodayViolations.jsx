import ViolationBadges from "./common/ViolationBadges.jsx";

export default function TodayViolations({ violations, onViewDetail }) {
  // Map status to badge styles
  const statusStyle = {
    Detected: "bg-blue-100 text-blue-800",
    Pending: "bg-yellow-100 text-yellow-800",
    "Staff Reviewed": "bg-slate-100 text-slate-700",
    "Needs Manager": "bg-violet-100 text-violet-800",
    Validated: "bg-green-100  text-green-800",
    Dismissed: "bg-gray-100   text-gray-600",
  };

  return (
    <>
      <table className="w-full text-sm min-w-[500px]">
        <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
          <tr className="border-b border-gray-100 bg-white">
            <th className="pb-3 text-left text-blue-500 font-semibold pr-4 w-28">
              Waktu
            </th>
            <th className="pb-3 text-left text-blue-500 font-semibold pr-4">
              Pelanggaran
            </th>
            <th className="pb-3 text-left text-blue-500 font-semibold pr-4 w-28">
              Kamera
            </th>
            <th className="pb-3 text-left text-blue-500 font-semibold pr-4 w-28">
              Status
            </th>
            <th className="pb-3 text-left text-blue-500 font-semibold w-36">
              Aksi
            </th>
          </tr>
        </thead>

        <tbody>
          {violations.map((row) => (
            <tr
              key={row.id}
              className="text-gray-700 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
            >
              {/* Time column */}
              <td className="py-4 pr-4 text-gray-700 font-mono font-medium whitespace-nowrap">
                {row.waktu}
              </td>

              {/* Violation type with Badges */}
              <td className="py-4 pr-4">
                <ViolationBadges value={row.pelanggaran} />
              </td>

              <td className="py-4 pr-4 text-gray-500 font-mono text-xs">
                {row.kamera}
              </td>

              <td className="py-4 pr-4">
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle[row.status] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {row.status}
                </span>
              </td>

              {/* Action button */}
              <td className="py-4">
                {onViewDetail && (
                  <button
                    onClick={() => onViewDetail(row)}
                    className="bg-[#0d1b2a] hover:bg-[#1a2f47] text-white text-[10px] font-bold px-4 py-2 rounded-full transition-colors duration-150 whitespace-nowrap"
                  >
                    LIHAT DETAIL
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Empty state */}
      {violations.length === 0 && (
        <p className="text-center text-gray-400 py-8 text-sm">
          Tidak ada pelanggaran hari ini.
        </p>
      )}
    </>
  );
}
