import { Bell, Download, Menu, RefreshCw, Search } from "lucide-react";

const TIME_RANGES = [
  { id: "today", label: "Hari Ini" },
  { id: "7d", label: "7 Hari" },
  { id: "30d", label: "30 Hari" },
  { id: "custom", label: "Kustom" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "Semua Severity" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function AppHeader({
  activePage,
  cameraBreakdown,
  customEndDate,
  customStartDate,
  exporting,
  loading,
  onExport,
  onNavigate,
  onOpenSidebar,
  onRefresh,
  searchQuery,
  selectedCamera,
  selectedSeverity,
  setCustomEndDate,
  setCustomStartDate,
  setSearchQuery,
  setSelectedCamera,
  setSelectedSeverity,
  setTimeRange,
  timeRange,
  unreadCount,
  user,
  userCanExport,
}) {
  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
      <button
        onClick={onOpenSidebar}
        className="lg:hidden text-gray-500 hover:text-gray-700"
        aria-label="Buka menu"
      >
        <Menu size={22} />
      </button>

      <div className="flex-1 relative max-w-sm">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          placeholder="Cari pelanggaran atau kamera..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 rounded-full outline-none focus:ring-2 focus:ring-violet-300 transition"
        />
      </div>

      <div className="flex-1" />

      <button
        onClick={onRefresh}
        className="hidden sm:inline-flex items-center gap-2 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-lg px-3 py-2"
        title="Refresh data"
      >
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        Refresh
      </button>

      <select
        value={selectedCamera}
        onChange={(event) => setSelectedCamera(event.target.value)}
        className="text-[10px] bg-gray-100 border-none rounded-lg px-3 py-2 mr-2 outline-none font-bold text-gray-600"
      >
        <option value="">Semua Kamera</option>
        {cameraBreakdown.map((camera) => (
          <option key={camera.camera} value={camera.camera}>
            {camera.camera}
          </option>
        ))}
      </select>

      <select
        value={selectedSeverity}
        onChange={(event) => setSelectedSeverity(event.target.value)}
        className="text-[10px] bg-gray-100 border-none rounded-lg px-3 py-2 mr-2 outline-none font-bold text-gray-600"
      >
        {SEVERITY_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      {userCanExport && (
        <div className="hidden md:flex items-center gap-2">
          <button
            disabled={Boolean(exporting)}
            onClick={onExport}
            className="inline-flex items-center gap-1.5 text-[10px] bg-[#0d1b2a] hover:bg-[#1a2f47] disabled:opacity-60 text-white font-bold rounded-lg px-3 py-2 uppercase"
          >
            <Download size={13} />
            {exporting ? "..." : "Export"}
          </button>
        </div>
      )}

      {activePage === "statistics" && (
        <div className="flex items-center gap-2 mr-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {TIME_RANGES.map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                  timeRange === range.id
                    ? "bg-white text-violet-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          {timeRange === "custom" && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
                className="text-[10px] bg-gray-100 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-violet-300 outline-none"
              />
              <span className="text-gray-400 text-[10px]">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
                className="text-[10px] bg-gray-100 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-violet-300 outline-none"
              />
            </div>
          )}
        </div>
      )}

      <button
        className="relative text-gray-500 hover:text-gray-700"
        onClick={() => onNavigate("notification")}
        aria-label="Buka notifikasi"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
        {(user?.username || "OP").slice(0, 2).toUpperCase()}
      </div>
    </header>
  );
}
