# 砚知知识库（yz-kb）

## 这个技能做什么

把「砚知」可溯源企业知识库安装到本地并初始化：12 份示例资料 → 27 页知识页 → 本地检索 + DeepSeek 问答，最后给出访问地址。

## 使用步骤

1. 确认本机有 Node.js 24+ 与 pnpm；没有的话先提示用户安装。
2. 克隆仓库到用户指定目录（默认当前目录）：

   ```
   git clone https://github.com/panday8y8/yanzhi-kb.git
   cd yanzhi-kb
   ```

3. 安装并初始化：

   ```
   pnpm install
   pnpm kb:init
   ```

   如失败，先读报错：`ERR_PNPM_IGNORED_BUILDS` 需要 `pnpm-workspace.yaml` 里的 `allowBuilds: { esbuild: true }`。

4. 询问用户是否有 `DEEPSEEK_API_KEY`：
   - 有：用环境变量启动 `pnpm dev`，并说明凭证只在服务端读取；
   - 没有：直接启动，说明问答会降级为本地证据摘录。
5. 启动后验收：
   - 打开 `http://localhost:3000`；
   - 在「智能问答」里问「版本发布要过哪几道门禁？」；
   - 答案应包含 `[1]` 等编号，右侧应出现证据卡片。
6. 把访问地址、初始化输出（页数 / 引用数 / 评估分）一起反馈给用户。

## 约束

- 不要修改 `content/raw/` 下的原始资料；
- 不要打印 `DEEPSEEK_API_KEY`；
- 端口冲突时用 `pnpm dev -- -p 3300`；
- 演示版无多租户权限，不要建议用户直接公网部署。

