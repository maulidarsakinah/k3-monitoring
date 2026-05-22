import sqlite3
import json
import logging
from datetime import datetime, timedelta
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
                    severity        TEXT DEFAULT 'none',
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
            conn.execute("CREATE INDEX IF NOT EXISTS idx_severity ON violations (severity)")
            conn.commit()

    def log_violation(self, result: DetectionResult):
        try:
            with self._get_conn() as conn:
                conn.execute(
                    """INSERT INTO violations
                       (camera_id, timestamp, violations, summary, severity, status)
                       VALUES (?, ?, ?, ?, ?, 'pending')""",
                    (result.camera_id, result.timestamp,
                     json.dumps(result.violations), result.summary,
                     result.severity),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Gagal menyimpan log: {e}")

    def _build_where(self, camera_id=None, start_date=None, end_date=None,
                     status=None, severity=None, date_range=None):
        """Build WHERE clause dengan semua filter yang tersedia."""
        where = " WHERE 1=1"
        params = []

        # Quick filter: today, weekly, monthly
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

        if camera_id:
            where += " AND camera_id = ?"
            params.append(camera_id)
        if start_date:
            where += " AND timestamp >= ?"
            params.append(start_date)
        if end_date:
            where += " AND timestamp <= ?"
            params.append(end_date)
        if status:
            where += " AND status = ?"
            params.append(status)
        if severity:
            where += " AND severity = ?"
            params.append(severity)

        return where, params

    def get_violations(self, page: int = 1, limit: int = 50,
                       camera_id=None, start_date=None, end_date=None,
                       status=None, severity=None, date_range=None) -> dict:
        """Paginated violations dengan semua filter."""
        where, params = self._build_where(
            camera_id, start_date, end_date, status, severity, date_range
        )

        # Hitung total
        with self._get_conn() as conn:
            total = conn.execute(
                f"SELECT COUNT(*) FROM violations{where}", params
            ).fetchone()[0]

        # Ambil data dengan pagination
        offset = (page - 1) * limit
        query = f"SELECT * FROM violations{where} ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(query, params + [limit, offset]).fetchall()

        total_pages = (total + limit - 1) // limit if total > 0 else 1

        return {
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "violations": [self._row_to_dict(r) for r in rows],
        }

    def get_violation_by_id(self, violation_id: int) -> dict:
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM violations WHERE id = ?", (violation_id,)
            ).fetchone()
        return self._row_to_dict(row) if row else None

    def validate_violation(self, violation_id: int, action: str,
                           validated_by: str, note: str = None) -> dict:
        if action not in ("approved", "rejected"):
            raise ValueError("Action harus 'approved' atau 'rejected'")
        with self._get_conn() as conn:
            affected = conn.execute(
                """UPDATE violations SET status=?, validated_by=?,
                   validated_at=?, validation_note=? WHERE id=?""",
                (action, validated_by, datetime.now().isoformat(), note, violation_id)
            ).rowcount
            conn.commit()
        if affected == 0:
            return None
        return self.get_violation_by_id(violation_id)

    def delete_violation(self, violation_id: int) -> bool:
        with self._get_conn() as conn:
            affected = conn.execute(
                "DELETE FROM violations WHERE id = ?", (violation_id,)
            ).rowcount
            conn.commit()
        return affected > 0

    def get_stats(self, start_date=None, end_date=None,
                  severity=None, date_range=None) -> dict:
        where, params = self._build_where(
            start_date=start_date, end_date=end_date,
            severity=severity, date_range=date_range
        )
        with self._get_conn() as conn:
            total    = conn.execute(f"SELECT COUNT(*) FROM violations{where}", params).fetchone()[0]
            today    = datetime.now().strftime("%Y-%m-%d")
            today_c  = conn.execute(
                "SELECT COUNT(*) FROM violations WHERE timestamp LIKE ?", (f"{today}%",)
            ).fetchone()[0]
            pending  = conn.execute(f"SELECT COUNT(*) FROM violations{where} AND status='pending'",  params).fetchone()[0]
            approved = conn.execute(f"SELECT COUNT(*) FROM violations{where} AND status='approved'", params).fetchone()[0]
            rejected = conn.execute(f"SELECT COUNT(*) FROM violations{where} AND status='rejected'", params).fetchone()[0]

            # Severity breakdown
            sev_rows = conn.execute(
                f"SELECT severity, COUNT(*) FROM violations{where} GROUP BY severity", params
            ).fetchall()

            v_rows = conn.execute(
                f"SELECT violations FROM violations{where}", params
            ).fetchall()

        violation_counts: dict[str, int] = {}
        for (v_json,) in v_rows:
            for v in json.loads(v_json):
                violation_counts[v] = violation_counts.get(v, 0) + 1

        return {
            "total_violations": total,
            "violations_today": today_c,
            "by_status":   {"pending": pending, "approved": approved, "rejected": rejected},
            "by_severity": {r[0]: r[1] for r in sev_rows},
            "violation_breakdown": violation_counts,
            "filter": {"start_date": start_date, "end_date": end_date,
                       "severity": severity, "date_range": date_range},
        }

    def get_trend(self, start_date=None, end_date=None,
                  camera_id=None, date_range=None) -> list[dict]:
        where, params = self._build_where(
            camera_id=camera_id, start_date=start_date,
            end_date=end_date, date_range=date_range
        )
        query = f"""
            SELECT DATE(timestamp) as date, COUNT(*) as count
            FROM violations{where}
            GROUP BY DATE(timestamp) ORDER BY date ASC
        """
        with self._get_conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [{"date": r[0], "count": r[1]} for r in rows]

    def get_all_for_export(self, start_date=None, end_date=None,
                           camera_id=None, status=None,
                           severity=None, date_range=None) -> list[dict]:
        where, params = self._build_where(
            camera_id, start_date, end_date, status, severity, date_range
        )
        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                f"SELECT * FROM violations{where} ORDER BY timestamp DESC", params
            ).fetchall()
        return [self._row_to_dict(r) for r in rows]

    def _row_to_dict(self, row) -> dict:
        d = dict(row)
        d["violations"] = json.loads(d["violations"])
        return d

    def clear(self):
        with self._get_conn() as conn:
            conn.execute("DELETE FROM violations")
            conn.commit()