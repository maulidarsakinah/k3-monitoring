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
    <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
      <button
        onClick={onOpenSidebar}
        className="lg:hidden text-gray-500 hover:text-gray-700"
        aria-label="Buka menu"
      >
        <Menu size={22} />
      </button>

      <div className="order-2 w-full sm:order-none sm:flex-1 relative sm:max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          type="text"
          placeholder="Cari pelanggaran atau kamera..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-11 w-full pl-9 pr-4 text-sm font-medium bg-gray-100 text-slate-700 placeholder:text-slate-500 rounded-full outline-none focus:ring-2 focus:ring-violet-300 transition"
        />
      </div>

      <div className="hidden lg:block flex-1" />

      <button
        onClick={onRefresh}
        className="order-3 sm:order-none inline-flex h-11 items-center gap-2 bg-gray-100 hover:bg-gray-200 text-slate-700 font-bold rounded-lg px-4 text-sm"
        title="Refresh data"
      >
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        Refresh
      </button>

      <select
        value={selectedCamera}
        onChange={(event) => setSelectedCamera(event.target.value)}
        className="order-3 sm:order-none h-11 min-w-[10rem] flex-1 sm:flex-none bg-gray-100 border-none rounded-lg px-3 outline-none font-bold text-sm text-slate-700"
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
        className="order-3 sm:order-none h-11 min-w-[10rem] flex-1 sm:flex-none bg-gray-100 border-none rounded-lg px-3 outline-none font-bold text-sm text-slate-700"
      >
        {SEVERITY_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      {userCanExport && (
        <div className="order-3 sm:order-none flex items-center gap-2">
          <button
            disabled={Boolean(exporting)}
            onClick={onExport}
            className="inline-flex h-11 items-center gap-2 bg-[#0d1b2a] hover:bg-[#1a2f47] disabled:opacity-60 text-white font-bold rounded-lg px-4 text-sm"
          >
            <Download size={16} />
            {exporting ? "..." : "Export"}
          </button>
        </div>
      )}

      {activePage === "statistics" && (
        <div className="order-4 w-full xl:w-auto flex flex-wrap items-center gap-2 xl:mr-4">
          <div className="flex max-w-full overflow-x-auto bg-gray-100 p-1 rounded-xl">
            {TIME_RANGES.map((range) => (
              <button
                key={range.id}
                onClick={() => setTimeRange(range.id)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  timeRange === range.id
                    ? "bg-white text-violet-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
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
                className="h-10 text-sm font-semibold text-slate-700 bg-gray-100 border-none rounded-lg px-3 focus:ring-1 focus:ring-violet-300 outline-none"
              />
              <span className="text-slate-500 text-sm">-</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
                className="h-10 text-sm font-semibold text-slate-700 bg-gray-100 border-none rounded-lg px-3 focus:ring-1 focus:ring-violet-300 outline-none"
              />
            </div>
          )}
        </div>
      )}

      <button
        className="relative text-slate-600 hover:text-slate-800"
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

      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
        {(user?.username || "OP").slice(0, 2).toUpperCase()}
      </div>
    </header>
  );
}
