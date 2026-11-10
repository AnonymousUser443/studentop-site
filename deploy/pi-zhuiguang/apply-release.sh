#!/usr/bin/env bash
# Invoked with sudo by the owner's deploy command.
set -euo pipefail
archive=$1
release=$2
[[ "$release" =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$ && "$archive" == "/tmp/zhuiguang-$release.tar" ]]
root=/opt/projects/zhuiguang
dir="$root/releases/$release"
credentials=/tmp/zhuiguang-$release-credentials
state=/var/lib/zhuiguang
route=/etc/nginx/snippets/win11-home-projects.conf
export PATH="/opt/node24/bin:$PATH"
exec 9>/run/lock/aiden-desktop-release.lock
flock -n 9
previous="$(readlink -f "$root/current" || true)"
[[ -L "$root/current" ]] || previous=
test ! -e "$dir"
install -d -m 755 "$dir"
tar -xf "$archive" -C "$dir" --no-same-owner
test -f "$dir/dist/sw.js"
test -f "$dir/server/show-database.mjs"
test -f "$dir/infra/zhuiguang.service"
chmod -R go-w "$dir"
chown -R root:root "$dir"
cd "$dir"
npm ci --omit=dev --ignore-scripts --no-audit --no-fund --fetch-retries=2 --fetch-timeout=20000
node --check server/index.mjs
node --check dist/sw.js
node --input-type=module <<'VERIFY'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const files = JSON.parse(readFileSync('dist/assets/manifest.json', 'utf8'));
for (const entry of files) {
  const data = readFileSync('dist' + entry.path);
  if (data.length !== entry.bytes || createHash('sha256').update(data).digest('hex') !== entry.sha256) throw new Error('Asset mismatch ' + entry.path);
}
console.log('Verified ' + files.length + ' files on Raspberry Pi');
VERIFY

getent passwd zhuiguang >/dev/null || useradd --system --user-group --home-dir "$state" --no-create-home --shell /usr/sbin/nologin zhuiguang
install -d -o zhuiguang -g zhuiguang -m 0700 "$state" "$state/data" "$state/backups"
install -d -m 0700 /etc/zhuiguang
if [[ ! -s /etc/zhuiguang/stage.env ]]; then
  (umask 077; printf 'PRESENTATION_PIN=%s\n' "$(openssl rand -hex 6)" >/etc/zhuiguang/stage.env)
fi
work="$(mktemp -d /tmp/zhuiguang-rollback.XXXXXXXX)"
cp "$route" "$work/route"
test_was_active=false
test_was_enabled=false
if systemctl is-active --quiet zhuiguang-test.service; then test_was_active=true; fi
if systemctl is-enabled --quiet zhuiguang-test.service; then test_was_enabled=true; fi
for env in stage.env; do
  if [[ -f "/etc/zhuiguang/$env" ]]; then cp "/etc/zhuiguang/$env" "$work/$env"; fi
done
for unit in zhuiguang.service zhuiguang-test.service zhuiguang-backup.service zhuiguang-backup.timer; do
  if [[ -f "/etc/systemd/system/$unit" ]]; then cp "/etc/systemd/system/$unit" "$work/$unit"; fi
done
restore() {
  rc=$?
  trap - EXIT
  if [[ "$rc" -ne 0 ]]; then
    set +e
    echo 'Release check failed; restoring previous service and route' >&2
    install -m 644 "$work/route" "$route"
    for env in stage.env; do
      if [[ -f "$work/$env" ]]; then install -m 600 "$work/$env" "/etc/zhuiguang/$env"
      else rm -f "/etc/zhuiguang/$env"; fi
    done
    for unit in zhuiguang.service zhuiguang-test.service zhuiguang-backup.service zhuiguang-backup.timer; do
      if [[ -f "$work/$unit" ]]; then install -m 644 "$work/$unit" "/etc/systemd/system/$unit"
      else systemctl disable --now "$unit" >/dev/null 2>&1; rm -f "/etc/systemd/system/$unit"; fi
    done
    systemctl daemon-reload
    if [[ -n "$previous" ]]; then
      ln -sfn "$previous" "$root/.current.new"; mv -Tf "$root/.current.new" "$root/current"
      systemctl restart zhuiguang.service
      if "$test_was_enabled"; then systemctl enable zhuiguang-test.service; fi
      if "$test_was_active"; then systemctl restart zhuiguang-test.service; fi
    else
      systemctl stop zhuiguang.service
      rm -f "$root/current"
    fi
    nginx -t && systemctl reload nginx
  fi
  rm -f "$credentials/stage.env"
  if [[ -d "$credentials" ]]; then rmdir "$credentials" || true; fi
  rm -rf "$work"
  exit "$rc"
}
trap restore EXIT

