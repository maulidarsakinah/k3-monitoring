from fastapi import APIRouter, Depends, Query, Request

import auth
from app.modules.exports.service import ExportService


router = APIRouter(tags=["Export"])


def get_export_service(request: Request) -> ExportService:
    return request.app.state.export_service


@router.get("/reports/export")
async def export_report(
    format: str = Query("pdf", description="csv / pdf"),
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    status: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_hr),
    service: ExportService = Depends(get_export_service),
):
    return service.export(
        format,
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        status=status,
        severity=severity,
        date_range=date_range,
    )


@router.get("/violations/export/csv")
async def export_csv(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    status: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_hr),
    service: ExportService = Depends(get_export_service),
):
    return service.export(
        "csv",
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        status=status,
        severity=severity,
        date_range=date_range,
    )


@router.get("/violations/export/pdf")
async def export_pdf(
    start_date: str = None,
    end_date: str = None,
    camera_id: str = None,
    status: str = None,
    severity: str = None,
    date_range: str = Query(None, description="today / weekly / monthly"),
    current_user=Depends(auth.require_hr),
    service: ExportService = Depends(get_export_service),
):
    return service.export(
        "pdf",
        start_date=start_date,
        end_date=end_date,
        camera_id=camera_id,
        status=status,
        severity=severity,
        date_range=date_range,
    )

