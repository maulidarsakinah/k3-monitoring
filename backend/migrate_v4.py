import sqlite3

DB_PATH = "violations.db"

EXTRA_COLUMNS = {
    "severity": "TEXT DEFAULT 'none'",
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


def main():
    with sqlite3.connect(DB_PATH) as conn:
        columns = [row[1] for row in conn.execute("PRAGMA table_info(violations)").fetchall()]
        print("Kolom saat ini:", columns)

        for column, definition in EXTRA_COLUMNS.items():
            if column not in columns:
                conn.execute(f"ALTER TABLE violations ADD COLUMN {column} {definition}")
                print(f"✅ Kolom '{column}' ditambahkan")
            else:
                print(f"⏭  Kolom '{column}' sudah ada")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_severity ON violations (severity)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_incident_key ON violations (incident_key)")
        conn.commit()

    print("✅ Migrasi v4 selesai")


if __name__ == "__main__":
    main()
