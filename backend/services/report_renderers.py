"""Unicode PDF and formula-free XLSX. No HTML, external images or formulas."""

import io
import math
import re
from datetime import datetime
from pathlib import Path
from threading import Lock
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from backend.services.versioned_models import failure

REPORT_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")
FONT_LOCK = Lock()
AI_TITLES = {
    "overview": "Tổng quan",
    "notable_factors": "Điểm đáng chú ý",
    "interpretation": "Diễn giải",
    "limitations": "Giới hạn",
    "reference_suggestions": "Gợi ý tham khảo",
}


def plain(value):
    if value is None:
        return "Chưa có dữ liệu"
    if isinstance(value, datetime):
        return value.astimezone(REPORT_TIMEZONE).strftime("%d/%m/%Y %H:%M:%S (UTC+7)")
    if isinstance(value, bool):
        return "Có" if value else "Không"
    if isinstance(value, float) and not math.isfinite(value):
        failure(409, "REPORT_INVALID_DATA", "Nguồn chứa số liệu không hợp lệ.")
    result = str(value)
    return re.sub(
        r"[\x00-\x08\x0b\x0c\x0e-\x1f]",
        lambda match: f"\\u{ord(match.group()):04x}",
        result,
    )


def tables(document):
    parts = [
        {
            "title": "Tổng quan",
            "headers": ["Thông tin", "Giá trị"],
            "rows": [
                ["Tiêu đề", document["title"]],
                ["Ngày xuất (TP.HCM)", document["created_at"]],
                *document["metadata"],
            ],
        },
        *document["sections"],
    ]
    # Copy rows: formatting an export must never mutate the verified source.
    return [
        dict(
            part,
            rows=[
                [
                    timestamp_cell(
                        value,
                        part["headers"][column]
                        + (
                            str(row[0])
                            if column == 1 and len(part["headers"]) == 2
                            else ""
                        ),
                    )
                    for column, value in enumerate(row)
                ]
                for row in part["rows"]
            ],
        )
        for part in parts
    ]


def timestamp_cell(value, label):
    if isinstance(value, str) and any(
        marker in label
        for marker in (
            "TP.HCM",
            "Thời điểm",
            "Ngày tạo",
            "Ngày xuất",
            "Mốc đọc",
        )
    ):
        try:
            parsed = datetime.fromisoformat(value)
            if parsed.tzinfo is not None:
                return parsed
        except ValueError:
            pass
    return value


def ai_rows(document):
    if not document["ai"]:
        return []
    return [
        [AI_TITLES[name], item]
        for name, value in document["ai"].items()
        for item in (value if isinstance(value, list) else [value])
        if name in AI_TITLES
    ]


