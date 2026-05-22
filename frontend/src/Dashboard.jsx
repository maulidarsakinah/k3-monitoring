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

import { useState, useEffect, useMemo } from "react";

import {
  ApiError,
  canExport,
  canManageSystem,
  canSubmitReport,
  canValidate,
  getDashboardData,
  getCameras,
  getStatistics,
  getHistoryLog,
  getPendingViolations,
  downloadExport,
} from "./services/api.js";

import AppHeader from "./components/layout/AppHeader.jsx";
import Sidebar from "./components/layout/Sidebar.jsx";
import DashboardHome from "./components/pages/DashboardHome.jsx";
import StatisticsPage from "./components/StatisticsPage.jsx";
import HistoryPage from "./components/HistoryPage.jsx";
import NotificationPage from "./components/NotificationPage.jsx";
import NotificationToasts from "./components/NotificationToasts.jsx";
import ValidationPage from "./components/ValidationPage.jsx";
import ExportDialog from "./components/ExportDialog.jsx";
import LiveMonitoringPage from "./components/pages/LiveMonitoringPage.jsx";
import ManagementPage from "./components/pages/ManagementPage.jsx";
import NotFoundPage from "./components/pages/NotFoundPage.jsx";
import ReportsPage from "./components/pages/ReportsPage.jsx";
import SettingsPage from "./components/pages/SettingsPage.jsx";
import { formatDate } from "./utils/date.js";
import {
  buildCameraBreakdown,
  buildHourlyBreakdown,
  buildNotifications,
  mapHistory,
  mapValidationQueue,
  mapViolations,
} from "./utils/dashboardMappers.js";

// Constants for pagination
const ITEMS_PER_PAGE = 10; // Update limit to 10 items per page
const DEFAULT_REMINDER_HOURS = 24;

const getReadNotificationKey = (username) =>
  `read_notifications:${username || "anonymous"}`;

const loadReadNotificationIds = (username) => {
  try {
    return new Set(JSON.parse(localStorage.getItem(getReadNotificationKey(username)) || "[]"));
  } catch {
    return new Set();
  }
};

const saveReadNotificationIds = (username, ids) => {
  localStorage.setItem(getReadNotificationKey(username), JSON.stringify([...ids]));
};

const mergeCameraSources = (registeredCameras = [], detectedCameras = []) => {
  const detectedByName = detectedCameras.reduce((acc, item) => {
    acc[item.camera] = item;
    return acc;
  }, {});

  const merged = registeredCameras.map((camera) => {
    const detected = detectedByName[camera.name] || {};
    return {
      camera: camera.name,
      count: detected.count || 0,
      id: camera.id,
      location: camera.location,
      isActive: camera.is_active !== 0,
      source: "registered",
    };
  });

  detectedCameras.forEach((camera) => {
    if (!merged.some((item) => item.camera === camera.camera)) {
      merged.push({ ...camera, isActive: true, source: "detected" });
    }
  });

  if (!merged.some((item) => item.camera === "cam_test")) {
    merged.unshift({
      camera: "cam_test",
      count: detectedByName.cam_test?.count || 0,
      isActive: true,
      source: "default",
    });
  }

  return merged;
};

