# 安装「砚知」知识库：检查环境 → 安装依赖 → 初始化数据
$ErrorActionPreference = 'Stop'

Write-Host '==> 检查 Node.js' -ForegroundColor Cyan
try {
  $raw = (node --version).Trim()
} catch {
  throw '没有找到 Node.js，请先安装 Node 24+：https://nodejs.org'
}
$version = [version]$raw.TrimStart('v')
if ($version -lt [version]'24.0.0') {
  throw "当前 Node.js 是 $raw，需要 24 或更高。"
}
Write-Host "    Node.js $raw"

Write-Host '==> 检查 pnpm' -ForegroundColor Cyan
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host '    没有 pnpm，用 corepack 在项目内启用（不需要管理员权限）'
  New-Item -ItemType Directory -Force '.corepack' | Out-Null
  corepack enable --install-directory .corepack
  if ($LASTEXITCODE -ne 0) {
    throw 'corepack 启用失败。请手动安装 pnpm 12+：https://pnpm.io/installation'
  }
  $env:PATH = "$(Get-Location)\.corepack;$env:PATH"
}
$pnpmVersion = (pnpm --version).Trim()
Write-Host "    pnpm $pnpmVersion"

Write-Host '==> 安装依赖（首次约 10 秒）' -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) { throw 'pnpm install 失败，请把上面的报错发给我。' }

Write-Host '==> 编译知识页 / 图谱 / 评估' -ForegroundColor Cyan
pnpm kb:init
if ($LASTEXITCODE -ne 0) { throw 'kb:init 失败，请把上面的报错发给我。' }

Write-Host ''
Write-Host '完成。下一步：' -ForegroundColor Green
Write-Host '  $env:DEEPSEEK_API_KEY = "sk-你的key"   # 可选，不配也能跑'
Write-Host '  pnpm dev'
Write-Host '  打开 http://localhost:3000'
