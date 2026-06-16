import io
from datetime import datetime

from fastapi import HTTPException
from fastapi.responses import StreamingResponse

import export as export_module
from app.modules.violations.repository import ViolationRepository


class ExportService:
    def __init__(self, violation_repository: ViolationRepository):
        self.violation_repository = violation_repository

    def rows(self, **filters) -> list[dict]:
        return self.violation_repository.export_rows(**filters)

    def build_response(self, format: str, data: list[dict], title: str = "Laporan Pelanggaran APD") -> StreamingResponse:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if format == "csv":
            file_bytes = export_module.export_csv(data)
            filename = f"laporan_apd_{timestamp}.csv"
            media_type = "text/csv"
        elif format == "pdf":
            try:
                file_bytes = export_module.export_pdf(data, title=title)
            except ImportError:
                raise HTTPException(
                    status_code=503,
                    detail="Library reportlab belum terinstall. Jalankan: pip install reportlab",
                )
            filename = f"laporan_apd_{timestamp}.pdf"
            media_type = "application/octet-stream"
        else:
            raise HTTPException(status_code=400, detail="Format export harus csv atau pdf")

        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    def export(self, format: str, **filters):
        data = self.rows(**filters)
        title = "Laporan Pelanggaran APD"
        if filters.get("start_date") or filters.get("end_date"):
            title += f" ({filters.get('start_date') or '...'} s/d {filters.get('end_date') or '...'})"
        return self.build_response((format or "").lower(), data, title=title)

