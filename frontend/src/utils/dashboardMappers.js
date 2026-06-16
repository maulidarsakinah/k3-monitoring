import { formatTime, formatTimestamp } from "./date.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function resolveEvidenceUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const STATUS_LABEL = {
  detected: "Detected",
  staff_reviewed: "Staff Reviewed",
  needs_manager: "Needs Manager",
  pending: "Pending",
  approved: "Validated",
  rejected: "Dismissed",
};

export const STATUS_TEXT = {
  detected: "Perlu review staff",
  staff_reviewed: "Selesai oleh staff",
  needs_manager: "Menunggu manager",
  pending: "Menunggu validasi",
  approved: "Disetujui",
  rejected: "Ditolak",
};

function extractSummarySeverity(summary = "") {
  const text = String(summary || "").trim();
  return text.match(/^\[([^\]]+)\]/)?.[1]?.toLowerCase() || "";
}

function compactNotificationSummary(summary = "", violations = []) {
  const text = String(summary || "").trim();
  if (!text) return "";

  const normalized = text.toLowerCase();
  const isViolationListSummary =
    normalized.includes("pelanggaran apd:") ||
    violations.some((violation) =>
      normalized.includes(String(violation || "").toLowerCase()),
    );

  if (isViolationListSummary) {
    return "";
  }

  return text;
}

export function mapViolations(apiData = []) {
  return apiData.map((item) => ({
    id: item.id,
    waktu: formatTimestamp(item.timestamp),
    pelanggaran: (item.violations || []).join(", "),
    kamera: item.camera_id,
    status: STATUS_LABEL[item.status] || item.status || "Pending",
    severity: item.severity || "none",
    autoReviewed: item.staff_reviewed_by === "system",
  }));
}

export function mapHistory(apiData = []) {
  if (!Array.isArray(apiData)) return [];

  return apiData.map((item) => {
    const dt = new Date(item.timestamp);
    const invalidDate = Number.isNaN(dt.getTime());

    return {
      id: item.id || Math.random().toString(36).slice(2, 9),
      date: invalidDate ? "-" : dt.toLocaleDateString("id-ID"),
      time: invalidDate ? formatTime(item.timestamp) : formatTime(dt),
      violation: (item.violations || []).join(", "),
      camera: item.camera_id,
      action: STATUS_LABEL[item.status] || item.status || "Pending",
      severity: item.severity || "none",
      summary: item.summary,
      validatedBy: item.validated_by,
      validatedAt: item.validated_at,
      note: item.validation_note,
      evidenceUrl: resolveEvidenceUrl(item.evidence_path),
      reportSentBy: item.report_sent_by,
      reportSentAt: item.report_sent_at ? formatTimestamp(item.report_sent_at) : "",
      reportNote: item.report_note,
      staffReviewedBy: item.staff_reviewed_by,
      autoReviewed: item.staff_reviewed_by === "system",
      staffReviewedAt: item.staff_reviewed_at ? formatTimestamp(item.staff_reviewed_at) : "",
      staffNote: item.staff_note,
      firstDetectedAt: item.first_detected_at ? formatTimestamp(item.first_detected_at) : "",
      lastDetectedAt: item.last_detected_at ? formatTimestamp(item.last_detected_at) : "",
      occurrenceCount: item.occurrence_count || 1,
      confidenceMax: item.confidence_max || 0,
      timestamp: item.timestamp,
      reportSentRaw: item.report_sent_at,
      validatedAtRaw: item.validated_at,
      raw: item,
    };
  });
}

export function mapValidationQueue(apiData = []) {
  if (!Array.isArray(apiData)) return [];

  return apiData.map((item) => ({
    id: item.id,
    camera: item.camera_id,
    confidence: Math.round(((item.confidence_max || item.confidence || 0.85) * 100)),
    detectedViolation: (item.violations || []).join(", "),
    summary: item.summary,
    evidenceUrl: resolveEvidenceUrl(item.evidence_path),
    reportSentBy: item.report_sent_by,
    reportSentAt: item.report_sent_at ? formatTimestamp(item.report_sent_at) : "",
    reportSentRaw: item.report_sent_at,
    reportNote: item.report_note,
    reportSent: Boolean(item.report_sent_at) || item.status === "needs_manager",
    staffReviewedBy: item.staff_reviewed_by,
    autoReviewed: item.staff_reviewed_by === "system",
    staffReviewedAt: item.staff_reviewed_at ? formatTimestamp(item.staff_reviewed_at) : "",
    staffNote: item.staff_note,
    firstDetectedAt: item.first_detected_at ? formatTimestamp(item.first_detected_at) : "",
    lastDetectedAt: item.last_detected_at ? formatTimestamp(item.last_detected_at) : "",
    occurrenceCount: item.occurrence_count || 1,
    confidenceMax: item.confidence_max || 0,
    time: formatTimestamp(item.timestamp),
    timestamp: item.timestamp,
    rawStatus: item.status || "detected",
    status: STATUS_LABEL[item.status] || item.status || "Pending",
    severity: item.severity || "none",
  }));
}

export function buildCameraBreakdown(items = []) {
  const counts = items.reduce((acc, item) => {
    const camera = item.camera_id || "unknown";
    acc[camera] = (acc[camera] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([camera, count]) => ({ camera, count }));
}

export function buildHourlyBreakdown(items = []) {
  const counts = items.reduce((acc, item) => {
    const dt = new Date(item.timestamp);
    if (Number.isNaN(dt.getTime())) return acc;

    const hour = String(dt.getHours()).padStart(2, "0");
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => ({ hour: `${hour}:00`, count }));
}

export function buildNotifications(items = [], role = "operator") {
  const sourceItems = Array.isArray(items) ? items : items.violations || [];
  const isManager = ["admin", "manager"].includes(role);
  const filteredItems = sourceItems.filter((item) => {
    if (isManager) return item.status === "needs_manager" || ["approved", "rejected"].includes(item.status);
    return ["detected", "pending", "staff_reviewed", "needs_manager"].includes(item.status);
  });

  return filteredItems.slice(0, 12).map((item, index) => {
    const violations = item.violations || [];
    const status = item.status || "pending";

    return {
      id: item.id || index,
      title:
        status === "needs_manager"
          ? "Laporan validasi masuk"
          : status === "detected" || status === "pending"
          ? "Incident baru perlu review"
          : status === "staff_reviewed"
          ? "Incident selesai oleh staff"
          : "Status validasi diperbarui",
      camera: item.camera_id || "Kamera tidak diketahui",
      violations,
      violationText: violations.length ? violations.join(", ") : "Pelanggaran APD",
      summary: compactNotificationSummary(item.summary, violations),
      severity: item.severity || extractSummarySeverity(item.summary),
      status,
      statusText: STATUS_TEXT[status] || status,
      reportSent: Boolean(item.report_sent_at),
      reportSentBy: item.report_sent_by,
      reportSentAt: item.report_sent_at ? formatTimestamp(item.report_sent_at) : "",
      reportNote: item.report_note,
      time: formatTimestamp(item.timestamp),
      read: status !== "needs_manager",
    };
  });
}
