#!/usr/bin/env bash
# ==============================================================================
# checksum-compare.sh - per-file sha256 comparison: local build vs the release
# that is live on the Raspberry Pi.
#
# Usage (Windows Git Bash, repo root):
#   bash deploy/checksum-compare.sh [SOURCE_DIR] [REMOTE_DIR]
#
#   SOURCE_DIR  default win11-homepage (auto-descends into ./dist when present)
#   REMOTE_DIR  default /opt/win11-home/current
#
# Compares exactly: ./index.html and every file under ./assets/.
# Prints a per-file PASS/FAIL table and exits 1 when anything differs
# (missing on one side, or a different sha256). Read-only on both sides.
# ==============================================================================
set -euo pipefail

PI_HOST="${PI_HOST:-pi}"
SRC="${1:-win11-homepage}"
REMOTE_DIR="${2:-/opt/win11-home/current}"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
say() { printf '== %s\n' "$*"; }

[ -d "$SRC" ] || die "source directory not found: $SRC"
if [ -f "$SRC/dist/index.html" ]; then SRC="$SRC/dist"; fi
[ -f "$SRC/index.html" ] || die "no index.html in $SRC"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
LOCAL_LIST="$TMP_DIR/local.txt"
REMOTE_LIST="$TMP_DIR/remote.txt"

# hashes are printed as:  <sha256>  <relative path>   (sorted by path)
hash_dir() {
  local dir="$1"
  ( cd "$dir" && find . -type f \( -path './index.html' -o -path './assets/*' \) -print \
      | LC_ALL=C sort | while IFS= read -r f; do
          printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "${f#./}"
        done )
}

say "local : $SRC"
say "remote: $PI_HOST:$REMOTE_DIR"
hash_dir "$SRC" > "$LOCAL_LIST"
ssh -o ConnectTimeout=10 "$PI_HOST" "REMOTE_DIR='$REMOTE_DIR' bash -s" > "$REMOTE_LIST" <<'REMOTE_HASH' || die "remote hash listing failed (does $REMOTE_DIR exist?)"
cd "$REMOTE_DIR" || exit 2
find . -type f \( -path './index.html' -o -path './assets/*' \) -print | LC_ALL=C sort | while IFS= read -r f; do
  printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "${f#./}"
done
REMOTE_HASH

LOCAL_N=$(wc -l < "$LOCAL_LIST" | tr -d ' ')
REMOTE_N=$(wc -l < "$REMOTE_LIST" | tr -d ' ')
say "files: local=$LOCAL_N remote=$REMOTE_N"

RESULT="$TMP_DIR/result.txt"
awk '
  NR == FNR { loc[$2] = $1; next }
            { rem[$2] = $1 }
  END {
    for (p in loc) {
      if (!(p in rem))      { printf "MISSING-REMOTE  %s\n", p; bad = 1 }
      else if (loc[p] != rem[p]) { printf "HASH-MISMATCH   %s\n", p; bad = 1 }
    }
    for (p in rem) {
      if (!(p in loc))      { printf "MISSING-LOCAL   %s\n", p; bad = 1 }
    }
    exit bad
  }
' "$LOCAL_LIST" "$REMOTE_LIST" > "$RESULT" || true

if [ -s "$RESULT" ]; then
  say "MISMATCHES:"
  sed 's/^/  /' "$RESULT"
  printf '\nRESULT: FAIL (%s mismatched entries)\n' "$(wc -l < "$RESULT" | tr -d ' ')"
  exit 1
fi

say "all compared files are identical:"
sed 's/^/  /' "$LOCAL_LIST"
printf '\nRESULT: PASS (%d files identical)\n' "$LOCAL_N"
