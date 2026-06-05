# 下一步操作手册

本文档给你后续推进 Maintainer Firewall 的操作顺序。当前仓库已经具备公开 beta 的工程基础，下一阶段重点不是继续堆功能，而是用真实仓库验证市场价值。

## 当前状态

- 最新可安装版本：`wangjiehu/maintainer-firewall@v0.7.1`
- 推荐首次安装模式：audit mode，只读权限，先不发评论、不打标签。
- 本地主验收命令：`npm run market:check`
- 当前 release asset：
  - `maintainer-firewall-0.7.1.tgz`
  - `maintainer-firewall-0.7.1.tgz.sigstore.json`
- 当前发布资产可用 GitHub artifact attestation 验证。

## 每次改动后的固定检查

普通文档、示例或配置改动：

```bash
npm run ci
node scripts/market-check.mjs
```

规则、报告文案、评分、标签、输出或摘要改动：

```bash
npm run ci
npm run demo
```

运行时代码、依赖、bundle 或发布面改动：

```bash
npm run market:check
```

改动 `src/` 运行时代码后，必须确认 `dist/` 没有漂移：

```bash
npm run verify:dist
```

## 真实仓库试点

优先找 3 到 5 个真实仓库，不要先追大规模铺开。每个仓库先跑 1 到 2 周 audit mode。

试点目标：

- 首次安装是否能在 10 分钟内完成。
- 第一次 step summary 是否能让维护者看懂发生了什么。
- 哪些 finding ID 是有用的。
- 哪些 finding ID 是误报或过度严格。
- 维护者是否愿意保留这个 action。
- 是否减少了重复追问、缺少复现、缺少测试说明等低效沟通。

建议记录这些数据：

- 仓库名称和类型。
- audit 运行次数。
- 每次运行的 outcome。
- finding ID 频次。
- 维护者认为有用的 finding ID。
- 误报 finding ID。
- 从安装到第一次有用报告的时间。
- 是否继续使用。

## 试点安装步骤

先使用 audit workflow，保持只读权限：

```yaml
name: Maintainer Firewall

on:
  issues:
    types: [opened, edited, reopened]
  pull_request:
    types: [opened, edited, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  issues: read
  pull-requests: read

concurrency:
  group: maintainer-firewall-${{ github.event.issue.number || github.event.pull_request.number || github.run_id }}
  cancel-in-progress: true

jobs:
  firewall:
    runs-on: ubuntu-latest
    steps:
      - uses: wangjiehu/maintainer-firewall@v0.7.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          dry-run: true
```

完成首轮观察后，再按顺序升级：

1. 保持 audit mode，先调整 `.maintainer-firewall.yml`。
2. 只在 findings 有价值时启用评论。
3. 评论稳定后再启用标签。
4. 多个仓库稳定后再考虑 strict mode 或组织级配置。

## 发布新版本

只有这些情况才发新版本：

- 运行时代码变了。
- action 输入、输出或 JSON report shape 变了。
- 示例和文档当前版本号需要对外统一。
- release workflow 或发布资产需要被新 tag 实际验证。

发布前：

```bash
npm run market:check
```

发布后确认：

```bash
gh release view vX.Y.Z
gh run list --limit 10
```

下载 release asset 后验证 attestation：

```bash
gh attestation verify maintainer-firewall-X.Y.Z.tgz -R wangjiehu/maintainer-firewall
```

## Marketplace 决策

当前主仓库保留 CI、CodeQL、Release、Scorecard 和 Dependabot workflow，这是正确的工程选择。不要为了直接上 GitHub Marketplace 删除这些工作流。

如果要上 Marketplace，推荐路线是：

1. 保留当前仓库作为源码和工程质量主仓库。
2. 另建 dedicated listing repository。
3. listing repository 只放 Marketplace 需要的 action metadata、runtime bundle 和必要产品文件。
4. 用主仓库 release 流程同步 listing repository。

在做 dedicated listing repository 之前，先完成真实仓库试点。否则 Marketplace listing 只是形式完成，不能证明市场价值。

## 什么时候推进 v1.0.0-beta.1

满足这些条件再推进：

- 至少 3 个真实仓库完成 audit-mode 试点。
- 主要误报 finding ID 已经收敛。
- 安装路径没有明显阻塞。
- 至少 1 个仓库愿意从 audit mode 升级到评论模式。
- `npm run market:check` 持续通过。
- release asset 和 attestation 持续可验证。

## 暂时不要做的事

- 不要为了 Scorecard Packaging 分数强行发布 npm 包。
- 不要为了 Marketplace 删除主仓库 workflow。
- 不要在单维护者阶段强制 PR approval。
- 不要把仓库自测 workflow 里的 `wangjiehu/maintainer-firewall@main` 固定成 SHA。
- 不要把这个产品包装成 AI 检测器。

## 下一轮最有价值任务

1. 选 3 个真实仓库安装 audit mode。
2. 跑一周，记录 finding ID 和维护者反馈。
3. 根据反馈调整默认阈值、示例 config 或文案。
4. 通过后再决定是否做 dedicated Marketplace listing repository。
