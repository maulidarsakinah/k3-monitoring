// ============================================================
// StatisticsPage.jsx — K3 Safety Compliance Analytics Dashboard
// Enterprise-grade · Industrial Monitoring · Decision-Driven
// ============================================================

import { useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Shield,
  Activity,
  Camera,
} from "lucide-react";

// ── Color Palette ──────────────────────────────────────────
const PALETTE = {
  danger: "#ef4444",
  success: "#22c55e",
  warning: "#f59e0b",
  pending: "#6366f1",
  neutral: "#64748b",
  approved: "#10b981",
  rejected: "#f43f5e",
  pie: ["#6366f1", "#f43f5e", "#f59e0b", "#06b6d4", "#8b5cf6"],
};

const toCount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

// ── Skeleton Loader ────────────────────────────────────────
function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 rounded-xl ${className}`}
      style={{
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}

// ── Empty State ────────────────────────────────────────────
function EmptyState({ label = "Belum ada data" }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-2">
      <Activity size={32} strokeWidth={1.5} />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = "slate", loading }) {
  const colorMap = {
    red: { bg: "bg-red-50", text: "text-red-600" },
    green: {
      bg: "bg-emerald-50",
      text: "text-emerald-600",
    },
    yellow: {
      bg: "bg-amber-50",
      text: "text-amber-600",
    },
    indigo: {
      bg: "bg-indigo-50",
      text: "text-indigo-600",
    },
    rose: { bg: "bg-rose-50", text: "text-rose-600" },
    slate: { bg: "bg-slate-50", text: "text-slate-600" },
  };
  const c = colorMap[color] || colorMap.slate;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-16" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className={`p-2 ${c.bg} w-fit rounded-xl ${c.text} mb-3`}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <p className="text-xs font-bold uppercase text-slate-500 mb-1">
        {label}
      </p>
      <h3 className="text-2xl font-bold text-slate-900 mt-1">
        {value}
      </h3>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function InsightMetric({ icon: Icon, label, value, hint, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-32" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center mb-4">
        <Icon size={19} />
      </div>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-1 truncate">{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

// ── Chart Card ─────────────────────────────────────────────
function ChartCard({ title, subtitle, children, loading, className = "" }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 p-6 ${className}`}
    >
      <div className="mb-5">
        <h3 className="font-bold text-slate-900">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-lg space-y-1">
      <p className="font-bold text-slate-300 mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: p.color }}
          />
          <span className="capitalize text-slate-300">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Top Violations Table ───────────────────────────────────
