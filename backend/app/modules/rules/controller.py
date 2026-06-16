from fastapi import APIRouter, Depends

import auth
import rules as rule_module


router = APIRouter(tags=["Rules"])


@router.get("/rules")
async def get_rules(current_user=Depends(auth.require_all)):
    return rule_module.get_all_rules()


@router.get("/rules/camera/{camera_id}")
async def get_rules_by_camera(camera_id: int, current_user=Depends(auth.require_all)):
    return rule_module.get_rules_by_camera(camera_id)


@router.post("/rules")
async def create_rule(data: rule_module.RuleCreate, current_user=Depends(auth.require_manager)):
    return rule_module.create_rule(data)


@router.put("/rules/{rule_id}")
async def update_rule(rule_id: int, data: rule_module.RuleUpdate, current_user=Depends(auth.require_manager)):
    return rule_module.update_rule(rule_id, data)


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: int, current_user=Depends(auth.require_manager)):
    rule_module.delete_rule(rule_id)
    return {"message": "Rule berhasil dihapus"}

