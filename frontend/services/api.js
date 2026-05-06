const BASE_URL = "http://127.0.0.1:8000";

const getAuthHeader = () => {
  const token = localStorage.getItem("token"); // Pastikan token disimpan dengan key 'token' saat login
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getDashboardData = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/violations?${query}`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error("Gagal mengambil data dashboard");
  const data = await res.json();
  return { violations: Array.isArray(data.violations) ? data.violations : [] };
};

export const getStatistics = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  // Mengambil data dari dua endpoint berbeda di backend
  const [statsRes, trendRes] = await Promise.all([
    fetch(`${BASE_URL}/violations/stats?${query}`, {
      headers: getAuthHeader(),
    }),
    fetch(`${BASE_URL}/violations/trend?${query}`, {
      headers: getAuthHeader(),
    }),
  ]);

  if (!statsRes.ok || !trendRes.ok)
    throw new Error("Gagal mengambil data statistik");

  const statsData = await statsRes.json();
  const trendData = await trendRes.json();

  // Mapping data agar sesuai dengan kebutuhan Dashboard.jsx
  return {
    totalViolations: statsData.total_violations || 0,
    violationsToday: statsData.violations_today || 0,
    by_status: statsData.by_status || { pending: 0, approved: 0, rejected: 0 },
    complianceRate:
      statsData.total_violations > 0
        ? (
            (statsData.by_status.approved / statsData.total_violations) *
            100
          ).toFixed(1)
        : "0",
    // Legacy support untuk card di Dashboard
    totalViolationsToday: statsData.violations_today || 0,
    pendingValidasi: statsData.by_status?.pending || 0,
    approvedValidasi: statsData.by_status?.approved || 0,
    rejectedValidasi: statsData.by_status?.rejected || 0,
    weeklyTrend: trendData.map((t) => ({
      date: t.date,
      violations: t.count,
      approved: t.approved || 0,
      rejected: t.rejected || 0,
      pending: t.pending || 0,
    })),
    violationTypes: Object.entries(statsData.violation_breakdown || {}).map(
      ([type, count]) => ({
        type,
        count,
      }),
    ),
    hourlyBreakdown: Object.entries(statsData.hourly_breakdown || {}).map(
      ([hour, count]) => ({
        hour: `${hour.padStart(2, "0")}:00`,
        count,
      }),
    ),
    cameraBreakdown: Object.entries(statsData.camera_breakdown || {}).map(
      ([camera, count]) => ({
        camera,
        count,
      }),
    ),
  };
};

export const getHistoryLog = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/violations?${query}`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error("Gagal mengambil data riwayat");
  const data = await res.json();
  return Array.isArray(data.violations) ? data.violations : [];
};

export const getPendingViolations = async (params = {}) => {
  // Always add status=pending, but allow other params like start_date
  const mergedParams = { ...params, status: "pending" };
  const query = new URLSearchParams(mergedParams).toString();
  const res = await fetch(`${BASE_URL}/violations?${query}`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) throw new Error("Gagal mengambil antrean validasi");
  const data = await res.json();
  return Array.isArray(data.violations) ? data.violations : [];
};

export const validateViolation = async (id, action, note = "") => {
  const res = await fetch(`${BASE_URL}/violations/${id}/validate`, {
    method: "POST",
    headers: {
      ...getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, note }),
  });
  if (!res.ok) throw new Error("Gagal memproses validasi");
  return res.json();
};
