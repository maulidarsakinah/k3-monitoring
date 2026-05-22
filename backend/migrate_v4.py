import sqlite3

conn = sqlite3.connect("violations.db")
cols = [row[1] for row in conn.execute("PRAGMA table_info(violations)").fetchall()]
print("Kolom saat ini:", cols)

if "severity" not in cols:
    conn.execute("ALTER TABLE violations ADD COLUMN severity TEXT DEFAULT 'none'")
    conn.commit()
    print("✅ Kolom 'severity' ditambahkan")
else:
    print("⏭  Kolom 'severity' sudah ada")

conn.close()
print("✅ Migrasi selesai!")