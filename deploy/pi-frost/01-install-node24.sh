#!/usr/bin/env bash
# Install Node 24 LTS (linux-arm64) to /opt/node24 and wire /usr/local/bin symlinks.
set -euo pipefail

BASE="https://nodejs.org/dist/latest-v24.x"
WORK="$(mktemp -d /tmp/node24-install.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

echo "== fetch SHASUMS256.txt =="
curl -fsSL --retry 3 --connect-timeout 20 "$BASE/SHASUMS256.txt" -o "$WORK/SHASUMS256.txt"
head -5 "$WORK/SHASUMS256.txt"

TARBALL="$(awk '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-linux-arm64\.tar\.xz$/ {print $2}' "$WORK/SHASUMS256.txt" | head -1)"
EXPECTED="$(awk -v f="$TARBALL" '$2 == f {print $1}' "$WORK/SHASUMS256.txt" | head -1)"
if [ -z "$TARBALL" ] || [ -z "$EXPECTED" ]; then echo "FAIL: could not resolve latest-v24.x linux-arm64 tarball"; exit 1; fi

VERSION="$(echo "$TARBALL" | sed -E 's/^node-(v[0-9.]+)-linux-arm64\.tar\.xz$/\1/')"
echo "== resolved $TARBALL ($VERSION) =="
echo "expected sha256: $EXPECTED"

echo "== download (with npmmirror fallback) =="
URL="$BASE/$TARBALL"
if ! curl -fSL --retry 3 --connect-timeout 20 --max-time 600 "$URL" -o "$WORK/$TARBALL"; then
  echo "nodejs.org download failed, trying npmmirror mirror"
  curl -fSL --retry 3 --connect-timeout 20 --max-time 600 "https://npmmirror.com/mirrors/node/$VERSION/$TARBALL" -o "$WORK/$TARBALL"
fi

ACTUAL="$(sha256sum "$WORK/$TARBALL" | awk '{print $1}')"
echo "actual   sha256: $ACTUAL"
if [ "$ACTUAL" != "$EXPECTED" ]; then echo "FAIL: sha256 mismatch"; exit 1; fi
ls -l "$WORK/$TARBALL"
echo "== sha256 OK =="

echo "== extract to /opt/node24 =="
sudo -n install -d -o root -g root -m 0755 /opt/node24
sudo -n tar -xJf "$WORK/$TARBALL" -C /opt/node24 --strip-components=1 --no-same-owner
sudo -n chown -R root:root /opt/node24
sudo -n find /opt/node24 -type d -exec chmod 0755 {} +
echo "== symlinks =="
for b in node npm npx corepack; do
  if [ -e "/opt/node24/bin/$b" ]; then
    sudo -n ln -sfn "/opt/node24/bin/$b" "/usr/local/bin/$b"
  fi
done
sudo -n ln -sfn /opt/node24/bin/node /usr/local/bin/nodejs
ls -l /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/nodejs 2>&1 || true

echo "== verify =="
hash -r
/usr/local/bin/node -v
echo "node: $(node -v)"
echo "npm:  $(npm -v)"
node -e "const {DatabaseSync}=require('node:sqlite');console.log('DatabaseSync typeof:', typeof DatabaseSync); if (typeof DatabaseSync !== 'function') process.exit(1);"
echo "== node:sqlite OK =="
node -e "console.log('arch:', process.arch, 'platform:', process.platform)"
