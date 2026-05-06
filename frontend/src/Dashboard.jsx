// ============================================================
// Dashboard.jsx  (Main component — entry point of the app)
//
// Architecture:
//   Dashboard.jsx
//     ├── Sidebar.jsx           (left nav)
//     ├── StatCard.jsx          (x3 summary cards)
//     ├── TodayViolations.jsx   (violations table — homepage)
//     ├── StatisticsPage.jsx    (Recharts bar + line charts)
//     ├── HistoryPage.jsx       (full event log table)
//     ├── NotificationPage.jsx  (alert center)
//     └── ValidationPage.jsx    (CV verification queue)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { Search, Bell, Menu, X } from "lucide-react";

import {
  getDashboardData,
  getStatistics,
  getHistoryLog,
  getPendingViolations,
} from "../services/api.js";

// Import all sub-components
import Sidebar from "./components/Sidebar.jsx";
import StatCard from "./components/StatCard.jsx";
import TodayViolations from "./components/TodayViolations.jsx";
// StatisticsPage, HistoryPage, NotificationPage, ValidationPage will be imported below
import StatisticsPage from "./components/StatisticsPage.jsx";
import HistoryPage from "./components/HistoryPage.jsx";
import NotificationPage from "./components/NotificationPage.jsx";
import ValidationPage from "./components/ValidationPage.jsx";

// Import mock data
import data from "./data.json";
// Helper function to map API data to the format expected by TodayViolations
function mapViolations(apiData) {
  return apiData.map((item) => ({
    waktu: item.timestamp,
    pelanggaran: (item.violations || []).join(", "),
    kamera: item.camera_id,
  }));
}

// Helper function to map API data to the format expected by HistoryPage
function mapHistory(apiData) {
  if (!Array.isArray(apiData)) return [];
  return apiData.map((item) => {
    const dt = new Date(item.timestamp);
    return {
      id: item.id || Math.random().toString(36).substr(2, 9),
      date: dt.toLocaleDateString("id-ID"),
      time: dt.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      violation: (item.violations || []).join(", "),
      camera: item.camera_id,
      action: item.status || "Notified", // Fallback status
    };
  });
}

