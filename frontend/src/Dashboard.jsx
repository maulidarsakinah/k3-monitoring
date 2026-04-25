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

import { useState, useEffect } from "react";
import { Search, Bell, Menu, X } from "lucide-react";

import { getDashboardData, getStats } from "../services/api.js";

// Import all sub-components
import Sidebar from "./components/Sidebar.jsx";
import StatCard from "./components/StatCard.jsx";
import TodayViolations from "./components/TodayViolations.jsx";
import StatisticsPage from "./components/StatisticsPage.jsx";
import HistoryPage from "./components/HistoryPage.jsx";
import NotificationPage from "./components/NotificationPage.jsx";
import ValidationPage from "./components/ValidationPage.jsx";

// Import mock data
import data from "./data.json";

// Helper function to map API data to the format expected by TodayViolations
function mapViolations(apiData) {
  return apiData.map((item) => ({
    waktu: item.timestamp, // Use timestamp from API
    pelanggaran: item.violations.join(", "), // Combine violations into a string
    kamera: item.camera_id, // Use camera_id from API
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
  const [stats, setStats] = useState({
    totalViolationsToday: 0,
    complianceRate: 0,
    pendingValidasi: 0,
  });
  useEffect(() => {
    async function loadData() {
      try {
        const v = await getDashboardData();
        const s = await getStats();

        // Remove timestamp filtering for testing purposes
        setViolations(mapViolations(v.violations || []));

        setStats({
          totalViolationsToday: v.violations.length || 0, // Update total to reflect all violations
          complianceRate: s.compliance_rate || 0,
          pendingValidasi: s.pending || 0,
        });
      } catch (err) {
        console.error("API error:", err);
      }
    }

    loadData();
  }, []);
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
      v.pelanggaran.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.kamera.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Filter history log (mock data)
  const filteredHistory = data.historyLog.filter(
    (h) =>
      h.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.violation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.camera.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Slice violations for the current page
  const paginatedViolations = filteredViolations.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Reset to first page when violations change
  useEffect(() => {
    setCurrentPage(1);
  }, [violations, searchQuery]); // Consolidated useEffect dependencies

  // Unread notification count for the bell badge
  const unreadCount = data.notifications.filter((n) => !n.read).length;

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
    // Match today's violation to the history log by violation type and time
    const match = data.historyLog.find(
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
                label="Total Violations Today"
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

            {/* ── Today's Violations Table ── */}
            <TodayViolations
              violations={paginatedViolations}
              // onViewDetail={handleViewDetail}
              onViewDetail={handleViewDetail}
            />

            {/* Pagination Controls */}
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || filteredViolations.length === 0}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
              >
                Sebelumnya
              </button>
              <span className="text-gray-700">
                Halaman {currentPage} dari{" "}
                {Math.max(
                  1,
                  Math.ceil(filteredViolations.length / ITEMS_PER_PAGE),
                )}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) =>
                    p * ITEMS_PER_PAGE < filteredViolations.length ? p + 1 : p,
                  )
                }
                disabled={
                  currentPage * ITEMS_PER_PAGE >= filteredViolations.length
                }
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded disabled:opacity-50"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        );

      case "statistics":
        return (
          <StatisticsPage
            weeklyTrend={data.weeklyTrend}
            violationTypes={data.violationTypes}
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
        return <NotificationPage notifications={data.notifications} />;

      case "validation":
        return <ValidationPage validationQueue={data.validationQueue} />;

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
              placeholder="Cari pelanggaran, karyawan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 rounded-full outline-none focus:ring-2 focus:ring-violet-300 transition"
            />
          </div>

          {/* Spacer pushes notification + profile to the right */}
          <div className="flex-1" />

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
