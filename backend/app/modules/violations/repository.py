from database import ViolationDatabase


class ViolationRepository:
    def __init__(self, db: ViolationDatabase):
        self.db = db

    def list(self, **filters):
        return self.db.get_violations(**filters)

    def stats(self, **filters):
        return self.db.get_stats(**filters)

    def trend(self, **filters):
        return self.db.get_trend(**filters)

    def get(self, violation_id: int):
        return self.db.get_violation_by_id(violation_id)

    def validate(self, violation_id: int, action: str, username: str, note: str | None):
        return self.db.validate_violation(violation_id, action, username, note)

    def submit_report(self, violation_id: int, username: str, note: str | None):
        return self.db.submit_report(violation_id, username, note)

    def staff_review(self, violation_id: int, username: str, note: str | None):
        return self.db.staff_review(violation_id, username, note)

    def delete(self, violation_id: int) -> bool:
        return self.db.delete_violation(violation_id)

    def clear(self):
        self.db.clear()

    def export_rows(self, **filters):
        return self.db.get_all_for_export(**filters)

