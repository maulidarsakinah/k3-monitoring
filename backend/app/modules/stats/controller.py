from fastapi import APIRouter, Depends, Query

import auth
import stats as stats_module


router = APIRouter(tags=["Stats"])


@router.get("/stats/trend")
async def stats_trend(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all),
):
    return stats_module.get_trend(
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        severity=severity,
        date_range=date_range,
    )


@router.get("/stats/distribution")
async def stats_distribution(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all),
):
    return stats_module.get_distribution(
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        severity=severity,
        date_range=date_range,
    )


@router.get("/stats/heatmap")
async def stats_heatmap(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all),
):
    return stats_module.get_heatmap(
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        severity=severity,
        date_range=date_range,
    )


@router.get("/stats/cameras")
async def stats_cameras(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_all),
):
    return stats_module.get_camera_breakdown(
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        severity=severity,
        date_range=date_range,
    )


@router.get("/stats/kpi")
async def stats_kpi(current_user=Depends(auth.require_all)):
    return stats_module.get_kpi()

