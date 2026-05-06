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
function EmptyState({ label = "No data available" }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
      <Activity size={32} strokeWidth={1.5} />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = "slate", loading }) {
  const colorMap = {
    red: { bg: "bg-red-50", text: "text-red-600", val: "text-red-700" },
    green: {
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      val: "text-emerald-700",
    },
    yellow: {
      bg: "bg-amber-50",
      text: "text-amber-600",
      val: "text-amber-700",
    },
    indigo: {
      bg: "bg-indigo-50",
      text: "text-indigo-600",
      val: "text-indigo-700",
    },
    rose: { bg: "bg-rose-50", text: "text-rose-600", val: "text-rose-700" },
    slate: { bg: "bg-slate-50", text: "text-slate-600", val: "text-slate-800" },
  };
  const c = colorMap[color] || colorMap.slate;

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-16" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 group">
      <div className={`p-2 ${c.bg} w-fit rounded-xl ${c.text} mb-3`}>
        <Icon size={18} strokeWidth={2} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </p>
      <h3 className={`text-2xl font-extrabold tracking-tight ${c.val}`}>
        {value}
      </h3>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Chart Card ─────────────────────────────────────────────
function ChartCard({ title, subtitle, children, loading, className = "" }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 p-6 shadow-sm ${className}`}
    >
      <div className="mb-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
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
  if (!data?.length) return <EmptyState label="No violation data" />;
  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="space-y-3">
      {data.slice(0, 5).map((item, i) => (
        <div key={item.type} className="flex items-center gap-3">
          <span className="w-5 text-xs font-bold text-slate-400 shrink-0">
            #{i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-slate-700 truncate">
                {item.type}
              </span>
              <span className="text-slate-500 ml-2 shrink-0">{item.count}</span>
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
      <div className="flex items-center gap-2 text-slate-400 shrink-0">
        <Shield size={16} />
        <span className="text-xs font-bold uppercase tracking-widest">
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
      violations: d.violations ?? 0,
      approved: d.approved ?? 0,
      rejected: d.rejected ?? 0,
      pending: d.pending ?? 0,
      rawDate: d.date,
    }));
}

function transformViolationTypes(violationTypes = []) {
  return [...violationTypes]
    .filter((v) => v?.type && v?.count != null)
    .sort((a, b) => b.count - a.count);
}

function buildStackedData(weeklyTrend = []) {
  return transformWeeklyTrend(weeklyTrend).map((d) => {
    return {
      day: d.day,
      Approved: d.approved,
      Rejected: d.rejected,
      Pending: d.pending,
    };
  });
}

function buildInsights({
  trendChange,
  pending,
  total,
  peakDay,
  complianceRate,
}) {
  const ins = [];
  if (trendChange > 0)
    ins.push(`⚠️ Pelanggaran naik ${trendChange}% vs kemarin`);
  if (trendChange < 0)
    ins.push(`✅ Pelanggaran turun ${Math.abs(trendChange)}% vs kemarin`);
  if (pending > total * 0.3) ins.push(`⏳ ${pending} kasus belum divalidasi`);
  if (complianceRate >= 80)
    ins.push(`🏆 Compliance rate tinggi: ${complianceRate}%`);
  if (peakDay)
    ins.push(
      `📈 Puncak minggu ini: ${peakDay.day} (${peakDay.violations} kasus)`,
    );
  if (!ins.length) ins.push("📊 Semua metrik dalam batas normal");
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
  const approved = stats.by_status?.approved ?? 0;
  const rejected = stats.by_status?.rejected ?? 0;
  const pending = stats.by_status?.pending ?? 0;
  const totalRef = totalAll || 1; // avoid div/0

  const approvedRate = ((approved / totalRef) * 100).toFixed(1);
  const rejectionRate = ((rejected / totalRef) * 100).toFixed(1);
  const complianceRate = parseFloat(approvedRate);

  // ── Transformed Chart Data ──
  const trendData = useMemo(
    () => transformWeeklyTrend(weeklyTrend),
    [weeklyTrend],
  );
  const pieData = useMemo(
    () => transformViolationTypes(violationTypes),
    [violationTypes],
  );
  const stackedData = useMemo(
    () => buildStackedData(weeklyTrend),
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

  const insights = useMemo(
    () =>
      buildInsights({
        trendChange,
        pending,
        total: totalAll,
        peakDay,
        complianceRate,
        peakHour: hourlyBreakdown.reduce(
          (mx, h) => (h.count > (mx?.count ?? 0) ? h : mx),
          null,
        ),
      }),
    [trendChange, pending, totalAll, peakDay, complianceRate, hourlyBreakdown],
  );

  // ── Trend Icon ──
  const TrendIcon = trendChange > 0 ? TrendingUp : TrendingDown;
  const trendColor = trendChange > 0 ? "red" : "green";

  return (
    <div className="space-y-5 font-sans">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
            Analytics K3
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Safety Compliance Monitoring · Real-time
          </p>
        </div>
        {/* Time Range Filter (Moved from Dashboard header to here for better context) */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
            Live Data
          </span>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={Shield}
          label="Total Semua"
          value={totalAll.toLocaleString()}
          sub="All time"
          color="slate"
          loading={loading}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Hari Ini"
          value={totalToday.toLocaleString()}
          sub="Today's detections"
          color="red"
          loading={loading}
        />
        <KpiCard
          icon={CheckCircle}
          label="Approved Rate"
          value={`${approvedRate}%`}
          sub={`${approved} kasus`}
          color="green"
          loading={loading}
        />
        <KpiCard
          icon={XCircle}
          label="Rejection Rate"
          value={`${rejectionRate}%`}
          sub={`${rejected} kasus`}
          color="rose"
          loading={loading}
        />
        <KpiCard
          icon={Clock}
          label="Pending Review"
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
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
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
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-sm shrink-0"
                        style={{
                          background: PALETTE.pie[i % PALETTE.pie.length],
                        }}
                      />
                      <span className="text-slate-600 truncate">
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
          subtitle="Breakdown approved / rejected / pending per hari"
          loading={loading}
        >
          {stackedData.length === 0 ? (
            <EmptyState label="Belum ada data status" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={stackedData}
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
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  formatter={(v) => <span className="text-slate-500">{v}</span>}
                />
                <Bar
                  dataKey="Approved"
                  stackId="s"
                  fill={PALETTE.approved}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Rejected"
                  stackId="s"
                  fill={PALETTE.rejected}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="Pending"
                  stackId="s"
                  fill={PALETTE.pending}
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
                <p className="text-xs text-emerald-600 font-semibold mb-0.5">
                  Compliance
                </p>
                <p className="text-lg font-extrabold text-emerald-700">
                  {approvedRate}%
                </p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xs text-red-600 font-semibold mb-0.5">
                  Rejection
                </p>
                <p className="text-lg font-extrabold text-red-700">
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
          {cameraBreakdown.length === 0 ? (
            <EmptyState label="Belum ada data kamera" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={cameraBreakdown}
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
          {hourlyBreakdown.length === 0 ? (
            <EmptyState label="Belum ada data waktu" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={hourlyBreakdown}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
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
