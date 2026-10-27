#!/usr/bin/env bash
# =============================================================================
# install-git-hooks.sh - 给本仓库装一个 pre-push 钩子：
#   git push 之前，先通过 SSH 把 site/ 发布到树莓派的 nginx 根目录。
#   发布失败（ssh/自检不过）就中止 push，避免「代码进仓库但站点没更新」。
#
# 用法：bash deploy/install-git-hooks.sh
# 跳过本次发布：SKIP_DEPLOY=1 git push
# 需要：本机 ssh 能直连树莓派（PI_HOST，默认 pi；本机可 PI_HOST=biteraiden-pi）
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$ROOT/.git/hooks/pre-push"

if [ ! -d "$ROOT/.git" ]; then
  echo "这里不是 git 仓库：$ROOT" >&2
  exit 1
fi

cat > "$HOOK" <<'HOOK_EOF'
#!/usr/bin/env bash
# 自动生成：deploy/install-git-hooks.sh —— push 前先 SSH 发布主页
set -euo pipefail

# 只关心 main 分支的推送
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "[pre-push] 当前分支 $BRANCH，不是 main，跳过发布"
  exit 0
fi

if [ -n "${SKIP_DEPLOY:-}" ]; then
  echo "[pre-push] SKIP_DEPLOY=1，跳过发布，直接推送"
  exit 0
fi

echo "[pre-push] 先把 site/ 发布到树莓派…"
PI_HOST="${PI_HOST:-pi}" bash deploy/deploy-site.sh site
echo "[pre-push] 发布 OK，继续 git push"
HOOK_EOF

chmod +x "$HOOK"
echo "已安装 pre-push 钩子：$HOOK"
echo "跳过发布：SKIP_DEPLOY=1 git push"
