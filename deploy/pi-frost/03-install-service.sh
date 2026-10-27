#!/usr/bin/env bash
set -euo pipefail
echo "== install unit =="
sudo -n install -o root -g root -m 0644 /tmp/frost-atlas.service /etc/systemd/system/frost-atlas.service
sudo -n systemctl daemon-reload
echo "== unit verify =="
systemctl cat frost-atlas --no-pager | head -5
systemd-analyze verify /etc/systemd/system/frost-atlas.service 2>&1 || echo "(verify warnings above, if any)"

echo "== enable --now =="
sudo -n systemctl enable --now frost-atlas 2>&1
sleep 3
echo "== status =="
systemctl is-active frost-atlas || true
systemctl is-enabled frost-atlas || true
echo "== listen =="
ss -lntp 2>/dev/null | grep -E '4173|Local' || true
echo "== journal -n 60 =="
sudo -n journalctl -u frost-atlas -n 60 --no-pager 2>&1
