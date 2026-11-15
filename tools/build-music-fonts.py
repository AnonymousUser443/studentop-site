"""Generate the music app's local, Unicode-range WOFF2 font slices.

Requires the already installed fontTools and Brotli packages. The source font is
read-only. UI characters are grouped first so the app's own labels usually need
only a small number of slices; the remaining font coverage is split into groups
of at most 512 codepoints. No source glyphs are removed from the combined set.

Normal browsing uses the checked-in output and does not run this script.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile

try:
    import fontTools
    from fontTools import subset
    from fontTools.ttLib import TTFont
except ImportError as error:
    raise SystemExit("This rebuild needs the existing fontTools/WOFF2 environment.") from error

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "site/assets/fonts/music"
CSS_PATH = ROOT / "site/assets/css/music-fonts.css"
MANIFEST_PATH = ROOT / "docs/tingchao/font-manifest.json"
LICENSE_PATH = ROOT / "site/assets/fonts/OFL-NotoSansSC.txt"
FAMILY = "Tingchao UI"
SAMPLES = ("听潮", "夜航日光", "龘", "㐀", "䶵", "𠮷")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def unicode_cmap(font: TTFont) -> dict[int, str]:
    result: dict[int, str] = {}
    for table in font["cmap"].tables:
        if table.isUnicode() and hasattr(table, "cmap"):
            result.update(table.cmap)
    return result


def ranges(codepoints: list[int]) -> str:
    runs: list[tuple[int, int]] = []
    for codepoint in sorted(codepoints):
        if runs and codepoint == runs[-1][1] + 1:
            runs[-1] = (runs[-1][0], codepoint)
        else:
            runs.append((codepoint, codepoint))
    return ",".join(
        f"U+{start:04X}" if start == end else f"U+{start:04X}-{end:04X}"
        for start, end in runs
    )


def make_groups(coverage: set[int], size: int) -> list[tuple[str, list[int]]]:
    # These are public app source strings, never account or network data.
    common = set(range(0x20, 0x7F))
    ui_root = ROOT / "apps/aidenos-music/src/ui"
    for path in sorted(ui_root.rglob("*")):
        if path.suffix in {".ts", ".tsx", ".css"} and path.is_file():
            common.update(ord(character) for character in path.read_text(encoding="utf-8"))
    common &= coverage
    ordered_common = sorted(common)
    remaining = sorted(coverage - common)
    groups: list[tuple[str, list[int]]] = []
    for kind, points in (("base", ordered_common), ("full", remaining)):
        for start in range(0, len(points), size):
            groups.append((f"tingchao-ui-{kind}-{start // size:03d}.woff2", points[start:start + size]))
    return groups


def build_slice(task: tuple[str, str, list[int], str]) -> dict:
    source_name, name, codepoints, temporary_dir = task
    font = TTFont(source_name, recalcTimestamp=False)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17, 25]
    options.name_languages = [0x409]
    options.name_legacy = True
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recommended_glyphs = True
    options.recalc_timestamp = False
    options.glyph_names = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = "woff2"
    output = Path(temporary_dir) / name
    font.save(output, reorderTables=True)
    font.close()
    with TTFont(output, lazy=False) as check:
        actual = set(unicode_cmap(check))
        if actual != set(codepoints):
            raise RuntimeError(f"Unicode coverage changed in {name}.")
        if "fvar" not in check:
            raise RuntimeError(f"Variable weight axis missing in {name}.")
        glyph_count = len(check.getGlyphOrder())
    data = output.read_bytes()
    return {
        "file": f"site/assets/fonts/music/{name}",
        "bytes": len(data),
        "sha256": sha256(data),
        "codepointCount": len(codepoints),
        "glyphCount": glyph_count,
        "unicodeRange": ranges(codepoints),
        "kind": "ui" if "-base-" in name else "coverage",
    }


def verify_existing(source: Path | None = None) -> dict:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    combined: set[int] = set()
    total = 0
    for entry in manifest["chunks"]:
        file = ROOT / entry["file"]
        if not file.resolve().is_relative_to(FONT_DIR.resolve()):
            raise RuntimeError("Font manifest contains an unexpected output path.")
        data = file.read_bytes()
        if len(data) != entry["bytes"] or sha256(data) != entry["sha256"]:
            raise RuntimeError(f"Output checksum mismatch: {entry['file']}")
        with TTFont(file) as font:
            coverage = set(unicode_cmap(font))
            if coverage & combined or ranges(sorted(coverage)) != entry["unicodeRange"]:
                raise RuntimeError("Unicode ranges overlap or differ from the generated font.")
            if len(coverage) != entry["codepointCount"] or "fvar" not in font:
                raise RuntimeError("Incomplete subset metadata.")
            combined.update(coverage)
        total += len(data)
    if len(combined) != manifest["coverage"]["codepoints"] or total != manifest["totalFontBytes"]:
        raise RuntimeError("Combined coverage/size mismatch.")
    if sha256(CSS_PATH.read_bytes()) != manifest["css"]["sha256"]:
        raise RuntimeError("Font CSS checksum mismatch.")
    if sha256(LICENSE_PATH.read_bytes()) != manifest["license"]["sha256"]:
        raise RuntimeError("Existing OFL license changed.")
    if source is not None and source.is_file():
        data = source.read_bytes()
        if sha256(data) != manifest["source"]["sha256"]:
            raise RuntimeError("The configured source differs from this font build.")
        with TTFont(source) as original:
            if set(unicode_cmap(original)) != combined:
                raise RuntimeError("Output does not preserve every source codepoint.")
    for sample in manifest["samples"]:
        if sample["sourceSupported"] and not all(ord(character) in combined for character in sample["text"]):
            raise RuntimeError(f"Missing sample glyph: {sample['text']}")
    return {"ok": True, "chunks": len(manifest["chunks"]), "codepoints": len(combined), "totalFontBytes": total,
            "cssBytes": CSS_PATH.stat().st_size, "samples": manifest["samples"]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("C:/Windows/Fonts/NotoSansSC-VF.ttf"))
    parser.add_argument("--group-size", type=int, choices=(256, 512), default=512)
    parser.add_argument("--workers", type=int, choices=(1, 2, 3, 4), default=2)
    parser.add_argument("--check", action="store_true", help="Verify the existing slices without writing files.")
    arguments = parser.parse_args()
    if arguments.check:
        print(json.dumps(verify_existing(arguments.source), ensure_ascii=False))
        return
    source = arguments.source.resolve(strict=True)
    original_bytes = source.read_bytes()
    source_hash = sha256(original_bytes)
    with TTFont(source, lazy=False, recalcTimestamp=False) as original:
        coverage = set(unicode_cmap(original))
        axes = [{"tag": axis.axisTag, "min": axis.minValue, "default": axis.defaultValue, "max": axis.maxValue}
                for axis in original["fvar"].axes]
    if not coverage or not any(axis["tag"] == "wght" and axis["min"] <= 400 and axis["max"] >= 700 for axis in axes):
        raise RuntimeError("Expected a Unicode Noto Sans SC variable font covering weight 400–700.")
    if not LICENSE_PATH.is_file():
        raise RuntimeError("The existing Noto Sans SC OFL license is required.")
    groups = make_groups(coverage, arguments.group_size)
    with tempfile.TemporaryDirectory(prefix="tingchao-fonts-") as temporary:
        tasks = [(str(source), name, codepoints, temporary) for name, codepoints in groups]
        if arguments.workers == 1:
            chunks = [build_slice(task) for task in tasks]
        else:
            with ProcessPoolExecutor(max_workers=arguments.workers) as pool:
                chunks = list(pool.map(build_slice, tasks))
        if sha256(source.read_bytes()) != source_hash:
            raise RuntimeError("Source font changed while generating slices.")
        FONT_DIR.mkdir(parents=True, exist_ok=True)
        for entry in chunks:
            destination = ROOT / entry["file"]
            generated = Path(temporary) / destination.name
            destination.write_bytes(generated.read_bytes())
    css = ["/* Generated by tools/build-music-fonts.py. Noto Sans SC, SIL OFL 1.1.",
           "   License: ../fonts/OFL-NotoSansSC.txt. Source is read-only; font slices are self-hosted. */"]
    for entry in chunks:
        name = Path(entry["file"]).name
        css.append("@font-face{font-family:'Tingchao UI';font-style:normal;font-weight:400 700;font-display:swap;"
                   + f"src:url('../fonts/music/{name}') format('woff2');unicode-range:{entry['unicodeRange']};" + "}")
    css_bytes = ("\n".join(css) + "\n").encode("utf-8")
    CSS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CSS_PATH.write_bytes(css_bytes)
    manifest = {
        "format": 1,
        "fontFamily": FAMILY,
        "fontWeight": "400 700",
        "fontToolsVersion": fontTools.__version__,
        "source": {"file": source.name, "bytes": len(original_bytes), "sha256": source_hash, "axes": axes},
        "license": {"file": "site/assets/fonts/OFL-NotoSansSC.txt", "sha256": sha256(LICENSE_PATH.read_bytes()), "modified": False},
        "coverage": {"codepoints": len(coverage), "minimum": f"U+{min(coverage):04X}", "maximum": f"U+{max(coverage):04X}",
                     "groupSize": arguments.group_size, "uiFirst": True, "preservesAllSourceCodepoints": True},
        "totalFontBytes": sum(entry["bytes"] for entry in chunks),
        "largestChunkBytes": max(entry["bytes"] for entry in chunks),
        "css": {"file": "site/assets/css/music-fonts.css", "bytes": len(css_bytes), "sha256": sha256(css_bytes)},
        "samples": [{"text": sample, "codepoints": [f"U+{ord(character):04X}" for character in sample],
                     "sourceSupported": all(ord(character) in coverage for character in sample),
                     "subsetSupported": all(ord(character) in coverage for character in sample)} for sample in SAMPLES],
        "chunks": chunks,
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(verify_existing(source), ensure_ascii=False))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
