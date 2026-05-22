const toDateInput = (date) => date.toISOString().slice(0, 10);

export function getExportDateRange(period, customStartDate = "", customEndDate = "") {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === "daily") {
    return { start_date: toDateInput(start), end_date: toDateInput(end) };
  }

  if (period === "weekly") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return { start_date: toDateInput(start), end_date: toDateInput(end) };
  }

  if (period === "monthly") {
    start.setDate(1);
    return { start_date: toDateInput(start), end_date: toDateInput(end) };
  }

  if (period === "yearly") {
    start.setMonth(0, 1);
    return { start_date: toDateInput(start), end_date: toDateInput(end) };
  }

  if (period === "custom") {
    return { start_date: customStartDate, end_date: customEndDate };
  }

  return {};
}

export const EXPORT_PERIODS = [
  { id: "daily", label: "Harian" },
  { id: "weekly", label: "Mingguan" },
  { id: "monthly", label: "Bulanan" },
  { id: "yearly", label: "Tahunan" },
  { id: "custom", label: "Kustom" },
];
