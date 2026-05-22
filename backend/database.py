import sqlite3
import json
import logging
from datetime import datetime, timedelta
from models import DetectionResult

logger = logging.getLogger(__name__)
DB_PATH = "violations.db"
INCIDENT_WINDOW_MINUTES = 5


def _normalize_end_date(end_date: str = None) -> str:
    if end_date and len(end_date) == 10:
        return f"{end_date}T23:59:59"
    return end_date


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
                    evidence_path   TEXT,
                    report_sent_by  TEXT,
                    report_sent_at  TEXT,
                    report_note     TEXT,
                    created_at      TEXT DEFAULT (datetime('now'))
                )
            """)
            columns = [row[1] for row in conn.execute("PRAGMA table_info(violations)").fetchall()]
            extra_columns = {
                "evidence_path": "TEXT",
                "report_sent_by": "TEXT",
                "report_sent_at": "TEXT",
                "report_note": "TEXT",
                "staff_reviewed_by": "TEXT",
                "staff_reviewed_at": "TEXT",
                "staff_note": "TEXT",
                "first_detected_at": "TEXT",
                "last_detected_at": "TEXT",
                "occurrence_count": "INTEGER DEFAULT 1",
                "confidence_avg": "REAL DEFAULT 0",
                "confidence_max": "REAL DEFAULT 0",
                "incident_key": "TEXT",
            }
            for column, column_type in extra_columns.items():
                if column not in columns:
                    conn.execute(f"ALTER TABLE violations ADD COLUMN {column} {column_type}")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_camera_id ON violations (camera_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON violations (timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_status ON violations (status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_incident_key ON violations (incident_key)")
            conn.commit()

    def log_violation(self, result: DetectionResult, evidence_path: str = None):
        try:
            incident_key = self._incident_key(result.camera_id, result.violations)
            confidence = self._max_confidence(result)
            timestamp = result.timestamp or datetime.now().isoformat()
            try:
                parsed_timestamp = datetime.fromisoformat(timestamp)
            except ValueError:
                parsed_timestamp = datetime.now()
            cutoff = (parsed_timestamp - timedelta(minutes=INCIDENT_WINDOW_MINUTES)).isoformat()

            with self._get_conn() as conn:
                conn.row_factory = sqlite3.Row
                existing = conn.execute(
                    """SELECT * FROM violations
                       WHERE incident_key = ?
                         AND status IN ('detected', 'pending')
                         AND COALESCE(last_detected_at, timestamp) >= ?
                       ORDER BY COALESCE(last_detected_at, timestamp) DESC
                       LIMIT 1""",
                    (incident_key, cutoff),
                ).fetchone()

                if existing:
                    count = (existing["occurrence_count"] or 1) + 1
                    old_avg = existing["confidence_avg"] or 0
                    next_avg = ((old_avg * (count - 1)) + confidence) / count
                    next_max = max(existing["confidence_max"] or 0, confidence)
                    conn.execute(
                        """UPDATE violations
                           SET last_detected_at=?, occurrence_count=?, confidence_avg=?,
                               confidence_max=?, summary=?, evidence_path=COALESCE(?, evidence_path)
                           WHERE id=?""",
                        (timestamp, count, next_avg, next_max, result.summary, evidence_path, existing["id"]),
                    )
                else:
                    conn.execute(
                        """INSERT INTO violations (
                               camera_id, timestamp, violations, summary, status, evidence_path,
                               first_detected_at, last_detected_at, occurrence_count,
                               confidence_avg, confidence_max, incident_key
                           )
                           VALUES (?, ?, ?, ?, 'detected', ?, ?, ?, 1, ?, ?, ?)""",
                        (
                            result.camera_id,
                            timestamp,
                            json.dumps(result.violations),
                            result.summary,
                            evidence_path,
                            timestamp,
                            timestamp,
                            confidence,
                            confidence,
                            incident_key,
                        ),
                    )
                conn.commit()
        except Exception as e:
            logger.error(f"Gagal menyimpan log: {e}")

    def get_violations(self, limit: int = 50, camera_id: str = None,
                       start_date: str = None, end_date: str = None,
                       status: str = None) -> list[dict]:
        end_date = _normalize_end_date(end_date)
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

    def submit_report(self, violation_id: int, sent_by: str, note: str = None) -> dict:
        with self._get_conn() as conn:
            affected = conn.execute(
                """UPDATE violations
                   SET status='needs_manager', report_sent_by=?, report_sent_at=?, report_note=?
                   WHERE id=? AND status IN ('detected', 'pending', 'staff_reviewed')""",
                (sent_by, datetime.now().isoformat(), note, violation_id),
            ).rowcount
            conn.commit()
        if affected == 0:
            return None
        return self.get_violation_by_id(violation_id)

    def staff_review(self, violation_id: int, reviewed_by: str, note: str = None) -> dict:
        with self._get_conn() as conn:
            affected = conn.execute(
                """UPDATE violations
                   SET status='staff_reviewed', staff_reviewed_by=?, staff_reviewed_at=?, staff_note=?
                   WHERE id=? AND status IN ('detected', 'pending')""",
                (reviewed_by, datetime.now().isoformat(), note, violation_id),
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
        end_date = _normalize_end_date(end_date)
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
            detected = conn.execute(
                f"SELECT COUNT(*) FROM violations{where} AND status IN ('detected', 'pending')", params_filter
            ).fetchone()[0]
            needs_manager = conn.execute(
                f"SELECT COUNT(*) FROM violations{where} AND status='needs_manager'", params_filter
            ).fetchone()[0]
            staff_reviewed = conn.execute(
                f"SELECT COUNT(*) FROM violations{where} AND status='staff_reviewed'", params_filter
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
            "by_status": {
                "pending": detected + needs_manager,
                "detected": detected,
                "staff_reviewed": staff_reviewed,
                "needs_manager": needs_manager,
                "approved": approved,
                "rejected": rejected,
            },
            "violation_breakdown": violation_counts,
            "filter": {"start_date": start_date, "end_date": end_date},
        }

    def get_trend(self, start_date: str = None, end_date: str = None,
                  camera_id: str = None) -> list[dict]:
        end_date = _normalize_end_date(end_date)
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
        end_date = _normalize_end_date(end_date)
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
        d["first_detected_at"] = d.get("first_detected_at") or d.get("timestamp")
        d["last_detected_at"] = d.get("last_detected_at") or d.get("timestamp")
        d["occurrence_count"] = d.get("occurrence_count") or 1
        d["confidence_avg"] = d.get("confidence_avg") or 0
        d["confidence_max"] = d.get("confidence_max") or 0
        return d

    def _incident_key(self, camera_id: str, violations: list[str]) -> str:
        return f"{camera_id}:{','.join(sorted(violations or []))}"

    def _max_confidence(self, result: DetectionResult) -> float:
        values = [
            detection.confidence
            for detection in result.detections
            if detection.is_violation
        ]
        if not values:
            values = [detection.confidence for detection in result.detections]
        return max(values) if values else 0.85

    def clear(self):
        with self._get_conn() as conn:
            conn.execute("DELETE FROM violations")
            conn.commit()