// ============================================================
// Main Dashboard Component
// ============================================================
export default function Dashboard({ user, onLogout, onSessionExpired }) {
  const [violations, setViolations] = useState([]);
  const [historyLog, setHistoryLog] = useState([]); // New state for history data
  const [validationQueue, setValidationQueue] = useState([]);
  const [stats, setStats] = useState({
    totalViolationsToday: 0,
    validationRate: 0,
    pendingValidasi: 0,
  });
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const [violationTypes, setViolationTypes] = useState([]);
  const [cameraBreakdown, setCameraBreakdown] = useState([]);
  const [registeredCameras, setRegisteredCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(""); // State baru untuk filter kamera
  const [hourlyBreakdown, setHourlyBreakdown] = useState([]);
  const [timeRange, setTimeRange] = useState("7d"); // Default to 7 days
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState(() =>
    loadReadNotificationIds(user?.username),
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState("");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("dark_mode") === "true",
  );
  const [reminderHours, setReminderHours] = useState(() =>
    Number(localStorage.getItem("reminder_hours") || DEFAULT_REMINDER_HOURS),
  );

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setErrorMessage("");
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

        const [v, s, h, q, c] = await Promise.all([
          getDashboardData(apiParams),
          getStatistics(apiParams),
          getHistoryLog(apiParams),
          getPendingViolations(apiParams),
          getCameras(),
        ]);

        // Remove timestamp filtering for testing purposes
        setViolations(mapViolations(v.violations || []));
        setHistoryLog(mapHistory(h || [])); // Map and set history log data
        const mappedQueue = mapValidationQueue(q);
        if (canValidate(user?.role)) {
          setValidationQueue(
            mappedQueue.filter(
              (item) => item.rawStatus === "needs_manager" || (item.rawStatus === "pending" && item.reportSent),
            ),
          );
        } else if (canSubmitReport(user?.role)) {
          setValidationQueue(
            mappedQueue.filter((item) => ["detected", "pending"].includes(item.rawStatus)),
          );
        } else {
          setValidationQueue([]);
        }
        setNotifications(
          buildNotifications(h || [], user?.role).map((notification) => ({
            ...notification,
            read:
              notification.read || readNotificationIds.has(notification.id),
          })),
        );

        setStats(s);
        setWeeklyTrend(s.weeklyTrend || []);
        setViolationTypes(s.violationTypes || []);
        setCameraBreakdown(buildCameraBreakdown(h || []));
        setRegisteredCameras(Array.isArray(c) ? c : []);
        setHourlyBreakdown(buildHourlyBreakdown(h || []));
      } catch (err) {
        console.error("API error:", err);
        if (err instanceof ApiError && err.status === 401) {
          onSessionExpired?.();
          return;
        }
        setErrorMessage(err.message || "Gagal memuat data dari backend.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [
    timeRange,
    customStartDate,
    customEndDate,
    selectedCamera,
    refreshKey,
    onSessionExpired,
    user?.role,
    readNotificationIds,
  ]); // Tambahkan selectedCamera ke dependency
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

  // Reset to first page when violations change
  useEffect(() => {
    setCurrentPage(1);
  }, [violations, searchQuery]); // Consolidated useEffect dependencies

  useEffect(() => {
    const ids = loadReadNotificationIds(user?.username);
    setReadNotificationIds(ids);
  }, [user?.username]);

  const markNotificationsAsRead = (ids) => {
    if (!ids.length) return;
    setReadNotificationIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveReadNotificationIds(user?.username, next);
      return next;
    });
    setNotifications((prev) =>
      prev.map((notification) =>
        ids.includes(notification.id)
          ? { ...notification, read: true }
          : notification,
      ),
    );
  };

  const markAllNotificationsAsRead = () => {
    markNotificationsAsRead(
      notifications.filter((notification) => !notification.read).map((item) => item.id),
    );
  };

  useEffect(() => {
    if (!["dashboard", "monitoring", "notification"].includes(activePage)) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRefreshKey((key) => key + 1);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [activePage]);

  useEffect(() => {
    if (activePage !== "notification") return;
    markAllNotificationsAsRead();
  }, [activePage, notifications.length]);

  // Unread notification count for the bell badge
  const unreadCount = notifications.filter((notif) => !notif.read).length;
  const userCanExport = canExport(user?.role);
  const userCanManage = canManageSystem(user?.role);
  const userCanReceivePopup = canValidate(user?.role);
  const cameraOptions = useMemo(
    () => mergeCameraSources(registeredCameras, cameraBreakdown),
    [registeredCameras, cameraBreakdown],
  );

  const reminderItems = validationQueue
    .filter((item) => item.status === "Pending")
    .map((item) => {
      const basis = item.reportSentRaw || item.timestamp;
      const dt = new Date(basis);
      const ageHours = Number.isNaN(dt.getTime())
        ? 0
        : (Date.now() - dt.getTime()) / 36e5;
      return {
        ...item,
        ageHours,
        slaText:
          ageHours >= reminderHours
            ? `Lewat SLA ${Math.floor(ageHours)} jam`
            : `Menunggu ${Math.floor(ageHours)} jam`,
      };
    })
    .filter((item) => item.ageHours >= reminderHours || item.reportSent);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("dark_mode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("reminder_hours", String(reminderHours));
  }, [reminderHours]);
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
    monitoring: "Monitoring Real-Time",
    statistics: "Statistik",
    history: "Riwayat",
    notification: "Notifikasi",
    validation: "Validasi",
    reports: "Laporan",
    management: "Manajemen",
    settings: "Pengaturan",
  };

  // ── Render the correct page content ──
  const renderContent = () => {
    switch (activePage) {
      // ── DASHBOARD (Homepage) ──
      case "dashboard":
        return (
          <DashboardHome
            currentPage={currentPage}
            filteredCount={filteredViolations.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            onViewDetail={handleViewDetail}
            paginatedViolations={paginatedViolations}
            reminderItems={reminderItems}
            stats={stats}
          />
        );

      case "monitoring":
        return (
          <LiveMonitoringPage
            cameraBreakdown={cameraOptions}
            latestViolations={violations}
            loading={loading}
            onRefresh={() => setRefreshKey((key) => key + 1)}
          />
        );

      case "statistics":
        return (
          <StatisticsPage
            weeklyTrend={weeklyTrend}
            violationTypes={violationTypes}
            cameraBreakdown={cameraOptions}
            hourlyBreakdown={hourlyBreakdown}
            stats={stats}
            loading={loading}
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
        return (
          <NotificationPage
            notifications={notifications}
            onMarkAllRead={markAllNotificationsAsRead}
            onMarkRead={(id) => markNotificationsAsRead([id])}
          />
        );

      case "validation":
        return (
          <ValidationPage
            validationQueue={validationQueue}
            setValidationQueue={setValidationQueue}
            user={user}
            onValidated={() => setRefreshKey((key) => key + 1)}
          />
        );

      case "reports":
        return userCanExport ? (
          <ReportsPage
            cameraBreakdown={cameraOptions}
            historyLog={filteredHistory}
            hourlyBreakdown={hourlyBreakdown}
            stats={stats}
            violationTypes={violationTypes}
            weeklyTrend={weeklyTrend}
            onOpenExport={() => setExportDialogOpen(true)}
          />
        ) : (
          <NotFoundPage onBackHome={() => handleNavigate("dashboard")} />
        );

      case "management":
        return userCanManage ? (
          <ManagementPage
            user={user}
            onChanged={() => setRefreshKey((key) => key + 1)}
          />
        ) : (
          <NotFoundPage onBackHome={() => handleNavigate("dashboard")} />
        );

      case "settings":
        return (
          <SettingsPage
            reminderHours={reminderHours}
            onReminderHoursChange={setReminderHours}
          />
        );

      default:
        return <NotFoundPage onBackHome={() => handleNavigate("dashboard")} />;
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    // Full-screen flex layout: sidebar on left, main area on right
    <div
      className={`flex min-h-screen font-sans ${
        darkMode ? "bg-slate-950" : "bg-gray-50"
      }`}
    >
      <NotificationToasts
        notifications={notifications}
        enabled={userCanReceivePopup}
        onOpenNotifications={(id) => {
          if (id) markNotificationsAsRead([id]);
          handleNavigate("notification");
        }}
      />

      {exportDialogOpen && (
        <ExportDialog
          cameras={cameraOptions}
          exporting={exporting}
          selectedCamera={selectedCamera}
          onClose={() => setExportDialogOpen(false)}
          onExport={async (format, params) => {
            setExporting(format);
            setErrorMessage("");
            try {
              await downloadExport(format, params);
              setExportDialogOpen(false);
            } catch (err) {
              setErrorMessage(err.message || "Gagal export laporan.");
            } finally {
              setExporting("");
            }
          }}
        />
      )}

      {/* ── MOBILE OVERLAY (closes sidebar when tapping outside) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ──
           On desktop and mobile: fixed to the viewport.
           Main content gets a left margin on desktop. */}
      <div
        className={`
          fixed top-0 left-0 h-screen z-30 transition-transform duration-300
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar
          activePage={activePage}
          darkMode={darkMode}
          onDarkModeChange={setDarkMode}
          onNavigate={handleNavigate}
          user={user}
          onLogout={onLogout}
          unreadCount={unreadCount}
        />
      </div>

      {/* ── MAIN AREA (header + page content) ── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <AppHeader
          activePage={activePage}
          cameraBreakdown={cameraOptions}
          customEndDate={customEndDate}
          customStartDate={customStartDate}
          exporting={exporting}
          loading={loading}
          onExport={() => setExportDialogOpen(true)}
          onNavigate={handleNavigate}
          onOpenSidebar={() => setSidebarOpen(true)}
          onRefresh={() => setRefreshKey((key) => key + 1)}
          searchQuery={searchQuery}
          selectedCamera={selectedCamera}
          setCustomEndDate={setCustomEndDate}
          setCustomStartDate={setCustomStartDate}
          setSearchQuery={setSearchQuery}
          setSelectedCamera={setSelectedCamera}
          setTimeRange={setTimeRange}
          timeRange={timeRange}
          unreadCount={unreadCount}
          user={user}
          userCanExport={userCanExport}
        />

        {/* ── PAGE CONTENT ── */}
        <main className="flex-1 p-6">
          {/* Page heading row */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {pageTitles[activePage]}
              </h1>
              {errorMessage && (
                <p className="text-sm text-red-600 font-semibold mt-1">
                  {errorMessage}
                </p>
              )}
            </div>
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