function TopViolations({ data }) {
  if (!data?.length) return <EmptyState label="Belum ada data pelanggaran" />;
  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((item, i) => (
        <div key={item.type} className="flex items-center gap-3">
          <span className="w-6 text-xs font-bold text-slate-500 shrink-0">
            #{i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold text-slate-700 truncate">
                {item.type}
              </span>
              <span className="text-slate-600 font-bold ml-2 shrink-0">{item.count}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(item.count / max) * 100}%`,
                  background: PALETTE.pie[i % PALETTE.pie.length],
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Insight Banner ─────────────────────────────────────────
function InsightBanner({ insights }) {
  if (!insights?.length) return null;
  return (
    <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-wrap gap-4">
      <div className="flex items-center gap-2 text-slate-300 shrink-0">
        <Shield size={16} />
        <span className="text-xs font-bold uppercase">
          Auto Insight
        </span>
      </div>
      <div className="flex flex-wrap gap-3">
        {insights.map((ins, i) => (
          <span
            key={i}
            className="text-xs bg-white/10 px-3 py-1.5 rounded-lg text-slate-200 leading-relaxed"
          >
            {ins}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Data Transforms ────────────────────────────────────────
function transformWeeklyTrend(weeklyTrend = []) {
  return [...weeklyTrend]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((d) => ({
      day: d.date
        ? new Date(d.date).toLocaleDateString("id-ID", {
            weekday: "short",
            day: "numeric",
          })
        : "?",
      violations: toCount(d.violations),
      approved: toCount(d.approved),
      rejected: toCount(d.rejected),
      pending: toCount(d.pending),
      staffReviewed: toCount(d.staffReviewed),
      needsManager: toCount(d.needsManager),
      rawDate: d.date,
    }));
}

function transformViolationTypes(violationTypes = []) {
  return [...violationTypes]
    .filter((v) => v?.type && v?.count != null)
    .map((v) => ({ ...v, count: toCount(v.count) }))
    .filter((v) => v.count > 0)
    .sort((a, b) => b.count - a.count);
}

function buildStackedStatusData(weeklyTrend = []) {
  return transformWeeklyTrend(weeklyTrend)
    .map((d) => ({
      day: d.day,
      Pending: d.pending,
      "Selesai Staff": d.staffReviewed,
      "Disetujui Manager": d.approved,
      Ditolak: d.rejected,
    }))
    .filter(
      (d) =>
        d.Pending +
          d["Selesai Staff"] +
          d["Disetujui Manager"] +
          d.Ditolak >
        0,
    );
}

function buildInsights({
  trendChange,
  pending,
  total,
  peakDay,
  validationRate,
}) {
  const ins = [];
  if (trendChange > 0)
    ins.push(`Pelanggaran naik ${trendChange}% dibanding hari sebelumnya`);
  if (trendChange < 0)
    ins.push(`Pelanggaran turun ${Math.abs(trendChange)}% dibanding hari sebelumnya`);
  if (pending > total * 0.3) ins.push(`${pending} kasus masih menunggu validasi`);
  if (validationRate >= 80)
    ins.push(`Tingkat validasi tinggi: ${validationRate}%`);
  if (peakDay)
    ins.push(
      `Puncak pelanggaran: ${peakDay.day} (${peakDay.violations} kasus)`,
    );
  if (!ins.length) ins.push("Semua metrik berada dalam batas normal");
  return ins;
}

// ── Main Component ─────────────────────────────────────────
export default function StatisticsPage({
  weeklyTrend = [],
  violationTypes = [],
  cameraBreakdown = [],
  hourlyBreakdown = [],
  stats = {},
  loading = false,
  timeRange, // Received from Dashboard
  onTimeRangeChange, // Received from Dashboard
}) {
  // ── Stats Extraction ──
  const totalAll = stats.totalViolations ?? 0;
  const totalToday = stats.violationsToday ?? 0;
  const approved = toCount(stats.by_status?.approved);
  const rejected = toCount(stats.by_status?.rejected);
  const pending = toCount(stats.by_status?.pending);
  const totalRef = totalAll || 1; // avoid div/0

  const validationRate = stats.validationRate ?? stats.complianceRate ?? "0";
  const approvedRate = ((approved / totalRef) * 100).toFixed(1);
  const rejectionRate = ((rejected / totalRef) * 100).toFixed(1);
  const validationRateNumber = parseFloat(validationRate);

  // ── Transformed Chart Data ──
  const trendData = useMemo(
    () => transformWeeklyTrend(weeklyTrend),
    [weeklyTrend],
  );
  const pieData = useMemo(
    () => transformViolationTypes(violationTypes),
    [violationTypes],
  );
  const stackedStatusData = useMemo(
    () => buildStackedStatusData(weeklyTrend),
    [weeklyTrend],
  );

  // ── Derived Metrics ──
  const trendChange = useMemo(() => {
    if (trendData.length < 2) return 0;
    const prev = trendData.at(-2).violations || 1;
    const curr = trendData.at(-1).violations;
    return +(((curr - prev) / prev) * 100).toFixed(1);
  }, [trendData]);

  const peakDay = useMemo(
    () =>
      trendData.reduce(
        (mx, d) => (d.violations > (mx?.violations ?? 0) ? d : mx),
        null,
      ),
    [trendData],
  );

  const topViolation = pieData[0];
  const topCamera = useMemo(
    () =>
      [...cameraBreakdown]
        .map((camera) => ({ ...camera, count: toCount(camera.count) }))
        .filter((camera) => camera.count > 0)
        .sort((a, b) => b.count - a.count)[0],
    [cameraBreakdown],
  );
  const topHour = useMemo(
    () =>
      [...hourlyBreakdown]
        .map((hour) => ({ ...hour, count: toCount(hour.count) }))
        .filter((hour) => hour.count > 0)
        .sort((a, b) => b.count - a.count)[0],
    [hourlyBreakdown],
  );

  const insights = useMemo(
    () =>
      buildInsights({
        trendChange,
        pending,
        total: totalAll,
        peakDay,
        validationRate: validationRateNumber,
        peakHour: hourlyBreakdown.reduce(
          (mx, h) => (h.count > (mx?.count ?? 0) ? h : mx),
          null,
        ),
      }),
    [trendChange, pending, totalAll, peakDay, validationRateNumber, hourlyBreakdown],
  );

  // ── Trend Icon ──
  const TrendIcon = trendChange > 0 ? TrendingUp : TrendingDown;
  const trendColor = trendChange > 0 ? "red" : "green";

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Analytics K3</h2>
          <p className="text-sm text-slate-500 mt-1">
            Monitoring incident APD dan proses validasi secara real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-full border border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
            Live Data
          </span>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          icon={Shield}
          label="Total Semua"
          value={totalAll.toLocaleString()}
          sub="Seluruh periode"
          color="slate"
          loading={loading}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Hari Ini"
          value={totalToday.toLocaleString()}
          sub="Deteksi hari ini"
          color="red"
          loading={loading}
        />
        <KpiCard
          icon={CheckCircle}
          label="Tingkat Disetujui"
          value={`${approvedRate}%`}
          sub={`${approved} kasus`}
          color="green"
          loading={loading}
        />
        <KpiCard
          icon={XCircle}
          label="Tingkat Ditolak"
          value={`${rejectionRate}%`}
          sub={`${rejected} kasus`}
          color="rose"
          loading={loading}
        />
        <KpiCard
          icon={Clock}
          label="Menunggu Validasi"
          value={pending.toLocaleString()}
          sub="Belum divalidasi"
          color="yellow"
          loading={loading}
        />
        <KpiCard
          icon={TrendIcon}
          label="Trend"
          value={`${trendChange > 0 ? "+" : ""}${trendChange}%`}
          sub="vs hari kemarin"
          color={trendColor}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InsightMetric
          icon={AlertTriangle}
          label="Top Pelanggaran"
          value={topViolation?.type || "-"}
          hint={topViolation ? `${topViolation.count} kejadian` : "Belum ada data"}
          loading={loading}
        />
        <InsightMetric
          icon={Camera}
          label="Area Paling Rawan"
          value={topCamera?.camera || "-"}
          hint={topCamera ? `${topCamera.count} deteksi` : "Belum ada data"}
          loading={loading}
        />
        <InsightMetric
          icon={Clock}
          label="Jam Rawan"
          value={topHour?.hour || "-"}
          hint={topHour ? `${topHour.count} deteksi` : "Belum ada data"}
          loading={loading}
        />
      </div>

      {/* ── INSIGHT BANNER ── */}
      {!loading && <InsightBanner insights={insights} />}

      {/* ── ROW 1: Area Chart + Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Area Chart */}
        <ChartCard
          className="lg:col-span-2"
          title="Tren Pelanggaran"
          subtitle="Fluktuasi deteksi harian (7 hari terakhir)"
          loading={loading}
        >
          {trendData.length === 0 ? (
            <EmptyState label="Belum ada data tren" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={trendData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="gradViolations"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={PALETTE.danger}
                      stopOpacity={0.18}
                    />
                    <stop
                      offset="95%"
                      stopColor={PALETTE.danger}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fontWeight: 600, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fontWeight: 600, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotoneX"
                  dataKey="violations"
                  name="Pelanggaran"
                  stroke={PALETTE.danger}
                  strokeWidth={2.5}
                  fill="url(#gradViolations)"
                  dot={{ r: 3.5, fill: PALETTE.danger, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Donut Pie */}
        <ChartCard
          title="Kategori APD"
          subtitle="Distribusi tipe pelanggaran"
          loading={loading}
        >
          {pieData.length === 0 ? (
            <EmptyState label="Belum ada kategori" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="type"
                  >
                    {pieData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PALETTE.pie[i % PALETTE.pie.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {pieData.slice(0, 5).map((item, i) => (
                  <div
                    key={item.type}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-sm shrink-0"
                        style={{
                          background: PALETTE.pie[i % PALETTE.pie.length],
                        }}
                      />
                      <span className="font-semibold text-slate-700 truncate">
                        {item.type}
                      </span>
                    </div>
                    <span className="font-bold text-slate-800 ml-2">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* ── ROW 2: Stacked Bar + Top 5 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Stacked Bar */}
        <ChartCard
          className="lg:col-span-2"
          title="Distribusi Status"
          subtitle="Rincian pending, selesai staff, approved, dan rejected per hari"
          loading={loading}
        >
          {stackedStatusData.length === 0 ? (
            <EmptyState label="Belum ada data status" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={stackedStatusData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                barSize={18}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fontWeight: 600, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fontWeight: 600, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 12 }}
                  formatter={(v) => <span className="text-slate-700">{v}</span>}
                />
                <Bar
                  dataKey="Pending"
                  stackId="status"
                  fill={PALETTE.pending}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Selesai Staff"
                  stackId="status"
                  fill={PALETTE.warning}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Disetujui Manager"
                  stackId="status"
                  fill={PALETTE.approved}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Ditolak"
                  stackId="status"
                  fill={PALETTE.rejected}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top 5 Violations */}
        <ChartCard
          title="Top Pelanggaran"
          subtitle="5 jenis APD paling sering dilanggar"
          loading={loading}
        >
          <TopViolations data={pieData} />

          {/* Summary badges */}
          {!loading && (
            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-xs text-emerald-700 font-bold mb-0.5">
                  Validasi
                </p>
                <p className="text-lg font-bold text-emerald-800">
                  {validationRate}%
                </p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xs text-red-700 font-bold mb-0.5">
                  Rejection
                </p>
                <p className="text-lg font-bold text-red-800">
                  {rejectionRate}%
                </p>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── ROW 3: Camera Hotspot ── */}
      <div className="grid grid-cols-1 gap-5">
        <ChartCard
          title="Hotspot Deteksi per Kamera"
          subtitle="Kamera dengan frekuensi deteksi pelanggaran tertinggi"
          loading={loading}
        >
          {cameraBreakdown.filter((camera) => toCount(camera.count) > 0).length === 0 ? (
            <EmptyState label="Belum ada data kamera" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={cameraBreakdown
                  .map((camera) => ({ ...camera, count: toCount(camera.count) }))
                  .filter((camera) => camera.count > 0)}
                layout="vertical"
                margin={{ left: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f1f5f9"
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="camera"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 600, fill: "#475569" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  fill={PALETTE.pending}
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── ROW 4: Hourly Analysis ── */}
      <div className="grid grid-cols-1 gap-5">
        <ChartCard
          title="Analisis Waktu Pelanggaran (Hourly)"
          subtitle="Distribusi kejadian berdasarkan jam operasional"
          loading={loading}
        >
          {hourlyBreakdown.filter((hour) => toCount(hour.count) > 0).length === 0 ? (
            <EmptyState label="Belum ada data waktu" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={hourlyBreakdown
                  .map((hour) => ({ ...hour, count: toCount(hour.count) }))
                  .filter((hour) => hour.count > 0)}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 12, fontWeight: 600, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fontWeight: 600, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  name="Jumlah Kejadian"
                  fill={PALETTE.pie[0]}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── SHIMMER KEYFRAME (injected once) ── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
      `}</style>
    </div>
  );
}