// Helper function to map API data to the format expected by ValidationPage
function mapValidationQueue(apiData) {
  if (!Array.isArray(apiData)) return [];
  return apiData.map((item) => ({
    id: item.id,
    camera: item.camera_id,
    confidence: Math.round((item.confidence || 0.85) * 100), // Default mock confidence if missing
    detectedViolation: (item.violations || []).join(", "),
    time: new Date(item.timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    status: item.status === "pending" ? "Pending" : item.status, // Match UI capitalization
  }));
}

// Constants for pagination
const ITEMS_PER_PAGE = 10; // Update limit to 10 items per page

// ── Helper: format today's date as "10 April 2026" ──
function formatDate(dateObj) {
  return dateObj.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ============================================================
// Main Dashboard Component
// ============================================================
export default function Dashboard() {
  const [violations, setViolations] = useState([]);
  const [historyLog, setHistoryLog] = useState([]); // New state for history data
  const [validationQueue, setValidationQueue] = useState([]);
  const [stats, setStats] = useState({
    totalViolationsToday: 0,
    complianceRate: 0,
    pendingValidasi: 0,
  });
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const [violationTypes, setViolationTypes] = useState([]);
  const [cameraBreakdown, setCameraBreakdown] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(""); // State baru untuk filter kamera
  const [hourlyBreakdown, setHourlyBreakdown] = useState([]);
  const [timeRange, setTimeRange] = useState("7d"); // Default to 7 days
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const now = new Date();
        let startDateStr = "";
        let endDateStr = "";

        if (timeRange === "today") {
          startDateStr = now.toISOString().split("T")[0];
        } else if (timeRange === "7d") {
          const start = new Date();
          start.setDate(now.getDate() - 7);
          startDateStr = start.toISOString().split("T")[0];
        } else if (timeRange === "30d") {
          const start = new Date();
          start.setDate(now.getDate() - 30);
          startDateStr = start.toISOString().split("T")[0];
        } else if (timeRange === "custom") {
          startDateStr = customStartDate;
          endDateStr = customEndDate;
        }

        const apiParams = {};
        if (startDateStr) apiParams.start_date = startDateStr;
        if (endDateStr) apiParams.end_date = endDateStr;
        if (selectedCamera) apiParams.camera_id = selectedCamera; // Kirim filter kamera ke API

        const v = await getDashboardData(apiParams).catch(() => ({
          violations: [],
        }));
        const s = await getStatistics(apiParams);
        const h = await getHistoryLog(apiParams).catch(() => []);
        const q = await getPendingViolations(apiParams).catch(() => []);

        // Remove timestamp filtering for testing purposes
        setViolations(mapViolations(v.violations || []));
        setHistoryLog(mapHistory(h || [])); // Map and set history log data
        setValidationQueue(mapValidationQueue(q));

        setStats(s);
        setWeeklyTrend(s.weeklyTrend || []);
        setViolationTypes(s.violationTypes || []);
        setCameraBreakdown(s.cameraBreakdown || []);
        setHourlyBreakdown(s.hourlyBreakdown || []);
      } catch (err) {
        console.error("API error:", err);
      }
    }

    loadData();
  }, [timeRange, customStartDate, customEndDate, selectedCamera]); // Tambahkan selectedCamera ke dependency
  // Which page is currently shown
  const [activePage, setActivePage] = useState("dashboard");

  // When navigating to History from homepage "Lihat Detail",
  // we store the violation ID so HistoryPage can open that row's detail panel
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);

  // Mobile sidebar open/close state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Today's date string shown in header
  const [todayStr, setTodayStr] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Filter violations for Dashboard
  const filteredViolations = violations.filter(
    (v) =>
      (v.pelanggaran || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.kamera || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Filter history log (tanpa kolom karyawan)
  const filteredHistory = historyLog.filter(
    (h) =>
      (h.violation || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.camera || "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Slice violations for the current page
  const paginatedViolations = filteredViolations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Pagination calculations (sync with HistoryPage style)
  const totalPages = Math.ceil(filteredViolations.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  // Reset to first page when violations change
  useEffect(() => {
    setCurrentPage(1);
  }, [violations, searchQuery]); // Consolidated useEffect dependencies

  // Unread notification count for the bell badge
  const unreadCount = 0; // Update this later if notifications are integrated

  // Set today's date on first render
  useEffect(() => {
    setTodayStr(formatDate(new Date()));
  }, []);

  // Close mobile sidebar when navigating
  const handleNavigate = (page) => {
    setActivePage(page);
    setSidebarOpen(false);
    // Reset detail selection when navigating normally (not from Lihat Detail)
    if (page !== "history") setSelectedHistoryId(null);
  };

  // Called when operator clicks "Lihat Detail" on the homepage table.
  // Finds the matching history log entry by violation + time, then
  // navigates to History and opens that row's detail panel.
  const handleViewDetail = (todayRow) => {
    const match = historyLog.find(
      (h) =>
        h.violation === todayRow.pelanggaran && h.camera === todayRow.kamera,
    );
    // If found, pre-select that row; otherwise just open History page
    setSelectedHistoryId(match ? match.id : null);
    setActivePage("history");
    setSidebarOpen(false);
  };

  // ── Page title map ──
  const pageTitles = {
    dashboard: "Dashboard",
    statistics: "Statistik",
    history: "Riwayat",
    notification: "Notifikasi",
    validation: "Validasi",
  };

  // ── Render the correct page content ──
  const renderContent = () => {
    switch (activePage) {
      // ── DASHBOARD (Homepage) ──
      case "dashboard":
        return (
          <div className="space-y-6">
            {/* ── 3 Stat Cards in a responsive row ── */}
            <div className="flex flex-col sm:flex-row gap-4">
              <StatCard
                label="Total Pelanggaran Hari Ini"
                value={stats.totalViolationsToday}
              />

              <StatCard
                label="Kepatuhan (%)"
                value={`${stats.complianceRate}%`}
              />

              <StatCard
                label="Pending Validasi"
                value={stats.pendingValidasi}
              />
            </div>

            {/* ── Today's Violations Section (Synced with HistoryPage style) ── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col h-[720px]">
              <div className="overflow-auto flex-1 border-b border-gray-50">
                <TodayViolations
                  violations={paginatedViolations}
                  onViewDetail={handleViewDetail}
                />
              </div>

              {/* Pagination Controls */}
              <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400">
                  Menampilkan {startIndex + 1} -{" "}
                  {Math.min(
                    startIndex + ITEMS_PER_PAGE,
                    filteredViolations.length,
                  )}{" "}
                  dari {filteredViolations.length} kejadian
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg disabled:opacity-50"
                  >
                    Sebelumnya
                  </button>

                  <div className="flex items-center gap-1">
                    {[...Array(totalPages)]
                      .map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i + 1)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${currentPage === i + 1 ? "bg-blue-500 text-white" : "text-gray-400 hover:bg-gray-50"}`}
                        >
                          {i + 1}
                        </button>
                      ))
                      .slice(
                        Math.max(0, currentPage - 2),
                        Math.min(totalPages, currentPage + 1),
                      )}
                  </div>

                  <button
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg disabled:opacity-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "statistics":
        return (
          <StatisticsPage
            weeklyTrend={weeklyTrend}
            violationTypes={violationTypes}
            cameraBreakdown={cameraBreakdown}
            hourlyBreakdown={hourlyBreakdown}
            stats={stats}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        );

      case "history":
        return (
          <HistoryPage
            historyLog={filteredHistory}
            selectedId={selectedHistoryId}
          />
        );

      case "notification":
        return <NotificationPage notifications={[]} />; // Placeholder, integrate real notifications later

      case "validation":
        return (
          <ValidationPage
            validationQueue={validationQueue}
            setValidationQueue={setValidationQueue}
          />
        );

      default:
        return null;
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    // Full-screen flex layout: sidebar on left, main area on right
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {/* ── MOBILE OVERLAY (closes sidebar when tapping outside) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ──
           On desktop: always visible (lg:relative, lg:translate-x-0)
           On mobile: slides in from left as a fixed overlay            */}
      <div
        className={`
          fixed top-0 left-0 h-full z-30 transition-transform duration-300
          lg:relative lg:translate-x-0 lg:z-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
      </div>

      {/* ── MAIN AREA (header + page content) ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── TOP HEADER ── */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu size={22} />
          </button>

          {/* Search bar */}
          <div className="flex-1 relative max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Cari pelanggaran atau kamera..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 rounded-full outline-none focus:ring-2 focus:ring-violet-300 transition"
            />
          </div>

          {/* Spacer pushes notification + profile to the right */}
          <div className="flex-1" />

          {/* Filter Kamera */}
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="text-[10px] bg-gray-100 border-none rounded-lg px-3 py-2 mr-2 outline-none font-bold text-gray-600"
          >
            <option value="">Semua Kamera</option>
            {cameraBreakdown.map((c) => (
              <option key={c.camera} value={c.camera}>{c.camera}</option>
            ))}
          </select>

          {/* Time Range Filter for Statistics */}
          {activePage === "statistics" && (
            <div className="flex items-center gap-2 mr-4">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                {[
                  { id: "today", label: "Hari Ini" },
                  { id: "7d", label: "7 Hari" },
                  { id: "30d", label: "30 Hari" },
                  { id: "custom", label: "Kustom" },
                ].map((range) => (
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
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="text-[10px] bg-gray-100 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-violet-300 outline-none"
                  />
                  <span className="text-gray-400 text-[10px]">-</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="text-[10px] bg-gray-100 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-violet-300 outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Notification bell with unread badge */}
          <button
            className="relative text-gray-500 hover:text-gray-700"
            onClick={() => handleNavigate("notification")}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Admin avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            OP
          </div>
        </header>

        {/* ── PAGE CONTENT ── */}
        <main className="flex-1 p-6">
          {/* Page heading row */}
          <div className="flex items-start justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              {pageTitles[activePage]}
            </h1>
            {/* Date shown only on dashboard homepage — matches the design */}
            {activePage === "dashboard" && (
              <p className="text-gray-700 font-semibold text-base">
                {todayStr}
              </p>
            )}
          </div>

          {/* Dynamic page content */}
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
