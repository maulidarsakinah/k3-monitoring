"""
Export laporan pelanggaran APD ke CSV atau PDF.
"""
import csv
import io
from datetime import datetime
from typing import List


def export_csv(data: list[dict]) -> bytes:
    """Generate CSV dari data pelanggaran."""
    output = io.StringIO()
    fieldnames = [
        "id", "camera_id", "timestamp", "violations",
        "summary", "severity", "status", "report_sent_by", "report_sent_at",
        "report_note", "validated_by", "validated_at", "validation_note",
        "staff_reviewed_by", "staff_reviewed_at", "staff_note",
        "first_detected_at", "last_detected_at", "occurrence_count",
        "confidence_max", "auto_review", "evidence_path"
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for row in data:
        row_copy = row.copy()
        # violations adalah list, join jadi string
        row_copy["violations"] = "; ".join(row_copy.get("violations", []))
        row_copy["auto_review"] = "yes" if row_copy.get("staff_reviewed_by") == "system" else "no"
        writer.writerow(row_copy)
    return output.getvalue().encode("utf-8-sig")  # utf-8-sig agar Excel bisa baca


def _format_violation_list(violations: list[str]) -> str:
    if not violations:
        return "-"
    return "<br/>".join(f"{idx}. {item}" for idx, item in enumerate(violations, 1))


def export_pdf(data: list[dict], title: str = "Laporan Pelanggaran APD") -> bytes:
    """Generate PDF dari data pelanggaran menggunakan reportlab."""
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=1.5*cm, rightMargin=1.5*cm,
        topMargin=2*cm, bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], fontSize=16,
                                  spaceAfter=6, alignment=TA_CENTER)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9,
                                spaceAfter=12, alignment=TA_CENTER, textColor=colors.grey)
    cell_style = ParagraphStyle("cell", parent=styles["Normal"], fontSize=7, leading=10)
    violation_style = ParagraphStyle(
        "violation",
        parent=cell_style,
        leftIndent=0,
        leading=11,
        spaceAfter=0,
    )

    elements = []

    # Header
    elements.append(Paragraph(title, title_style))
    elements.append(Paragraph(
        f"Digenerate pada: {datetime.now().strftime('%d %B %Y %H:%M')} | Total: {len(data)} pelanggaran",
        sub_style
    ))
    elements.append(Spacer(1, 0.3*cm))

    if not data:
        elements.append(Paragraph("Tidak ada data pelanggaran.", styles["Normal"]))
        doc.build(elements)
        return buffer.getvalue()

    # Tabel header
    headers = [
        "No",
        "Kamera",
        "Waktu",
        "Pelanggaran APD",
        "Status",
        "Incident",
        "Laporan Staff",
        "Validasi",
    ]
    table_data = [headers]

    status_colors = {
        "detected": colors.blue,
        "staff_reviewed": colors.grey,
        "needs_manager": colors.purple,
        "pending":  colors.orange,
        "approved": colors.green,
        "rejected": colors.red,
    }

    for i, row in enumerate(data, 1):
        violations_text = _format_violation_list(row.get("violations", []))
        timestamp = row.get("timestamp", "")[:19].replace("T", " ")
        validated_at = (row.get("validated_at") or "")[:16].replace("T", " ")
        validated_by = row.get("validated_by") or "-"
        if row.get("staff_reviewed_by") == "system":
            validated_by = "Auto-reviewed by system"
        if validated_at:
            validated_by = f"{validated_by}\n{validated_at}"
        report_at = (row.get("report_sent_at") or "")[:16].replace("T", " ")
        report_by = row.get("report_sent_by") or "-"
        if report_at:
            report_by = f"{report_by}\n{report_at}"
        incident_info = (
            f"{row.get('occurrence_count') or 1} kejadian\n"
            f"Severity: {(row.get('severity') or 'none').upper()}\n"
            f"Conf max: {round((row.get('confidence_max') or 0) * 100)}%"
        )
        if row.get("staff_reviewed_by") == "system":
            incident_info += "\nAuto Review"

        table_data.append([
            str(i),
            Paragraph(row.get("camera_id", "-"), cell_style),
            Paragraph(timestamp, cell_style),
            Paragraph(violations_text, violation_style),
            Paragraph(row.get("status", "pending").upper(), cell_style),
            Paragraph(incident_info, cell_style),
            Paragraph(report_by, cell_style),
            Paragraph(f"{validated_by}\n{row.get('validation_note') or '-'}", cell_style),
        ])

    col_widths = [1*cm, 3*cm, 4*cm, 7*cm, 2.7*cm, 3*cm, 3.5*cm, 4*cm]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)

    style = TableStyle([
        # Header
        ("BACKGROUND",   (0, 0), (-1, 0), colors.HexColor("#1a3c5e")),
        ("TEXTCOLOR",    (0, 0), (-1, 0), colors.white),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0), 8),
        ("ALIGN",        (0, 0), (-1, 0), "CENTER"),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        # Body
        ("FONTNAME",     (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",     (0, 1), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
        ("GRID",         (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("LEFTPADDING",  (0, 0), (-1, -1), 4),
    ])

    # Warnai kolom status sesuai nilainya
    for i, row in enumerate(data, 1):
        s = row.get("status", "pending")
        color = status_colors.get(s, colors.grey)
        style.add("TEXTCOLOR", (4, i), (4, i), color)
        style.add("FONTNAME",  (4, i), (4, i), "Helvetica-Bold")

    table.setStyle(style)
    elements.append(table)

    doc.build(elements)
    return buffer.getvalue()
