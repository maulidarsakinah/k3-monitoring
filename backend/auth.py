from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
import sqlite3

SECRET_KEY = "apd-k3-secret-key-ganti-ini-di-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

DB_PATH = "violations.db"

# ── Role hierarchy ─────────────────────────────────────────────────────────────
# admin          → akun admin/manager utama
# manager        → validasi pelanggaran, kelola kamera & aturan, export laporan
# operator       → Staff Operasional, monitoring dan kirim laporan ke manager

# ------- username & Password
# -- admin / manager
# username: admin
# password: admin123

# -- manager
# username: manager01
# password: manager123

# -- staff operasional
# username: staff01
# password: staff123

VALID_ROLES = ("admin", "manager", "operator")

ROLE_LABELS = {
    "admin":           "Manager / Admin",
    "manager":         "Manager",
    "operator":        "Staff Operasional",
}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah expired",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    username = payload.get("sub")
    role = payload.get("role")
    if not username:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    return {"username": username, "role": role}


def require_role(*allowed_roles: str):
    def checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Dibutuhkan role: {list(allowed_roles)}"
            )
        return current_user
    return checker


# Shortcut dependencies
require_admin      = require_role("admin")
require_manager    = require_role("admin", "manager")
require_gm         = require_role("admin", "manager", "general_manager")
require_hr         = require_role("admin", "manager")
require_all        = require_role(*VALID_ROLES)  # semua role login boleh


def _get_conn():
    return sqlite3.connect(DB_PATH)


def init_user_table():
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                username    TEXT UNIQUE NOT NULL,
                password    TEXT NOT NULL,
                role        TEXT NOT NULL DEFAULT 'operator',
                created_at  TEXT DEFAULT (datetime('now'))
            )
        """)
        conn.commit()
    _create_default_users()


def _create_default_users():
    default_users = [
        ("admin", "admin123", "admin"),
        ("manager01", "manager123", "manager"),
        ("staff01", "staff123", "operator"),
    ]
    with _get_conn() as conn:
        for username, password, role in default_users:
            exists = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
            if exists:
                continue
            conn.execute(
                "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                (username, hash_password(password), role)
            )
        conn.commit()


def get_user_by_username(username: str) -> Optional[dict]:
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    return dict(row) if row else None


def get_all_users() -> list[dict]:
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT id, username, role, created_at FROM users ORDER BY id").fetchall()
    return [dict(r) for r in rows]


def create_user(username: str, password: str, role: str = "operator") -> dict:
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Role tidak valid. Pilih: {list(VALID_ROLES)}")
    try:
        with _get_conn() as conn:
            conn.execute(
                "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                (username, hash_password(password), role)
            )
            conn.commit()
        return get_user_by_username(username)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail=f"Username '{username}' sudah digunakan")


def update_user_role(user_id: int, new_role: str) -> dict:
    if new_role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Role tidak valid. Pilih: {list(VALID_ROLES)}")
    with _get_conn() as conn:
        affected = conn.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, user_id)).rowcount
        conn.commit()
    if affected == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT id, username, role FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row)


def update_user(user_id: int, username: str = None, role: str = None, password: str = None) -> dict:
    fields = {}
    if username:
        fields["username"] = username
    if role:
        if role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"Role tidak valid. Pilih: {list(VALID_ROLES)}")
        fields["role"] = role
    if password:
        fields["password"] = hash_password(password)

    if not fields:
        raise HTTPException(status_code=400, detail="Tidak ada field yang diupdate")

    set_clause = ", ".join(f"{key} = ?" for key in fields)
    values = list(fields.values()) + [user_id]
    try:
        with _get_conn() as conn:
            affected = conn.execute(f"UPDATE users SET {set_clause} WHERE id = ?", values).rowcount
            conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail=f"Username '{username}' sudah digunakan")

    if affected == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    with _get_conn() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT id, username, role, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row)


def delete_user(user_id: int):
    with _get_conn() as conn:
        admin_count = conn.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'").fetchone()[0]
        target = conn.execute("SELECT role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        if target[0] == "admin" and admin_count <= 1:
            raise HTTPException(status_code=400, detail="Tidak bisa hapus admin terakhir")
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
