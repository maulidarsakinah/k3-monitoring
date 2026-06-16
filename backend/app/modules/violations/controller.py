from fastapi import APIRouter, Depends, Query, Request

import auth
from app.modules.violations.service import ViolationService


router = APIRouter(tags=["Violations"])


def get_violation_service(request: Request) -> ViolationService:
    return request.app.state.violation_service


@router.get("/violations")
async def get_violations(
    page: int = Query(1, ge=1, description="Nomor halaman"),
    limit: int = Query(
        50, ge=1, le=500, description="Jumlah data per halaman"),
    camera_id: str = None,
    start_date: str = None,
    end_date: str = None,
    status: str = Query(
        None, description="Filter: detected / staff_reviewed / needs_manager / approved / rejected"),
    severity: str = Query(
        None, description="Filter: none / low / medium / high"),
    date_range: str = Query(
        None, description="Shortcut: today / weekly / monthly"),
    current_user=Depends(auth.require_all),
    service: ViolationService = Depends(get_violation_service),
):
    return service.list_violations(
        page=page,
        limit=limit,
        camera_id=camera_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
        severity=severity,
        date_range=date_range,
    )


@router.get("/violations/stats")
async def get_violation_stats(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all),
    service: ViolationService = Depends(get_violation_service),
):
    return service.get_stats(
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        severity=severity,
        date_range=date_range,
    )


@router.get("/violations/trend")
async def get_violation_trend(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all),
    service: ViolationService = Depends(get_violation_service),
):
    return service.get_trend(start_date=start_date, end_date=end_date, camera_id=camera_id, date_range=date_range)


@router.get("/violations/{violation_id}")
async def get_violation_detail(
    violation_id: int,
    current_user=Depends(auth.require_all),
    service: ViolationService = Depends(get_violation_service),
):
    return service.get_detail(violation_id)


@router.post("/violations/{violation_id}/validate")
async def validate_violation(
    violation_id: int,
    payload: dict,
    current_user=Depends(auth.require_manager),
    service: ViolationService = Depends(get_violation_service),
):
    return service.validate(violation_id, payload.get("action"), current_user["username"], payload.get("note"))


@router.post("/violations/{violation_id}/submit-report")
async def submit_violation_report(
    violation_id: int,
    payload: dict,
    current_user=Depends(auth.require_all),
    service: ViolationService = Depends(get_violation_service),
):
    return service.submit_report(violation_id, current_user["username"], payload.get("note"))


@router.post("/violations/{violation_id}/staff-review")
async def staff_review_violation(
    violation_id: int,
    payload: dict,
    current_user=Depends(auth.require_all),
    service: ViolationService = Depends(get_violation_service),
):
    return service.staff_review(violation_id, current_user["username"], payload.get("note"))


@router.delete("/violations/{violation_id}")
async def delete_violation(
    violation_id: int,
    current_user=Depends(auth.require_hr),
    service: ViolationService = Depends(get_violation_service),
):
    return service.delete(violation_id)


@router.delete("/violations")
async def clear_all_violations(
    current_user=Depends(auth.require_admin),
    service: ViolationService = Depends(get_violation_service),
):
    return service.clear()