def xlsx(document):
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter
    except ImportError:
        failure(
            503, "REPORT_DEPENDENCY_MISSING", "Máy chủ chưa cài openpyxl để xuất Excel."
        )
    workbook = Workbook()
    workbook.properties.creator = "MK eAI"
    workbook.properties.title = document["title"]
    workbook.remove(workbook.active)
    sections = tables(document)
    sections[0]["rows"].append(["Kết luận theo dữ liệu", document["summary"]])
    if document["ai"]:
        rows = []
        for title, value in ai_rows(document):
            text = plain(value)
            parts = [text[i : i + 600] for i in range(0, len(text), 600)] or [""]
            rows.extend(
                [
                    [
                        title if len(parts) == 1 else f"{title} ({i + 1}/{len(parts)})",
                        part,
                    ]
                    for i, part in enumerate(parts)
                ]
            )
        sections.append(
            {
                "title": "Nhận xét bởi AI",
                "headers": ["Nhận xét được tạo bởi AI", "Nội dung"],
                "rows": rows,
            }
        )
    sections.append(
        {
            "title": "Ghi chú",
            "headers": ["Nội dung"],
            "rows": [[note] for note in document["notes"]],
        }
    )
    for index, part in enumerate(sections):
        # Fixed renderer titles only; collision suffixes never use client strings.
        name = part["title"][:27]
        if name in workbook.sheetnames:
            name += f" {index}"
        sheet = workbook.create_sheet(name)
        count = len(part["headers"])
        sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=count)
        sheet.cell(1, 1, "MK eAI | " + part["title"])
        sheet.cell(1, 1).font = Font(name="Calibri", size=16, bold=True, color="454EAF")
        sheet.row_dimensions[1].height = 28
        sheet.cell(
            2,
            1,
            document.get(
                "sheet_caption",
                "Ngày giờ TP.HCM (UTC+7); số liệu thiếu được ghi rõ. Xác suất là đầu ra mô hình.",
            ),
        )
        sheet.cell(2, 1).font = Font(size=10, color="637084")
        sheet.merge_cells(start_row=2, start_column=1, end_row=2, end_column=count)
        for column, header in enumerate(part["headers"], 1):
            cell = sheet.cell(4, column, header)
            cell.fill = PatternFill("solid", fgColor="454EAF")
            cell.font = Font(bold=True, color="FFFFFF")
            cell.alignment = Alignment(wrap_text=True, vertical="center")
            sheet.column_dimensions[get_column_letter(column)].width = (
                34 if count <= 4 else 25
            )
        sheet.row_dimensions[4].height = 32
        for row_index, row in enumerate(part["rows"], 5):
            max_lines = 1
            for column, value in enumerate(row, 1):
                label = part["headers"][column - 1] + (
                    str(row[0]) if column == 2 and count == 2 else ""
                )
                if value is None:
                    value = "Chưa có dữ liệu"
                cell = sheet.cell(row_index, column)
                if isinstance(value, datetime):
                    cell.value = value.astimezone(REPORT_TIMEZONE).replace(tzinfo=None)
                    cell.number_format = "yyyy-mm-dd hh:mm:ss"
                elif isinstance(value, (int, float)) and not isinstance(value, bool):
                    plain(value)
                    cell.value = value
                    cell.number_format = (
                        '0.0000" điểm %"'
                        if "điểm %" in label
                        else "0.00%"
                        if "Xác suất" in label
                        else "#,##0.0000"
                        if isinstance(value, float)
                        else "#,##0"
                    )
                else:
                    cell.value = plain(value)
                    cell.data_type = (
                        "s"  # Never let =,+,-,@ or whitespace become a formula.
                    )
                cell.font = Font(name="Calibri", size=11, color="25304A")
                cell.alignment = Alignment(vertical="top", wrap_text=True)
                if row_index % 2:
                    cell.fill = PatternFill("solid", fgColor="F3F5FA")
                max_lines = max(
                    max_lines, math.ceil(len(plain(value)) / (30 if count <= 4 else 22))
                )
            sheet.row_dimensions[row_index].height = min(409, max(24, max_lines * 16))
        sheet.freeze_panes = "A5"
        sheet.auto_filter.ref = f"A4:{get_column_letter(count)}{sheet.max_row}"
        sheet.sheet_view.showGridLines = False
        sheet.print_title_rows = "1:4"
        sheet.sheet_properties.pageSetUpPr.fitToPage = True
        sheet.page_setup.orientation = "landscape" if count > 4 else "portrait"
        sheet.page_setup.paperSize = sheet.PAPERSIZE_A4
        sheet.page_setup.fitToWidth, sheet.page_setup.fitToHeight = 1, 0
    stream = io.BytesIO()
    workbook.save(stream)
    return stream.getvalue()


