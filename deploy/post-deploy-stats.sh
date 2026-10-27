#!/usr/bin/env bash
# ==============================================================================
# post-deploy-stats.sh - print a snapshot of the LIVE deployment on the Pi
# (file counts, sizes, nginx state, frpc log tail).
# Appended to deploy/PI-STATE.md after each release.
# Usage:  bash deploy/post-deploy-stats.sh
# ==============================================================================
set -euo pipefail
PI_HOST="${PI_HOST:-pi}"

ssh -o ConnectTimeout=10 -o BatchMode=yes "$PI_HOST" 'bash -s' <<'REMOTE'
set -uo pipefail
ROOT=/opt/win11-home
CUR="$(readlink -f "$ROOT/current" 2>/dev/null || true)"

echo "### 发布快照（$(date -u '+%Y-%m-%dT%H:%M:%SZ') UTC / $(date '+%Y-%m-%d %H:%M:%S %Z')）"
echo
echo "- current 软链指向：$CUR"
echo "- releases 目录数：$(ls -1 "$ROOT/releases" 2>/dev/null | wc -l | tr -d ' ')"
echo
echo "| 指标 | 值 |"
echo "|---|---|"
echo "| 文件数 (find -type f) | $(find "$CUR" -type f 2>/dev/null | wc -l | tr -d ' ') |"
echo "| 目录数 (find -type d) | $(find "$CUR" -type d 2>/dev/null | wc -l | tr -d ' ') |"
echo "| 总字节 (du -sb) | $(du -sb "$CUR" 2>/dev/null | cut -f1) |"
echo "| index.html 字节 | $(stat -c %s "$CUR/index.html" 2>/dev/null || echo n/a) |"
echo
echo "**顶层内容：**"
echo
echo '~~~~'
ls -la "$CUR" 2>/dev/null || true
echo '~~~~'
echo
echo "**ls -R（前 40 行）：**"
echo
echo '~~~~'
ls -R "$CUR" 2>/dev/null | head -40 || true
echo '~~~~'
echo
echo "**nginx 状态：**"
echo
echo '~~~~'
echo "is-active : $(systemctl is-active nginx)"
echo "is-enabled: $(systemctl is-enabled nginx)"
sudo -n ss -ltnp 2>/dev/null | grep nginx || true
echo '~~~~'
echo
echo "**frpc.service：** is-active=$(systemctl is-active frpc 2>/dev/null || true) / is-enabled=$(systemctl is-enabled frpc 2>/dev/null || true)"
echo
echo "**/var/log/frpc.log 最近 5 行：**"
echo
echo '~~~~'
sudo -n tail -5 /var/log/frpc.log 2>/dev/null || echo '(no log yet)'
echo '~~~~'
REMOTE