if [[ -n "$previous" ]]; then systemctl start zhuiguang-backup.service; fi
for env in stage.env; do
  if [[ -f "$credentials/$env" ]]; then
    grep -qEx 'PRESENTATION_PIN=[A-Za-z0-9-]{10,128}' "$credentials/$env"
    install -m 600 "$credentials/$env" "/etc/zhuiguang/$env"
  fi
done
for unit in zhuiguang.service zhuiguang-backup.service zhuiguang-backup.timer; do
  install -m 644 "$dir/infra/$unit" "/etc/systemd/system/$unit"
done
awk '/^# BEGIN ZHUIGUANG$/{skip=1} !skip{print} /^# END ZHUIGUANG$/{skip=0}' "$work/route" >"$work/next"
grep -q '^# BEGIN ZHUIGUANG$' "$dir/infra/route.conf"
grep -q '^# END ZHUIGUANG$' "$dir/infra/route.conf"
sed -n '/^# BEGIN ZHUIGUANG$/,/^# END ZHUIGUANG$/p' "$dir/infra/route.conf" >>"$work/next"
install -m 644 "$work/next" "$route"
nginx -t
ln -sfn "$dir" "$root/.current.new"; mv -Tf "$root/.current.new" "$root/current"
systemctl daemon-reload
systemctl restart zhuiguang.service
for _ in {1..25}; do
  if curl -fsS --max-time 2 http://127.0.0.1:4188/zhuiguang/api/health >"$work/health" && node -e 'let h=require("fs").readFileSync(process.argv[1]); h=JSON.parse(h); if(!h.ok||h.mode!=="rooms"||h.pages!==169||!h.persistence.database) process.exit(1)' "$work/health"; then break; fi
  sleep 1
done
node -e 'let h=JSON.parse(require("fs").readFileSync(process.argv[1])); if(!h.ok||h.mode!=="rooms"||h.pages!==169||!h.persistence.database) process.exit(1)' "$work/health"
systemctl reload nginx
for _ in {1..8}; do
  if curl -fsS --noproxy '*' --max-time 8 --resolve studentop.cn:443:127.0.0.1 -H 'Host: studentop.cn:14355' https://studentop.cn/zhuiguang/api/health >"$work/proxied" &&
    node -e 'const h=JSON.parse(require("fs").readFileSync(process.argv[1])); if(!h.ok||h.mode!=="rooms"||h.pages!==169||!h.persistence.database) process.exit(1)' "$work/proxied" 2>/dev/null; then break; fi
  sleep 1
done
node -e 'const h=JSON.parse(require("fs").readFileSync(process.argv[1])); if(!h.ok||h.mode!=="rooms"||h.pages!==169||!h.persistence.database) process.exit(1); console.log("TLS reverse proxy verified, " + h.pages + " pages")' "$work/proxied"
curl -fsS --noproxy '*' --max-time 10 --resolve studentop.cn:443:127.0.0.1 https://studentop.cn/version.json | node -e 'if(!JSON.parse(require("fs").readFileSync(0)).id) process.exit(1)'
test "$(curl -sS --noproxy '*' --max-time 10 --resolve studentop.cn:443:127.0.0.1 -o /dev/null -w '%{http_code}' https://studentop.cn/zhuiguang/test/)" = 302
systemctl start zhuiguang-backup.service
systemctl enable zhuiguang.service
systemctl enable --now zhuiguang-backup.timer
if "$test_was_active" || "$test_was_enabled"; then systemctl disable --now zhuiguang-test.service; fi
rm -f "$archive" "/tmp/zhuiguang-$release.sh"
echo
printf 'Release active: %s\nPrevious: %s\n' "$dir" "${previous:-none}"
