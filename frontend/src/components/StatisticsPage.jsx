// ============================================================
// StatisticsPage.jsx
// Detailed charts page — weekly trend bar chart and violation
// type breakdown bar chart, both built with Recharts.
// ============================================================

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, LineChart, Line
} from "recharts";

export default function StatisticsPage({ weeklyTrend, violationTypes }) {
  return (
    <div className="space-y-6">

      {/* ── Weekly Trend Chart ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tren Pelanggaran Mingguan</h2>
        <p className="text-sm text-gray-400 mb-6">Jumlah pelanggaran vs kepatuhan per hari</p>

        {/* ResponsiveContainer makes the chart fill its parent width */}
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={weeklyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 13, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 13, fill: "#6b7280" }} />
            <Tooltip
              contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
            />
            <Legend />
            {/* Red bars for violations, green for compliant workers */}
            <Bar dataKey="violations" name="Pelanggaran" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="compliant"  name="Patuh"       fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Violation Types Horizontal Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Jenis Pelanggaran Terbanyak</h2>
        <p className="text-sm text-gray-400 mb-6">Total akumulasi per kategori pelanggaran</p>

        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            layout="vertical"
            data={violationTypes}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 13, fill: "#6b7280" }} />
            <YAxis dataKey="type" type="category" tick={{ fontSize: 13, fill: "#6b7280" }} width={110} />
            <Tooltip
              contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
            />
            <Bar dataKey="count" name="Jumlah" fill="#7c3aed" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Line Chart — 7 day trend ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Tren Harian (Line Chart)</h2>
        <p className="text-sm text-gray-400 mb-6">Fluktuasi pelanggaran selama seminggu</p>

        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={weeklyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 13, fill: "#6b7280" }} />
            <YAxis tick={{ fontSize: 13, fill: "#6b7280" }} />
            <Tooltip
              contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
            />
            <Legend />
            <Line
              type="monotone" dataKey="violations" name="Pelanggaran"
              stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: "#ef4444" }}
            />
            <Line
              type="monotone" dataKey="compliant" name="Patuh"
              stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: "#7c3aed" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
