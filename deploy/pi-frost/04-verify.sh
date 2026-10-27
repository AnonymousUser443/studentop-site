#!/usr/bin/env bash
set -uo pipefail
BASE=http://127.0.0.1:4173
H=(-H 'Host: localhost')

echo "===== 1) /api/health ====="
code=$(curl -s -o /tmp/health.json -w '%{http_code}' "${H[@]}" "$BASE/api/health")
echo "http_code=$code"
echo "body: $(cat /tmp/health.json)"

echo "===== 2) / ====="
code=$(curl -s -o /tmp/root.html -w '%{http_code}' "${H[@]}" "$BASE/")
echo "http_code=$code bytes=$(stat -c %s /tmp/root.html)"
echo "title: $(grep -o '<title>[^<]*</title>' /tmp/root.html | head -1)"
echo "contains 一笺霜信: $(grep -c '一笺霜信' /tmp/root.html)"
echo "contains 霜降: $(grep -c '霜降' /tmp/root.html)"

echo "===== 3) /sw.js ====="
code=$(curl -s -o /tmp/sw.js -w '%{http_code}' "${H[@]}" "$BASE/sw.js")
echo "http_code=$code bytes=$(stat -c %s /tmp/sw.js)"
echo "content-type: $(curl -s -o /dev/null -D - "${H[@]}" "$BASE/sw.js" | grep -i '^content-type' | tr -d '\r')"
head -3 /tmp/sw.js

echo "===== 4) /api/config ====="
code=$(curl -s -o /tmp/config.json -w '%{http_code}' "${H[@]}" "$BASE/api/config")
echo "http_code=$code"
cat /tmp/config.json; echo
echo "sealed field: $(python3 -c "import json;d=json.load(open('/tmp/config.json'));print('sealed=',d.get('sealed'),'version=',d.get('version'),'pins=',len(d.get('pins',[])))")"

echo "===== 5) ss -lntp | grep 4173 ====="
sudo -n ss -lntp | grep 4173 || echo "NO LISTENER FOUND"

echo "===== 5b) all listeners (ensure no 0.0.0.0:4173) ====="
sudo -n ss -lnt | awk 'NR==1 || /4173/'

echo "===== 6) service state ====="
systemctl is-active frost-atlas
systemctl is-enabled frost-atlas
systemctl show frost-atlas -p NRestarts -p ActiveEnterTimestamp -p MainPID -p User -p WorkingDirectory -p ExecStart --no-pager | sed 's/^/  /'

echo "===== 6b) journal since start (last 60) ====="
sudo -n journalctl -u frost-atlas -n 60 --no-pager | tail -30

echo "===== 6c) crash/restart scan ====="
echo "Started lines: $(sudo -n journalctl -u frost-atlas --no-pager | grep -c 'Started frost-atlas')"
echo "error/fail lines: $(sudo -n journalctl -u frost-atlas --no-pager | grep -ciE 'error|fatal|uncaught|traceback|failed' || true)"
sudo -n journalctl -u frost-atlas --no-pager | grep -iE 'error|fatal|uncaught|traceback|warn' || echo "(none)"

echo "===== 7) private data dir ====="
sudo -n ls -la /var/lib/frost-atlas/data
sudo -n stat -c '%a %U:%G %n' /var/lib/frost-atlas/data /var/lib/frost-atlas/data/* 2>/dev/null
echo "===== 7b) no data dir inside release ====="
find /opt/projects/frost/releases/v4.0.8 -maxdepth 1 -name 'server-data' -o -maxdepth 1 -name '*.sqlite*' | wc -l
