#!/usr/bin/env bash
# ============================================================================
# install-git-hooks.sh - 给本仓库装 pre-push 钩子：
#   git push 之前，先通过 SSH 把 site/ 发布到树莓派的 nginx 根目录；
#   发布失败（ssh / 自检不过）就中止 push，避免「代码进仓库、站点没更新」。
#
# 用法：
#   bash deploy/install-git-hooks.sh [ssh别名]
#     ssh别名 默认 pi；本机要是 biteraiden-pi 就传 biteraiden-pi
#   SKIP_DEPLOY=1 git push     # 只推代码，不发布
# ============================================================================
set -euo pipefail

PI_ALIAS="${1:-pi}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/.git/hooks/pre-push"
TEMPLATE="$ROOT/deploy/pre-push.hook"

if [ ! -d "$ROOT/.git" ]; then
  echo "这里不是 git 仓库：$ROOT" >&2
  exit 1
fi
if [ ! -f "$TEMPLATE" ]; then
  echo "找不到模板：$TEMPLATE" >&2
  exit 1
fi

sed "s|__PI_ALIAS__|${PI_ALIAS}|g" "$TEMPLATE" > "$HOOK"
chmod +x "$HOOK"

echo "已安装 pre-push 钩子：$HOOK"
echo "本机 ssh 别名：$PI_ALIAS（可用 bash deploy/install-git-hooks.sh <别名> 重装）"
echo "跳过发布：SKIP_DEPLOY=1 git push"
