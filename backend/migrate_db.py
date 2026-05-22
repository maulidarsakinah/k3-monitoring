import sqlite3

conn = sqlite3.connect("violations.db")

cols = [row[1] for row in conn.execute("PRAGMA table_info(violations)").fetchall()]
print("Kolom saat ini:", cols)

new_columns = [
    ("status",          "TEXT DEFAULT 'pending'"),
    ("validated_by",    "TEXT"),
    ("validated_at",    "TEXT"),
    ("validation_note", "TEXT"),
]

for col_name, col_def in new_columns:
    if col_name not in cols:
        conn.execute(f"ALTER TABLE violations ADD COLUMN {col_name} {col_def}")
        print(f"✅ Kolom '{col_name}' ditambahkan")
    else:
        print(f"⏭  Kolom '{col_name}' sudah ada")

conn.commit()
conn.close()
print("✅ Migrasi selesai!")