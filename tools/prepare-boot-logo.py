"""Losslessly package the user-supplied logo; never redraw or alter its silhouette."""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image, ImageOps


def main():
    parser = argparse.ArgumentParser(description="Package the supplied transparent logo without redrawing")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "site/assets/img/boot-logo.webp")
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    output = args.output.resolve()
    if source == output:
        raise SystemExit("Source and output must be different files")
    with Image.open(source) as original:
        source_format = original.format
        image = ImageOps.exif_transpose(original).convert("RGBA")
        pixels = image.tobytes()
        size = image.size
        alpha = image.getchannel("A").getextrema()
        output.parent.mkdir(parents=True, exist_ok=True)
        image.save(output, "WEBP", lossless=True, exact=True, method=6)
    with Image.open(output) as checked:
        checked = checked.convert("RGBA")
        if checked.size != size or checked.tobytes() != pixels:
            raise RuntimeError("Lossless pixel verification failed")
    print(json.dumps({"output": output.name, "sourceFormat": source_format, "width": size[0], "height": size[1], "alphaRange": alpha, "pixelPreserved": True, "bytes": output.stat().st_size, "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}, ensure_ascii=True))


if __name__ == "__main__":
    main()
