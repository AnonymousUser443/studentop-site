from pathlib import Path
import json
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[2]
texts = {
    "NotoSerifSC-UI.woff2": "探索度已点亮处地标游客本机存档活动一览收集图鉴定位到我北理校园探索寻踪阶",
    "MaShanZheng-UI.woff2": "理韵寻踪良乡校区游客",
}
results = []
for filename, text in texts.items():
    font = TTFont(root / "apps/liyun-explorer/public/assets/fonts" / filename)
    missing = sorted(set(text) - {chr(cp) for cp in font.getBestCmap()})
    results.append({"font": filename, "checked": text, "missing": missing})
report = {"ok": all(not row["missing"] for row in results), "fonts": results}
Path(__file__).with_name("font-coverage.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=True))
raise SystemExit(0 if report["ok"] else 1)
