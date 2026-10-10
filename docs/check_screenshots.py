"""Verify every image referenced in README.md and docs/*.md exists at the
exact, case-sensitive relative path, and is a non-empty PNG.

Run from the repository root:  python docs/check_screenshots.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARKDOWN_FILES = [ROOT / "README.md", *sorted((ROOT / "docs").glob("*.md"))]
BAD = 0

referenced: set[Path] = set()
for md in MARKDOWN_FILES:
    if not md.exists():
        continue
    text = md.read_text(encoding="utf-8")
    for alt, path in re.findall(r"!\[([^\]]*)\]\(([^)]+)\)", text):
        target = ROOT / path
        referenced.add(target.relative_to(ROOT))
        if not target.exists():
            print(f"MISSING   {path}  (referenced in {md.name})")
            BAD += 1
        elif not path.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
            print(f"NOT-IMAGE {path}  (referenced in {md.name})")
            BAD += 1
        elif target.stat().st_size == 0:
            print(f"EMPTY     {path}")
            BAD += 1
        elif target.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            print(f"NOT-PNG   {path}")
            BAD += 1
        else:
            print(f"OK        {path}")

# Assets on disk that no document references (informational).
on_disk = {p.relative_to(ROOT) for p in (ROOT / "docs" / "screenshots").glob("*.png")}
unreferenced = sorted(p.as_posix() for p in on_disk - referenced)
if unreferenced:
    print("not referenced in any markdown:", ", ".join(unreferenced))

sys.exit(1 if BAD else 0)
