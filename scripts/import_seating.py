#!/usr/bin/env python3
"""Re-import seating data from the Oct 14 seating workbook.

The workbook keeps the previous chart on "Seating Chart" and the revised
guest lists on "Edit". Floor-plan percentages match the venue sketch:
tables 1–8 on the lounge-left side of the dance floor, 9–15 on the right.
"""
from openpyxl import load_workbook
import json, re, sys
from collections import OrderedDict
from pathlib import Path

DEFAULT_XLSX = Path.home() / "Downloads" / "Seating Chart_Oct 14.xlsx"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "guests.json"

# Percentages on the live floor plan (same dots as the venue sketch).
POSITIONS = {
    "1": {"x": 30, "y": 25},
    "2": {"x": 30, "y": 39},
    "3": {"x": 17, "y": 32},
    "4": {"x": 8, "y": 39},
    "5": {"x": 17, "y": 47},
    "6": {"x": 8, "y": 54},
    "7": {"x": 18, "y": 62},
    "8": {"x": 30, "y": 53},
    "9": {"x": 67, "y": 25},
    "10": {"x": 67, "y": 39},
    "11": {"x": 80, "y": 32},
    "12": {"x": 87, "y": 42},
    "13": {"x": 79, "y": 50},
    "14": {"x": 67, "y": 53},
    "15": {"x": 80, "y": 62},
    "16": {"x": 67, "y": 68},
}
HEADER_RE = re.compile(r"^(.*?)\s*\((\d+)\)\s*$")
NAME_FIXES = {"Art Instituite of Chicago": "Art Institute of Chicago"}

def is_count_cell(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)

def clean_name(v):
    if v is None or is_count_cell(v):
        return None
    s = str(v).strip()
    if not s or re.fullmatch(r"\d+(\.0+)?", s):
        return None
    return re.sub(r"\s+", " ", s)

def main():
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    wb = load_workbook(xlsx, data_only=True)
    # "Edit" is the Oct 14 revision; "Seating Chart" is the previous arrangement.
    sheet_name = "Edit" if "Edit" in wb.sheetnames else "Seating Chart"
    if sheet_name not in wb.sheetnames:
        raise SystemExit(f"Missing sheet {sheet_name!r}. Found: {wb.sheetnames}")
    ws = wb[sheet_name]
    blocks = []
    for r in range(1, (ws.max_row or 0) + 1):
        headers = {}
        for c in range(1, (ws.max_column or 0) + 1):
            v = ws.cell(r, c).value
            if v is None:
                continue
            m = HEADER_RE.match(str(v).strip())
            if m:
                headers[c] = (m.group(2), NAME_FIXES.get(m.group(1).strip(), m.group(1).strip()))
        if headers:
            blocks.append({"header_row": r, "headers": headers})
    tables = OrderedDict((str(i), {"name": "Vendor Table" if i == 16 else None, "guests": []}) for i in range(1, 17))
    for i, block in enumerate(blocks):
        start = block["header_row"] + 1
        end = blocks[i + 1]["header_row"] - 1 if i + 1 < len(blocks) else block["header_row"] + 40
        end = min(end, block["header_row"] + 40)
        for c, (tid, tname) in block["headers"].items():
            tables[tid]["name"] = tname
            for r in range(start, end + 1):
                guest = clean_name(ws.cell(r, c).value)
                if guest:
                    tables[tid]["guests"].append(guest)
    out = {
        "event": {
            "title": "Suri–Brown Wedding Reception",
            "headline": "Find your seat",
            "date": "October 16, 2026",
            "venue": "Grand Ballroom",
        },
        "source": {
            "file": xlsx.name,
            "sheet": sheet_name,
            "note": "Guest lists and table names from the Edit sheet. Floor-plan positions follow the Oct 14 venue sketch (tables 1–8 left of the dance floor, 9–15 right).",
        },
        "tables": {k: {"name": v["name"], "guests": v["guests"]} for k, v in tables.items()},
        "positions": POSITIONS,
    }
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(len(t["guests"]) for t in tables.values())
    print(f"Wrote {OUT} ({total} guests across {len(tables)} tables)")

if __name__ == "__main__":
    main()
