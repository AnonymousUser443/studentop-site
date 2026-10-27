#!/usr/bin/env bash
set -uo pipefail
B=http://127.0.0.1:4173

echo "############ NODE ############"
/opt/node24/bin/node -v
echo "node path: $(command -v node)"
node -v
npm -v
node -e "const {DatabaseSync}=require('node:sqlite');console.log('DatabaseSync typeof =', typeof DatabaseSync)"
node -e "console.log('version', process.version, 'arch', process.arch)"
ls -ld /opt/node24 /opt/node24/bin/node /opt/node24/lib/node_modules/npm
ls -l /usr/local/bin/node /usr/local/bin/nodejs /usr/local/bin/npm /usr/local/bin/npx
echo "nodejs.org dist file: $(ls /tmp/node24-install.* 2>/dev/null || echo 'temp cleaned')"

echo
echo "############ RELEASE LAYOUT ############"
readlink -f /opt/projects/frost/current
ls -ld /opt/projects/frost /opt/projects/frost/releases /opt/projects/frost/releases/v4.0.8 /opt/projects/frost/current
echo "release files: $(find /opt/projects/frost/releases/v4.0.8 -type f | wc -l)"
echo "release size: $(du -sh /opt/projects/frost/releases/v4.0.8 | cut -f1)"
echo "release version: $(grep -m1 '"version"' /opt/projects/frost/releases/v4.0.8/package.json)"

echo
echo "############ USER / DATA DIR ############"
getent passwd frost
sudo -n stat -c '%a %U:%G %n' /var/lib/frost-atlas /var/lib/frost-atlas/data
sudo -n ls -la /var/lib/frost-atlas/data
sudo -n test -e /var/lib/frost-atlas/data/admin-token.txt && echo "admin-token.txt: PRESENT (not printed)" || echo "admin-token.txt: absent (office entry has not run)"

echo
echo "############ SYSTEMD UNIT ############"
ls -l /etc/systemd/system/frost-atlas.service
systemctl is-enabled frost-atlas
echo "== restart to reset NRestarts and get clean start =="
sudo -n systemctl restart frost-atlas
sleep 4
systemctl is-active frost-atlas
systemctl show frost-atlas -p NRestarts -p MainPID -p ActiveEnterTimestamp --no-pager

echo
echo "############ VERIFICATION COMMANDS (as specified) ############"
echo '--- 1) /api/health ---'
code=$(curl -s -o /tmp/health.json -w '%{http_code}' -H 'Host: localhost' "$B/api/health")
echo "curl -s -o /dev/null -w '%{http_code}' -H 'Host: localhost' $B/api/health  -> $code"
echo "body: $(cat /tmp/health.json)"

echo '--- 2) / ---'
code=$(curl -s -o /tmp/root.html -w '%{http_code}' -H 'Host: localhost' "$B/")
echo "curl ... $B/  -> $code"
grep -o '<title>[^<]*</title>' /tmp/root.html | head -1
echo "bytes=$(stat -c %s /tmp/root.html) contains 一笺霜信=$(grep -c '一笺霜信' /tmp/root.html)"

echo '--- 3) /sw.js ---'
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: localhost' "$B/sw.js")
echo "curl ... $B/sw.js  -> $code"

echo '--- 4) /api/config ---'
code=$(curl -s -o /tmp/config.json -w '%{http_code}' -H 'Host: localhost' "$B/api/config")
echo "curl ... $B/api/config  -> $code"
echo "body: $(cat /tmp/config.json)"
python3 -c "import json;d=json.load(open('/tmp/config.json'));print('sealed=%s version=%s pins=%d' % (d['sealed'],d['version'],len(d['pins'])))"

echo '--- 5) ss -lntp | grep 4173 ---'
sudo -n ss -lntp | grep 4173
echo "listeners with 4173 (any address):"; sudo -n ss -lnt | grep -c 4173
echo "0.0.0.0/:: bindings on 4173: $(sudo -n ss -lnt | grep 4173 | grep -cE '0\.0\.0\.0:|\[::\]')"

echo '--- 6) journal / active ---'
systemctl is-active frost-atlas
echo "Started count total: $(sudo -n journalctl -u frost-atlas --no-pager | grep -c 'Started frost-atlas')"
echo "unexpected error lines: $(sudo -n journalctl -u frost-atlas --no-pager | grep -ciE 'error|fatal|uncaught|traceback' || true)"
echo "== journalctl -u frost-atlas -n 60 --no-pager (tail 30) =="
sudo -n journalctl -u frost-atlas -n 60 --no-pager | tail -30

echo
echo "############ FINAL HEALTH + STABILITY WAIT ############"
sleep 5
systemctl is-active frost-atlas
systemctl show frost-atlas -p NRestarts --no-pager
curl -s -o /dev/null -w 'health=%{http_code}\n' -H 'Host: localhost' "$B/api/health"
echo "uptime: $(ps -o etime= -p "$(systemctl show frost-atlas -p MainPID --value)")"
echo "disk: $(df -h / | tail -1)"
