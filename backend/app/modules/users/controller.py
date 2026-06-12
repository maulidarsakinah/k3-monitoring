from fastapi import APIRouter, Depends, HTTPException

import auth


router = APIRouter(tags=["Users"])


@router.get("/users")
async def get_users(current_user=Depends(auth.require_admin)):
    return auth.get_all_users()


@router.get("/users/me")
async def get_me(current_user=Depends(auth.get_current_user)):
    return {**current_user, "role_label": auth.ROLE_LABELS.get(current_user["role"])}


@router.put("/users/{user_id}/role")
async def update_role(user_id: int, payload: dict, current_user=Depends(auth.require_admin)):
    new_role = payload.get("role")
    if not new_role:
        raise HTTPException(status_code=400, detail="Field 'role' wajib diisi")
    return auth.update_user_role(user_id, new_role)


@router.put("/users/{user_id}")
async def update_user(user_id: int, payload: dict, current_user=Depends(auth.require_admin)):
    return auth.update_user(
        user_id,
        username=payload.get("username"),
        role=payload.get("role"),
        password=payload.get("password"),
    )


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, current_user=Depends(auth.require_admin)):
    auth.delete_user(user_id)
    return {"message": "User berhasil dihapus"}

