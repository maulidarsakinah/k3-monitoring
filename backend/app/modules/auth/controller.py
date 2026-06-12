from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

import auth


router = APIRouter(tags=["Auth"])


@router.post("/auth/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = auth.get_user_by_username(form_data.username)
    if not user or not auth.verify_password(form_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = auth.create_access_token({"sub": user["username"], "role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "role_label": auth.ROLE_LABELS.get(user["role"], user["role"]),
    }


@router.post("/auth/register")
async def register(payload: dict, current_user=Depends(auth.require_admin)):
    username = payload.get("username")
    password = payload.get("password")
    role = payload.get("role", "operator")
    if not username or not password:
        raise HTTPException(status_code=400, detail="username dan password wajib diisi")
    user = auth.create_user(username, password, role)
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "role_label": auth.ROLE_LABELS.get(user["role"]),
    }


@router.post("/auth/change-password")
async def change_password(payload: dict, current_user=Depends(auth.get_current_user)):
    old_pw = payload.get("old_password")
    new_pw = payload.get("new_password")
    user = auth.get_user_by_username(current_user["username"])
    if not auth.verify_password(old_pw, user["password"]):
        raise HTTPException(status_code=400, detail="Password lama salah")
    auth.update_user(user["id"], password=new_pw)
    return {"message": "Password berhasil diubah"}


@router.get("/auth/roles")
async def get_roles():
    return [{"role": k, "label": v} for k, v in auth.ROLE_LABELS.items()]

