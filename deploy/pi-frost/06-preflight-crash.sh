#!/usr/bin/env bash
set -uo pipefail
echo "===== P) package self-preflight (91 assets + runtime ledger sha256) ====="
cd /opt/projects/frost/current
sudo -n -u frost /opt/node24/bin/node scripts/deployment-preflight.mjs --mode quick 2>&1 || echo "preflight exit=$?"

echo
echo "===== Q) crash recovery: SIGKILL main PID, expect Restart=always within ~3s ====="
PID=$(systemctl show frost-atlas -p MainPID --value)
echo "killing MainPID=$PID"
sudo -n kill -9 "$PID"
for i in 1 2 3 4 5 6 7 8; do
  sleep 1
  CUR=$(systemctl show frost-atlas -p MainPID --value)
  ACT=$(systemctl is-active frost-atlas)
  echo "  t+${i}s active=$ACT pid=$CUR"
  if [ "$ACT" = active ] && [ "$CUR" != "$PID" ] && [ "$CUR" != 0 ]; then break; fi
done
echo "NRestarts after kill: $(systemctl show frost-atlas -p NRestarts --value)"
curl -s -o /dev/null -w 'health after crash recovery=%{http_code}\n' -H 'Host: localhost' http://127.0.0.1:4173/api/health
sudo -n journalctl -u frost-atlas -n 8 --no-pager | tail -6
