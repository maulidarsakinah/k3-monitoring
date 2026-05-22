import PaginationControls from "../common/PaginationControls.jsx";
import StatCard from "../StatCard.jsx";
import TodayViolations from "../TodayViolations.jsx";
import { AlertTriangle, BellRing, Clock } from "lucide-react";

export default function DashboardHome({
  currentPage,
  filteredCount,
  itemsPerPage,
  onPageChange,
  onViewDetail,
  paginatedViolations,
  reminderItems = [],
  stats,
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-2">
            <BellRing size={18} className="text-amber-700" />
            <h2 className="font-bold text-amber-950">Reminder Validasi</h2>
          </div>
          <p className="text-2xl font-bold text-amber-950">
            {reminderItems.length}
          </p>
          <p className="text-xs text-amber-800 mt-1">
            laporan melewati SLA atau perlu perhatian.
          </p>
        </div>
      </div>

      {reminderItems.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-amber-700" />
            <h3 className="font-bold text-amber-950">Escalation Alert</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reminderItems.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-white/70 border border-amber-100 px-4 py-3 text-sm"
              >
                <p className="font-bold text-slate-900">
                  ID #{item.id} - {item.camera}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {item.detectedViolation}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                  <Clock size={13} />
                  {item.slaText}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <StatCard
          label="Total Pelanggaran Hari Ini"
          value={stats.totalViolationsToday}
        />
        <StatCard
          label="Tingkat Validasi (%)"
          value={`${stats.validationRate ?? stats.complianceRate}%`}
        />
        <StatCard label="Pending Validasi" value={stats.pendingValidasi} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col h-[720px]">
        <div className="overflow-auto flex-1 border-b border-gray-50">
          <TodayViolations
            violations={paginatedViolations}
            onViewDetail={onViewDetail}
          />
        </div>

        <PaginationControls
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onPageChange={onPageChange}
          totalItems={filteredCount}
        />
      </div>
    </div>
  );
}
