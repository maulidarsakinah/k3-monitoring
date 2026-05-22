const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const getStoredSession = () => {
  const token = localStorage.getItem("token");
  const rawUser = localStorage.getItem("user");
  if (!token) return null;

  try {
    return {
      token,
      user: rawUser ? JSON.parse(rawUser) : null,
    };
  } catch {
    return { token, user: null };
  }
};

export const saveSession = ({ token, user }) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const toQuery = (params = {}) => {
  const clean = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  return new URLSearchParams(clean).toString();
};

const parseResponse = async (res) => {
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const detail = isJson ? body?.detail || body?.message : body;
    throw new ApiError(detail || "Permintaan gagal diproses", res.status);
  }

  return body;
};

const request = async (path, options = {}) => {
  const headers = {
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  return parseResponse(res);
};

export const login = async (username, password) => {
  const body = new URLSearchParams();
  body.set("username", username);
  body.set("password", password);

  const data = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const user = {
    username,
    role: data.role,
    roleLabel: data.role_label,
  };

  saveSession({ token: data.access_token, user });
  return { token: data.access_token, user };
};

export const getMe = async () => {
  const data = await request("/users/me");
  const user = {
    username: data.username,
    role: data.role,
    roleLabel: data.role_label,
  };
  localStorage.setItem("user", JSON.stringify(user));
  return user;
};

export const getSystemStatus = () => request("/status");

export const getViolations = async (params = {}) => {
  const query = toQuery({ limit: 200, ...params });
  const data = await request(`/violations${query ? `?${query}` : ""}`);
  return {
    total: data.total || 0,
    violations: Array.isArray(data.violations) ? data.violations : [],
  };
};

export const getDashboardData = getViolations;

export const getStatistics = async (params = {}) => {
  const query = toQuery(params);
  const [statsData, trendData] = await Promise.all([
    request(`/violations/stats${query ? `?${query}` : ""}`),
    request(`/violations/trend${query ? `?${query}` : ""}`),
  ]);

  const byStatus = statsData.by_status || {};
  const total = statsData.total_violations || 0;
  const approved = byStatus.approved || 0;
  const resolved =
    approved + (byStatus.rejected || 0) + (byStatus.staff_reviewed || 0);

  return {
    totalViolations: total,
    violationsToday: statsData.violations_today || 0,
    by_status: {
      pending: byStatus.pending || 0,
      approved,
      rejected: byStatus.rejected || 0,
    },
    validationRate: total > 0 ? ((resolved / total) * 100).toFixed(1) : "0",
    complianceRate: total > 0 ? ((resolved / total) * 100).toFixed(1) : "0",
    totalViolationsToday: statsData.violations_today || 0,
    pendingValidasi: byStatus.pending || 0,
    approvedValidasi: approved,
    rejectedValidasi: byStatus.rejected || 0,
    weeklyTrend: Array.isArray(trendData)
      ? trendData.map((t) => ({
          date: t.date,
          violations: t.count || 0,
          approved: t.approved || 0,
          rejected: t.rejected || 0,
          pending: t.pending || 0,
        }))
      : [],
    violationTypes: Object.entries(statsData.violation_breakdown || {}).map(
      ([type, count]) => ({ type, count }),
    ),
  };
};

export const getHistoryLog = async (params = {}) => {
  const data = await getViolations(params);
  return data.violations;
};

export const getPendingViolations = async (params = {}) => {
  const data = await getViolations(params);
  return data.violations;
};

export const validateViolation = async (id, action, note = "") =>
  request(`/violations/${id}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, note }),
  });

export const submitViolationReport = async (id, note = "") =>
  request(`/violations/${id}/submit-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });

export const staffReviewViolation = async (id, note = "") =>
  request(`/violations/${id}/staff-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });

export const getUsers = () => request("/users");

export const createUser = (payload) =>
  request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const updateUserRole = (id, role) =>
  request(`/users/${id}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });

export const deleteUser = (id) =>
  request(`/users/${id}`, {
    method: "DELETE",
  });

export const getCameras = () => request("/cameras");

export const createCamera = (payload) =>
  request("/cameras", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const updateCamera = (id, payload) =>
  request(`/cameras/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const deleteCamera = (id) =>
  request(`/cameras/${id}`, {
    method: "DELETE",
  });

export const getRules = () => request("/rules");

export const createRule = (payload) =>
  request("/rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const updateRule = (id, payload) =>
  request(`/rules/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const deleteRule = (id) =>
  request(`/rules/${id}`, {
    method: "DELETE",
  });

export const downloadExport = async (format, params = {}) => {
  const query = toQuery(params);
  const res = await fetch(
    `${BASE_URL}/violations/export/${format}${query ? `?${query}` : ""}`,
    { headers: getAuthHeader() },
  );

  if (!res.ok) await parseResponse(res);

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename =
    match?.[1] || `laporan_apd_${new Date().toISOString().slice(0, 10)}.${format}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const canValidate = (role) => ["admin", "manager"].includes(role);
export const canSubmitReport = (role) => role === "operator";
export const canManageSystem = (role) => ["admin", "manager"].includes(role);
export const canExport = (role) => ["admin", "manager"].includes(role);
