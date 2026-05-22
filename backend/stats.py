import json
import sqlite3
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
            where += " AND timestamp >= ?"
            params.append(now.strftime("%Y-%m-%dT00:00:00"))
        elif date_range == "weekly":
            where += " AND timestamp >= ?"
            params.append((now - timedelta(days=7)).isoformat())
        elif date_range == "monthly":
            where += " AND timestamp >= ?"
            params.append((now - timedelta(days=30)).isoformat())
    if start_date:
        where += " AND timestamp >= ?"
        params.append(start_date)
    if end_date:
        if len(end_date) == 10:
            end_date = f"{end_date}T23:59:59"
        where += " AND timestamp <= ?"
        params.append(end_date)
    return where, params


def get_trend(start_date=None, end_date=None, camera_id=None, date_range=None) -> list[dict]:
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
    return [{"date": row[0], "count": row[1]} for row in rows]


def get_distribution(start_date=None, end_date=None, camera_id=None, date_range=None) -> dict:
    where, params = _build_date_filter(start_date, end_date, date_range)
    if camera_id:
        where += " AND camera_id = ?"
        params.append(camera_id)
    with _get_conn() as conn:
        rows = conn.execute(f"SELECT violations FROM violations{where}", params).fetchall()

    counts: dict[str, int] = {}
    for (violations_json,) in rows:
        for violation in json.loads(violations_json):
            counts[violation] = counts.get(violation, 0) + 1
    return dict(sorted(counts.items(), key=lambda item: item[1], reverse=True))


def get_heatmap(start_date=None, end_date=None, camera_id=None, date_range=None) -> dict:
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

    heatmap = {f"{hour:02d}": 0 for hour in range(24)}
    for hour, count in rows:
        if hour:
            heatmap[hour] = count
    return heatmap


def get_kpi() -> dict:
    today = datetime.now().strftime("%Y-%m-%d")
    with _get_conn() as conn:
        violations_today = conn.execute(
            "SELECT COUNT(*) FROM violations WHERE timestamp LIKE ?",
            (f"{today}%",),
        ).fetchone()[0]
        pending_count = conn.execute(
            "SELECT COUNT(*) FROM violations WHERE status IN ('detected', 'pending', 'needs_manager')"
        ).fetchone()[0]
        total_all = conn.execute("SELECT COUNT(*) FROM violations").fetchone()[0]
        severity_today = conn.execute(
            """SELECT COALESCE(severity, 'none'), COUNT(*) FROM violations
               WHERE timestamp LIKE ? GROUP BY severity""",
            (f"{today}%",),
        ).fetchall()
        per_camera = conn.execute(
            """SELECT camera_id, COUNT(*) FROM violations
               WHERE timestamp LIKE ? GROUP BY camera_id
               ORDER BY COUNT(*) DESC LIMIT 5""",
            (f"{today}%",),
        ).fetchall()
        resolved = conn.execute(
            """SELECT COUNT(*) FROM violations
               WHERE status IN ('approved', 'rejected', 'staff_reviewed')"""
        ).fetchone()[0]

    validation_rate = round((resolved / total_all) * 100, 1) if total_all else 0
    return {
        "violations_today": violations_today,
        "pending_validation": pending_count,
        "validation_rate": validation_rate,
        "total_violations_all_time": total_all,
        "severity_today": {row[0]: row[1] for row in severity_today},
        "top_cameras_today": [
            {"camera_id": row[0], "count": row[1]} for row in per_camera
        ],
        "generated_at": datetime.now().isoformat(),
    }
