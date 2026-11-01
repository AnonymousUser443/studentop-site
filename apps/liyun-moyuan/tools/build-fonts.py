"""Build and audit Moyuan's own OFL Noto SC WOFF2 subsets.

Only this app's public/fonts is changed. Full source fonts are explicit inputs;
system font files and other applications are never modified. --check is read-only
unless a new --report path is supplied. Reports use relative paths/basenames.
"""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile
import unicodedata

from fontTools import subset
from fontTools.ttLib import TTFont

APP = Path(__file__).resolve().parents[1]
FONTS = APP / "public/fonts"
SOURCE_FONTS = APP / "src/assets/fonts"


class VisibleHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text = []

    def handle_data(self, data):
        self.text.append(data)

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if value and name in ("aria-label", "title", "alt", "placeholder", "content"):
                self.text.append(value)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def characters(text):
    # Includes all source-language characters, a deliberate superset of JS
    # string literals (including dynamic Canvas labels and future error states).
    escaped = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m[1], 16)), text)
    return {ord(c) for c in escaped if c.isprintable() and not unicodedata.category(c).startswith("C")}


def requirements():
    groups = {}
    hashes = {}
    for file in [APP / "index.html", *sorted((APP / "src").rglob("*"))]:
        if not file.is_file() or file.suffix not in (".html", ".js", ".css"):
            continue
        hashes[file.relative_to(APP).as_posix()] = sha256(file)
        text = file.read_text(encoding="utf-8-sig")
        if file.suffix == ".html":
            parser = VisibleHTML()
            parser.feed(text)
            text = "".join(parser.text)
        # Every ASCII glyph is always included; source groups focus on visible
        # non-ASCII language and symbols so code syntax does not inflate reports.
        groups[file.relative_to(APP).as_posix()] = {c for c in characters(text) if c >= 0x80}
    groups["mandatory-title-and-Canvas"] = characters("理韵墨苑一室风雅一室清和听松风七弦流韵寄幽怀")
    required = set(range(32, 127))
    for chars in groups.values():
        required.update(chars)
    return required, groups, hashes


def missing_details(missing):
    return [{"character": chr(c), "codepoint": f"U+{c:04X}"} for c in sorted(missing)]


def audit_font(path, required, groups):
    with TTFont(path) as font:
        cmap = set(font.getBestCmap())
        missing = required - cmap
        return {
            "file": path.name,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "family": font["name"].getDebugName(1),
            "mappedCodepoints": len(cmap),
            "variationAxes": [{"tag": axis.axisTag, "min": axis.minValue,
                               "default": axis.defaultValue, "max": axis.maxValue}
                              for axis in font["fvar"].axes] if "fvar" in font else [],
            "required": len(required),
            "missing": missing_details(missing),
            "covered": not missing,
            "bySource": [{"source": name, "required": len(chars), "missing": missing_details(chars - cmap)}
                         for name, chars in groups.items()],
        }


def write_report(path, report):
    if path:
        # Evidence paths are new: a historical before/after report is never replaced.
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("x", encoding="utf-8", newline="\n") as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2)
            stream.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sans", type=Path, default=Path("C:/Windows/Fonts/NotoSansSC-VF.ttf"))
    parser.add_argument("--serif", type=Path, default=Path("C:/Windows/Fonts/NotoSerifSC-VF.ttf"))
    parser.add_argument("--check", action="store_true", help="Audit current app WOFF2 files without rebuilding.")
    parser.add_argument("--report", type=Path, help="Save a new audit report; refuses to overwrite evidence.")
    args = parser.parse_args()
    if args.report and args.report.exists():
        parser.error("The requested report already exists; use a new filename.")
    required, groups, source_hashes = requirements()
    report = {"scope": "Moyuan app only: HTML UI, source-language UI states and Canvas labels",
              "mode": "check" if args.check else "build", "requiredCodepoints": len(required),
              "requiredCharacters": "".join(chr(c) for c in sorted(required)),
              "sourceHashes": source_hashes, "builderSHA256": sha256(Path(__file__)), "fonts": []}
    names = ("noto-sans-sc.woff2", "noto-serif-sc.woff2")
    if not args.check:
        licenses = (FONTS / "OFL-NotoSansSC.txt", FONTS / "OFL-NotoSerifSC.txt")
        for license_file in licenses:
            if not license_file.is_file() or "SIL OPEN FONT LICENSE" not in license_file.read_text(encoding="utf-8"):
                raise ValueError("A matching OFL license must be retained before rebuilding.")
        sources = (args.sans.resolve(), args.serif.resolve())
        report["sources"] = []
        for source, family in zip(sources, ("Noto Sans SC", "Noto Serif SC")):
            if not source.is_file():
                raise FileNotFoundError(f"Missing explicit full font source: {source.name}")
            with TTFont(source) as font:
                actual_family = font["name"].getDebugName(1)
                if actual_family != family:
                    raise ValueError(f"Expected OFL {family} source, got {actual_family}")
                missing = required - set(font.getBestCmap())
                report["sources"].append({"file": source.name, "family": actual_family,
                                          "sha256": sha256(source), "missing": missing_details(missing)})
        if any(source["missing"] for source in report["sources"]):
            report["ok"] = False
            write_report(args.report, report)
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 1
        with tempfile.TemporaryDirectory(prefix="moyuan-ofl-fonts-") as temp:
            temp = Path(temp)
            for source, name in zip(sources, names):
                options = subset.Options()
                options.flavor = "woff2"
                options.layout_features = ["*"]
                options.name_IDs = ["*"]
                options.name_languages = ["*"]
                options.notdef_glyph = True
                options.notdef_outline = True
                options.recommended_glyphs = True
                options.ignore_missing_glyphs = False
                font = subset.load_font(str(source), options)
                worker = subset.Subsetter(options=options)
                worker.populate(unicodes=required)
                worker.subset(font)
                subset.save_font(font, str(temp / name), options)
                font.close()
                report["fonts"].append(audit_font(temp / name, required, groups))
            if not all(font["covered"] for font in report["fonts"]):
                raise ValueError("Subset cmap did not cover all required text; app fonts were preserved.")
            SOURCE_FONTS.mkdir(parents=True, exist_ok=True)
            for name in names:
                shutil.copyfile(temp / name, FONTS / name)
                shutil.copyfile(temp / name, SOURCE_FONTS / name)
    else:
        report["fonts"] = [audit_font(FONTS / name, required, groups) for name in names]
        report["bundledSourceFonts"] = [{"file": name, "sha256": sha256(SOURCE_FONTS / name),
                                          "matchesPublic": sha256(SOURCE_FONTS / name) == sha256(FONTS / name)} for name in names]
    report["ok"] = all(font["covered"] for font in report["fonts"])
    write_report(args.report, report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