def register_font():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    with FONT_LOCK:
        if "MKeAI" in pdfmetrics.getRegisteredFontNames():
            return
        candidates = [
            (Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/arialbd.ttf")),
            (
                Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
                Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
            ),
        ]
        for regular, bold in candidates:
            if regular.is_file() and bold.is_file():
                pdfmetrics.registerFont(TTFont("MKeAI", str(regular)))
                pdfmetrics.registerFont(TTFont("MKeAI-Bold", str(bold)))
                return
        failure(
            503,
            "REPORT_FONT_UNAVAILABLE",
            "Chưa có font Unicode phù hợp để xuất PDF tiếng Việt.",
        )


def pdf(document):
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.platypus import (
            CondPageBreak,
            LongTable,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            TableStyle,
        )
    except ImportError:
        failure(
            503, "REPORT_DEPENDENCY_MISSING", "Máy chủ chưa cài ReportLab để xuất PDF."
        )
    register_font()
    styles = {
        "title": ParagraphStyle(
            "title",
            fontName="MKeAI-Bold",
            fontSize=20,
            leading=25,
            textColor=colors.HexColor("#454EAF"),
            spaceAfter=10,
        ),
        "heading": ParagraphStyle(
            "heading",
            fontName="MKeAI-Bold",
            fontSize=11,
            leading=15,
            spaceBefore=12,
            spaceAfter=7,
            keepWithNext=False,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="MKeAI",
            fontSize=9,
            leading=13,
            spaceAfter=6,
            splitLongWords=True,
        ),
        "cell": ParagraphStyle(
            "cell",
            fontName="MKeAI",
            fontSize=8,
            leading=11,
            splitLongWords=True,
            wordWrap="CJK",
        ),
        "header": ParagraphStyle(
            "header",
            fontName="MKeAI-Bold",
            fontSize=8,
            leading=11,
            textColor=colors.white,
        ),
    }

    def para(value, style="cell"):
        return Paragraph(escape(plain(value)).replace("\n", "<br/>"), styles[style])

    story = [para("MK eAI", "title"), para(document["title"], "heading")]
    for part in tables(document):
        story.append(CondPageBreak(85))
        story.append(para(part["title"], "heading"))
        rows = [[para(header, "header") for header in part["headers"]]]
        for row in part["rows"]:
            values = []
            for column, value in enumerate(row):
                header = part["headers"][column]
                text = (
                    f"{value:.2%}"
                    if "Xác suất" in header and isinstance(value, (int, float))
                    else value
                )
                values.append(para(text))
            rows.append(values)
        width = A4[0] - 72
        count = len(part["headers"])
        widths = [width * 0.32, width * 0.68] if count == 2 else [width / count] * count
        table = LongTable(
            rows,
            colWidths=widths,
            repeatRows=1,
            splitByRow=1,
            splitInRow=1,
            hAlign="LEFT",
        )
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#454EAF")),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#F3F5FA")],
                    ),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5EAF2")),
                ]
            )
        )
        story.extend([table, Spacer(1, 4)])
    story.extend(
        [
            CondPageBreak(65),
            para("Kết luận theo dữ liệu", "heading"),
            para(document["summary"], "body"),
        ]
    )
    if document["ai"]:
        story.append(CondPageBreak(85))
        story.append(para("Nhận xét được tạo bởi AI", "heading"))
        for title, value in ai_rows(document):
            story.extend(
                [CondPageBreak(65), para(title, "heading"), para(value, "body")]
            )
    story.extend([CondPageBreak(65), para("Ghi chú và giới hạn", "heading")])
    story.extend(para(note, "body") for note in document["notes"])

    def footer(canvas, doc):
        canvas.setFont("MKeAI", 8)
        canvas.setFillColor(colors.HexColor("#637084"))
        canvas.drawString(36, 21, "MK eAI | Phân tích hành vi khách hàng")
        canvas.drawRightString(A4[0] - 36, 21, f"Trang {doc.page}")

    stream = io.BytesIO()
    SimpleDocTemplate(
        stream,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=30,
        bottomMargin=40,
        title=document["title"],
        author="MK eAI",
    ).build(story, onFirstPage=footer, onLaterPages=footer)
    return stream.getvalue()
