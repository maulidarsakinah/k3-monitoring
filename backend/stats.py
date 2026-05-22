"""
Endpoint statistik dashboard:
- /stats/trend        → line chart time series
- /stats/distribution → pie chart jenis pelanggaran
- /stats/heatmap      → jam rawan pelanggaran
- /stats/kpi          → KPI cards dashboard
"""
import sqlite3
import json
from datetime import datetime, timedelta

DB_PATH = "violations.db"


def _get_conn():
    return sqlite3.connect(DB_PATH)


def _build_date_filter(start_date=None, end_date=None, date_range=None):
    where = " WHERE 1=1"
    params = []
    if date_range:
        now = datetime.now()
        if date_range == "today":
            start = now.strftime("%Y-%m-%d 00:00:00")
            where += " AND timestamp >= ?"
            params.append(start)
        elif date_range == "weekly":
            start = (now - timedelta(days=7)).strftime("%Y-%m-%d 00:00:00")
            where += " AND timestamp >= ?"
            params.append(start)
        elif date_range == "monthly":
            start = (now - timedelta(days=30)).strftime("%Y-%m-%d 00:00:00")
            where += " AND timestamp >= ?"
            params.append(start)
    if start_date:
        where += " AND timestamp >= ?"
        params.append(start_date)
    if end_date:
        where += " AND timestamp <= ?"
        params.append(end_date)
    return where, params


def get_trend(start_date=None, end_date=None, camera_id=None, date_range=None) -> list[dict]:
    """Line chart — jumlah pelanggaran per tanggal."""
    where, params = _build_date_filter(start_date, end_date, date_range)
    if camera_id:
        where += " AND camera_id = ?"
        params.append(camera_id)
    query = f"""
        SELECT DATE(timestamp) as date, COUNT(*) as count
        FROM violations{where}
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
    """
    with _get_conn() as conn:
        rows = conn.execute(query, params).fetchall()
    return [{"date": r[0], "count": r[1]} for r in rows]


def get_distribution(start_date=None, end_date=None,
                     camera_id=None, date_range=None) -> dict:
    """Pie chart — distribusi jenis pelanggaran."""
    where, params = _build_date_filter(start_date, end_date, date_range)
    if camera_id:
        where += " AND camera_id = ?"
        params.append(camera_id)
    query = f"SELECT violations FROM violations{where}"
    with _get_conn() as conn:
        rows = conn.execute(query, params).fetchall()

    counts: dict[str, int] = {}
    for (v_json,) in rows:
        for v in json.loads(v_json):
            counts[v] = counts.get(v, 0) + 1

    # Urutkan dari terbanyak
    return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True))


def get_heatmap(start_date=None, end_date=None,
                camera_id=None, date_range=None) -> dict:
    """Heatmap — jam rawan pelanggaran (00-23)."""
    where, params = _build_date_filter(start_date, end_date, date_range)
    if camera_id:
        where += " AND camera_id = ?"
        params.append(camera_id)
    query = f"""
        SELECT strftime('%H', timestamp) as hour, COUNT(*) as count
        FROM violations{where}
        GROUP BY strftime('%H', timestamp)
        ORDER BY hour ASC
    """
    with _get_conn() as conn:
        rows = conn.execute(query, params).fetchall()

    # Isi semua jam 00-23 dengan 0 dulu, lalu update yang ada datanya
    heatmap = {f"{h:02d}": 0 for h in range(24)}
    for (hour, count) in rows:
        if hour:
            heatmap[hour] = count

    return heatmap


def get_kpi() -> dict:
    """KPI cards — ringkasan kondisi kepatuhan K3 real-time."""
    today = datetime.now().strftime("%Y-%m-%d")

    with _get_conn() as conn:
        # Total pelanggaran hari ini
        violations_today = conn.execute(
            "SELECT COUNT(*) FROM violations WHERE timestamp LIKE ?",
            (f"{today}%",)
        ).fetchone()[0]

        # Total pending (all time)
        pending_count = conn.execute(
            "SELECT COUNT(*) FROM violations WHERE status = 'pending'"
        ).fetchone()[0]

        # Total semua pelanggaran (all time) untuk hitung compliance rate
        total_all = conn.execute(
            "SELECT COUNT(*) FROM violations"
        ).fetchone()[0]

        # Severity breakdown hari ini
        severity_today = conn.execute(
            """SELECT severity, COUNT(*) FROM violations
               WHERE timestamp LIKE ? GROUP BY severity""",
            (f"{today}%",)
        ).fetchall()

        # Pelanggaran per kamera hari ini
        per_camera = conn.execute(
            """SELECT camera_id, COUNT(*) as count FROM violations
               WHERE timestamp LIKE ? GROUP BY camera_id
               ORDER BY count DESC LIMIT 5""",
            (f"{today}%",)
        ).fetchall()

    # Compliance rate:
    # Estimasi: setiap pelanggaran = 1 kejadian tidak patuh
    # Asumsi baseline 100 frame per hari per kamera
    # Rumus sederhana: compliance = 100 - (violations_today / max(violations_today, 1) * 100)
    # Lebih realistis: berdasarkan perbandingan approved vs total
    with _get_conn() as conn:
        approved_today = conn.execute(
            "SELECT COUNT(*) FROM violations WHERE timestamp LIKE ? AND status = 'approved'",
            (f"{today}%",)
        ).fetchone()[0]

    # Compliance rate = persentase pelanggaran yang sudah resolved (approved)
    # Jika tidak ada pelanggaran hari ini = 100% compliant
    if violations_today == 0:
        compliance_rate = 100.0
    else:
        compliance_rate = round((approved_today / violations_today) * 100, 1)

    return {
        "violations_today": violations_today,
        "pending_validation": pending_count,
        "compliance_rate": compliance_rate,
        "total_violations_all_time": total_all,
        "severity_today": {r[0]: r[1] for r in severity_today},
        "top_cameras_today": [
            {"camera_id": r[0], "count": r[1]} for r in per_camera
        ],
        "generated_at": datetime.now().isoformat(),
    }