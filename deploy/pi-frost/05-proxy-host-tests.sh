#!/usr/bin/env bash
set -uo pipefail
B=http://127.0.0.1:4173
line(){ echo "--- $* ---"; }

line "C) Host without port (nginx default proxy_set_header Host \$host would send this)"
curl -s -o /tmp/c.json -w 'code=%{http_code}\n' -H 'Host: frost.studentop.cn' "$B/api/health"; head -c 300 /tmp/c.json; echo

line "D) wrong scheme origin still ok for GET (origin check only on writes)"

line "E) /admin/ and /api/admin on public listener (must be 404)"
curl -s -o /dev/null -w '/admin/ code=%{http_code}\n' -H 'Host: localhost' "$B/admin/"
curl -s -o /dev/null -w '/api/admin/status code=%{http_code}\n' -H 'Host: localhost' "$B/api/admin/status"

line "F) /resource-manifest.json"
curl -s -o /tmp/rm.json -w 'code=%{http_code} type=%{content_type} bytes=%{size_download}\n' -H 'Host: localhost' "$B/resource-manifest.json"
python3 -c "import json;d=json.load(open('/tmp/rm.json'));print('manifest version=',d.get('version'),'assets=',len(d.get('assets',[])))"

line "G) static asset from manifest + production allowlist enforcement"
ASSET=$(python3 -c "import json;print(json.load(open('/tmp/rm.json'))['assets'][0]['url'])")
echo "asset: $ASSET"
curl -s -o /dev/null -w "asset code=%{http_code}\n" -H 'Host: localhost' "$B$ASSET"
curl -s -o /dev/null -w 'non-allowlisted /servers/app.mjs code=%{http_code}\n' -H 'Host: localhost' "$B/servers/app.mjs"
curl -s -o /dev/null -w 'non-allowlisted /package.json code=%{http_code}\n' -H 'Host: localhost' "$B/package.json"

line "H) security headers on / (CSP, nosniff, frame options)"
curl -s -D - -o /dev/null -H 'Host: localhost' "$B/" | grep -iE '^(content-security-policy|x-content-type-options|x-frame-options|referrer-policy|permissions-policy|cross-origin-resource-policy):' | tr -d '\r'

line "I) restart robustness (restart twice, verify recovered)"
sudo -n systemctl restart frost-atlas
sleep 2
curl -s -o /dev/null -w 'after restart #1 health=%{http_code}\n' -H 'Host: localhost' "$B/api/health"
sudo -n systemctl restart frost-atlas
sleep 2
curl -s -o /dev/null -w 'after restart #2 health=%{http_code}\n' -H 'Host: localhost' "$B/api/health"
systemctl is-active frost-atlas
systemctl show frost-atlas -p NRestarts --no-pager

line "J) uptime + main pid + memory"
systemctl show frost-atlas -p MainPID -p ActiveState --no-pager
sudo -n ps -o pid,etime,rss,cmd -p "$(systemctl show frost-atlas -p MainPID --value)" 2>/dev/null

line "K) data dir after restarts"
sudo -n ls -la /var/lib/frost-atlas/data

line "L) journal after restart tests (errors scan)"
sudo -n journalctl -u frost-atlas --since '10 min ago' --no-pager | grep -icE 'error|fatal|uncaught|traceback' || echo "0 error lines"
sudo -n journalctl -u frost-atlas -n 12 --no-pager
