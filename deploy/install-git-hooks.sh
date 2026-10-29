#!/usr/bin/env bash
# ============================================================================
# install-git-hooks.sh - 给本仓库装 pre-push 钩子：
#   git push 之前只在本地构建和校验 dist-site 的内容版本化资源；
#   不连接服务器、不自动发布。正式部署只能由所有者另行明确发起。
#
# 用法：
#   bash deploy/install-git-hooks.sh [ssh别名]
#     ssh别名 默认 pi；本机要是 biteraiden-pi 就传 biteraiden-pi
#   历史自动部署钩子须由所有者主动重装；编辑模板不会改动既有 .git/hooks。
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
echo "此钩子只做本地构建/校验，不再自动发布；旧 ssh 别名参数仅为兼容保留。"
