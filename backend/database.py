import sqlite3
import json
import logging
from datetime import datetime
from models import DetectionResult

logger = logging.getLogger(__name__)
DB_PATH = "violations.db"


class ViolationDatabase:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS violations (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    camera_id       TEXT NOT NULL,
                    timestamp       TEXT NOT NULL,
                    violations      TEXT NOT NULL,
                    summary         TEXT,
                    status          TEXT DEFAULT 'pending',
                    validated_by    TEXT,
                    validated_at    TEXT,
                    validation_note TEXT,
                    created_at      TEXT DEFAULT (datetime('now'))
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_camera_id ON violations (camera_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON violations (timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_status ON violations (status)")
            conn.commit()

    def log_violation(self, result: DetectionResult):
        try:
            with self._get_conn() as conn:
                conn.execute(
                    """INSERT INTO violations (camera_id, timestamp, violations, summary, status)
                       VALUES (?, ?, ?, ?, 'pending')""",
                    (result.camera_id, result.timestamp,
                     json.dumps(result.violations), result.summary),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Gagal menyimpan log: {e}")

    def get_violations(self, limit: int = 50, camera_id: str = None,
                       start_date: str = None, end_date: str = None,
                       status: str = None) -> list[dict]:
        query = "SELECT * FROM violations WHERE 1=1"
        params = []
        if camera_id:
            query += " AND camera_id = ?"
            params.append(camera_id)
        if start_date:
            query += " AND timestamp >= ?"
            params.append(start_date)
        if end_date:
            query += " AND timestamp <= ?"
            params.append(end_date)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(query, params).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def get_violation_by_id(self, violation_id: int) -> dict:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM violations WHERE id = ?", (violation_id,)).fetchone()
        if not row:
            return None
        return self._row_to_dict(row)

    def validate_violation(self, violation_id: int, action: str,
                           validated_by: str, note: str = None) -> dict:
        """action: 'approved' atau 'rejected'"""
        if action not in ("approved", "rejected"):
            raise ValueError("Action harus 'approved' atau 'rejected'")
        with self._get_conn() as conn:
            affected = conn.execute(
                """UPDATE violations SET status=?, validated_by=?, validated_at=?, validation_note=?
                   WHERE id=?""",
                (action, validated_by, datetime.now().isoformat(), note, violation_id)
            ).rowcount
            conn.commit()
        if affected == 0:
            return None
        return self.get_violation_by_id(violation_id)

    def delete_violation(self, violation_id: int) -> bool:
        with self._get_conn() as conn:
            affected = conn.execute("DELETE FROM violations WHERE id = ?", (violation_id,)).rowcount
            conn.commit()
        return affected > 0

    def get_stats(self, start_date: str = None, end_date: str = None) -> dict:
        params_filter = []
        where = " WHERE 1=1"
        if start_date:
            where += " AND timestamp >= ?"
            params_filter.append(start_date)
        if end_date:
            where += " AND timestamp <= ?"
            params_filter.append(end_date)

        with self._get_conn() as conn:
            total = conn.execute(f"SELECT COUNT(*) FROM violations{where}", params_filter).fetchone()[0]
            today = datetime.now().strftime("%Y-%m-%d")
            today_count = conn.execute(
                "SELECT COUNT(*) FROM violations WHERE timestamp LIKE ?", (f"{today}%",)
            ).fetchone()[0]
            pending = conn.execute(
                f"SELECT COUNT(*) FROM violations{where} AND status='pending'", params_filter
            ).fetchone()[0]
            approved = conn.execute(
                f"SELECT COUNT(*) FROM violations{where} AND status='approved'", params_filter
            ).fetchone()[0]
            rejected = conn.execute(
                f"SELECT COUNT(*) FROM violations{where} AND status='rejected'", params_filter
            ).fetchone()[0]
            rows = conn.execute(f"SELECT violations FROM violations{where}", params_filter).fetchall()

        violation_counts: dict[str, int] = {}
        for (v_json,) in rows:
            for v in json.loads(v_json):
                violation_counts[v] = violation_counts.get(v, 0) + 1

        return {
            "total_violations": total,
            "violations_today": today_count,
            "by_status": {"pending": pending, "approved": approved, "rejected": rejected},
            "violation_breakdown": violation_counts,
            "filter": {"start_date": start_date, "end_date": end_date},
        }

    def get_trend(self, start_date: str = None, end_date: str = None,
                  camera_id: str = None) -> list[dict]:
        query = "SELECT DATE(timestamp) as date, COUNT(*) as count FROM violations WHERE 1=1"
        params = []
        if start_date:
            query += " AND timestamp >= ?"
            params.append(start_date)
        if end_date:
            query += " AND timestamp <= ?"
            params.append(end_date)
        if camera_id:
            query += " AND camera_id = ?"
            params.append(camera_id)
        query += " GROUP BY DATE(timestamp) ORDER BY date ASC"
        with self._get_conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [{"date": r[0], "count": r[1]} for r in rows]

    def get_all_for_export(self, start_date: str = None, end_date: str = None,
                           camera_id: str = None, status: str = None) -> list[dict]:
        """Ambil semua data tanpa limit untuk export."""
        query = "SELECT * FROM violations WHERE 1=1"
        params = []
        if start_date:
            query += " AND timestamp >= ?"
            params.append(start_date)
        if end_date:
            query += " AND timestamp <= ?"
            params.append(end_date)
        if camera_id:
            query += " AND camera_id = ?"
            params.append(camera_id)
        if status:
            query += " AND status = ?"
            params.append(status)
        query += " ORDER BY timestamp DESC"
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(query, params).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def _row_to_dict(self, row) -> dict:
        d = dict(row)
        d["violations"] = json.loads(d["violations"])
        return d

    def clear(self):
        with self._get_conn() as conn:
            conn.execute("DELETE FROM violations")
            conn.commit()