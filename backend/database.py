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
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    camera_id   TEXT NOT NULL,
                    timestamp   TEXT NOT NULL,
                    violations  TEXT NOT NULL,  -- JSON array
                    summary     TEXT,
                    created_at  TEXT DEFAULT (datetime('now'))
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_camera_id ON violations (camera_id)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_timestamp ON violations (timestamp)
            """)
            conn.commit()
        logger.info("Database diinisialisasi")

    def log_violation(self, result: DetectionResult):
        try:
            with self._get_conn() as conn:
                conn.execute(
                    """INSERT INTO violations (camera_id, timestamp, violations, summary)
                       VALUES (?, ?, ?, ?)""",
                    (
                        result.camera_id,
                        result.timestamp,
                        json.dumps(result.violations),
                        result.summary,
                    ),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Gagal menyimpan log: {e}")

    def get_violations(
        self,
        limit: int = 50,
        camera_id: str = None,
        start_date: str = None,
        end_date: str = None,
    ) -> list[dict]:
        query = "SELECT id, camera_id, timestamp, violations, summary FROM violations WHERE 1=1"
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

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        with self._get_conn() as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(query, params).fetchall()

        return [
            {
                "id": r["id"],
                "camera_id": r["camera_id"],
                "timestamp": r["timestamp"],
                "violations": json.loads(r["violations"]),
                "summary": r["summary"],
            }
            for r in rows
        ]

    def get_stats(self) -> dict:
        with self._get_conn() as conn:
            total = conn.execute("SELECT COUNT(*) FROM violations").fetchone()[0]
            today = datetime.now().strftime("%Y-%m-%d")
            today_count = conn.execute(
                "SELECT COUNT(*) FROM violations WHERE timestamp LIKE ?",
                (f"{today}%",)
            ).fetchone()[0]

            rows = conn.execute(
                "SELECT violations FROM violations ORDER BY timestamp DESC LIMIT 500"
            ).fetchall()

        # Hitung frekuensi tiap jenis pelanggaran
        violation_counts: dict[str, int] = {}
        for (v_json,) in rows:
            for v in json.loads(v_json):
                violation_counts[v] = violation_counts.get(v, 0) + 1

        return {
            "total_violations": total,
            "violations_today": today_count,
            "violation_breakdown": violation_counts,
        }

    def clear(self):
        with self._get_conn() as conn:
            conn.execute("DELETE FROM violations")
            conn.commit()