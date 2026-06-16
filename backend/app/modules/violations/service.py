from fastapi import HTTPException

from app.modules.violations.repository import ViolationRepository


class ViolationService:
    def __init__(self, repository: ViolationRepository):
        self.repository = repository

    def list_violations(self, **filters):
        return self.repository.list(**filters)

    def get_stats(self, **filters):
        return self.repository.stats(**filters)

    def get_trend(self, **filters):
        return self.repository.trend(**filters)

    def get_detail(self, violation_id: int):
        violation = self.repository.get(violation_id)
        if not violation:
            raise HTTPException(status_code=404, detail="Pelanggaran tidak ditemukan")
        return violation

    def validate(self, violation_id: int, action: str, username: str, note: str | None):
        if action not in ("approved", "rejected"):
            raise HTTPException(status_code=400, detail="action harus 'approved' atau 'rejected'")
        violation = self.get_detail(violation_id)
        if violation["status"] not in ("needs_manager", "pending"):
            raise HTTPException(
                status_code=400,
                detail=f"Pelanggaran sudah divalidasi sebelumnya: {violation['status']}",
            )
        result = self.repository.validate(violation_id, action, username, note)
        return {"message": f"Pelanggaran berhasil di-{action}", "violation": result}

    def submit_report(self, violation_id: int, username: str, note: str | None):
        violation = self.get_detail(violation_id)
        if violation["status"] not in ("detected", "pending", "staff_reviewed"):
            raise HTTPException(
                status_code=400,
                detail=f"Pelanggaran tidak bisa dikirim ke Manager: {violation['status']}",
            )
        result = self.repository.submit_report(
            violation_id,
            username,
            note or "Dikirim ke Manager untuk validasi",
        )
        if not result:
            raise HTTPException(status_code=400, detail="Laporan gagal dikirim")
        return {"message": "Laporan berhasil dikirim ke Manager", "violation": result}

    def staff_review(self, violation_id: int, username: str, note: str | None):
        violation = self.get_detail(violation_id)
        if violation["status"] not in ("detected", "pending"):
            raise HTTPException(
                status_code=400,
                detail=f"Pelanggaran tidak bisa direview staff: {violation['status']}",
            )
        result = self.repository.staff_review(
            violation_id,
            username,
            note or "Direview Staff Operasional",
        )
        if not result:
            raise HTTPException(status_code=400, detail="Review staff gagal disimpan")
        return {"message": "Incident berhasil ditandai selesai oleh staff", "violation": result}

    def delete(self, violation_id: int):
        if not self.repository.delete(violation_id):
            raise HTTPException(status_code=404, detail="Pelanggaran tidak ditemukan")
        return {"message": "Pelanggaran berhasil dihapus"}

    def clear(self):
        self.repository.clear()
        return {"message": "Semua log pelanggaran berhasil dihapus"}

