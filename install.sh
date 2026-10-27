#!/usr/bin/env bash
# 安装「砚知」知识库：检查环境 → 安装依赖 → 初始化数据
set -euo pipefail

echo "==> 检查 Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "没有找到 Node.js，请先安装 Node 24+：https://nodejs.org" >&2
  exit 1
fi
RAW="$(node --version)"
MAJOR="$(echo "$RAW" | sed 's/^v//' | cut -d. -f1)"
if [ "$MAJOR" -lt 24 ]; then
  echo "当前 Node.js 是 $RAW，需要 24 或更高。" >&2
  exit 1
fi
echo "    Node.js $RAW"

echo "==> 检查 pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  echo "    没有 pnpm，用 corepack 在项目内启用"
  mkdir -p .corepack
  corepack enable --install-directory .corepack
  export PATH="$(pwd)/.corepack:$PATH"
fi
echo "    pnpm $(pnpm --version)"

echo "==> 安装依赖（首次约 10 秒）"
pnpm install

echo "==> 编译知识页 / 图谱 / 评估"
pnpm kb:init

echo ""
echo "完成。下一步："
echo '  export DEEPSEEK_API_KEY="sk-你的key"   # 可选，不配也能跑'
echo "  pnpm dev"
echo "  打开 http://localhost:3000"
