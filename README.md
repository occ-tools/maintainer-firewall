# Maintainer Firewall

Maintainer Firewall is a GitHub Action for open-source maintainers who need a calmer triage queue. It reviews new issues and pull requests for evidence, reproducibility, scope, tests, and project-specific contribution rules.

It does not try to prove whether a contribution was AI-generated. Instead, it asks the question maintainers actually care about: is this contribution actionable and maintainable?

## Documentation map

- [Installation](docs/INSTALLATION.md): first install, permissions, fork PR safety, and first-run checklist.
- [Rollout Playbook](docs/ROLLOUT_PLAYBOOK.md): audit, advisory, collaborative, and strict rollout modes.
- [Rules](docs/RULES.md): finding IDs, trigger conditions, labels, severities, and tuning knobs.
- [Troubleshooting](docs/TROUBLESHOOTING.md): common setup, permission, AI, comment, label, and release issues.
- [Architecture](docs/ARCHITECTURE.md): internal flow and safety model.

Use Maintainer Firewall when you want advisory triage help. Do not use it as an AI-detector, automatic rejection system, or replacement for maintainer judgment.

## Product behavior

Each run produces a compact review-readiness report:

- An outcome such as `Needs contributor info`, `Needs tests`, or `Ready for maintainer review`
- A 0-100 review-readiness score
- Stable finding IDs for tuning and troubleshooting
- A short maintainer-facing headline
- Contributor-friendly next steps
- A collapsible finding table
- Optional labels
- Optional passing checks, so good contributions do not look like a silent no-op

The default mode is intentionally low-noise: it writes a comment only when there are findings. Workflow outputs are always set, so teams can build custom checks or dashboards without adding comments to clean issues and PRs. The Actions step summary also includes a setup table showing the active config path, dry-run state, comments, labels, annotations, JSON report, rule policy, configuration diagnostics, runtime diagnostics, AI status, and failure policy.

## What it checks

- Issue body completeness
- Reproduction steps or minimal examples
- Environment and version details
- Possible duplicate issues
- PR description quality
- Linked issues
- Test coverage for code changes
- Large or broad PR scope
- Sensitive path changes
- Security-sensitive language and possible leaked credentials
- CODEOWNERS routing hints for pull requests
- Optional AI-assisted semantic findings

CODEOWNERS support is best-effort and intended for routing hints, not as a replacement for GitHub's protected review enforcement.

This repository dogfoods Maintainer Firewall on its own issues and pull requests. The workflow does not check out pull request code.

## Quick start

For the first run, start in audit mode. It is read-only and writes the report to the Actions step summary without posting comments or labels.

Create `.github/workflows/maintainer-firewall.yml`:

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
      - uses: wangjiehu/maintainer-firewall@v0.6.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          dry-run: true
```

Add `.maintainer-firewall.yml` to customize thresholds, labels, and optional AI analysis.
Unsupported keys, invalid value shapes, invalid `comment.postWhen` values, and below-minimum numeric settings fall back to safe defaults and emit workflow warnings, so a malformed config does not break triage.
Configuration diagnostics also appear in the step summary, action outputs, and structured JSON reports when configured.
Runtime diagnostics for best-effort operations such as AI fallback, labels, comments, JSON reports, and step-summary writes are surfaced the same way.

After the first run, inspect the setup table in the step summary. Move to advisory or collaborative mode only after the findings and suggested labels match your expectations. See [Installation](docs/INSTALLATION.md) and [Rollout Playbook](docs/ROLLOUT_PLAYBOOK.md).

Use `pull_request_target` when you want the action to comment on pull requests from forks. Maintainer Firewall does not check out pull request code, and it loads configuration from the base ref. If you add checkout or custom scripts to the same job, do not run untrusted pull request code with write permissions.

The action also writes the report to the GitHub Actions step summary by default. Set `write-step-summary: false` to disable that.
The `labeled` and `unlabeled` events let ignore labels such as `skip-firewall` and stale label cleanup take effect immediately.

Set `report-json-path` when another workflow step should consume a structured report:

```yaml
      - uses: wangjiehu/maintainer-firewall@v0.6.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          report-json-path: maintainer-firewall-report.json
```

### Permissions and Events

Use the smallest permissions that match the rollout mode:

| Mode | Event | Permissions |
| --- | --- | --- |
| Audit | `pull_request` | `contents: read`, `issues: read`, `pull-requests: read` |
| Advisory | `pull_request_target` | `contents: read`, `issues: write`, `pull-requests: write` |
| Collaborative or strict | `pull_request_target` | `contents: read`, `issues: write`, `pull-requests: write` |

Do not combine `pull_request_target`, write permissions, and a checkout of untrusted pull request code in the same job.

## Optional OpenAI analysis

Maintainer Firewall works without an OpenAI API key. To enable AI-assisted semantic checks, set `ai.enabled: true` in `.maintainer-firewall.yml` and pass an API key:

```yaml
      - uses: wangjiehu/maintainer-firewall@v0.6.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

AI analysis is advisory. Deterministic checks run first, and the action only posts labels/comments unless you opt into failing the workflow.

When AI analysis is enabled, Maintainer Firewall also loads configured repository guidance files such as `CONTRIBUTING.md`, PR templates, and issue templates. This lets semantic findings reflect the project's own rules instead of generic checklist advice.

## Safer rollout

Start in dry-run mode if you want to inspect reports without writing comments or labels:

```yaml
      - uses: wangjiehu/maintainer-firewall@v0.6.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          dry-run: true
```

For early adoption, keep `comment.enabled: true` and `labeling.enabled: false` so contributors see useful next steps without changing your existing label workflow.

If you need comments on every run, set `comment.postWhen: always`. For output-only operation, set `comment.postWhen: never`.
Set `emit-annotations: true` when you want findings to appear as native GitHub Actions notice, warning, or error annotations without changing the advisory scoring behavior.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `github-token` | Yes |  | GitHub token used to read repository context and, outside dry-run mode, write labels/comments. |
| `openai-api-key` | No |  | Optional OpenAI API key. Required only when `ai.enabled: true`; deterministic rules run without it. |
| `config-path` | No | `.maintainer-firewall.yml` | Path to the Maintainer Firewall YAML config in the repository. |
| `dry-run` | No | `false` | Produce reports and outputs without writing labels, comments, or stale-label removals. |
| `fail-on-findings` | No | `false` | Fail the workflow when warning or error findings are produced. By default the action is advisory. |
| `emit-annotations` | No | `false` | Emit each finding as a GitHub Actions notice, warning, or error annotation. |
| `write-step-summary` | No | `true` | Write the report to the GitHub Actions step summary. |
| `report-json-path` | No |  | Workspace-relative path where a structured JSON report should be written for downstream steps. |

## Outputs

Maintainer Firewall sets outputs on every handled issue or pull request:

| Output | Description |
| --- | --- |
| `outcome` | Review-readiness outcome such as `ready`, `needs_info`, `needs_tests`, `needs_maintainer_review`, `blocked`, or `skipped`. |
| `score` | Review-readiness score from 0 to 100. |
| `findings-count` | Number of findings from enabled checks. |
| `labels` | Comma-separated suggested labels. |
| `routing-hints` | JSON array of CODEOWNERS-derived routing hints. |
| `skipped` | `true` when ignore rules skipped the subject. |
| `skip-reason` | Explanation when `skipped` is true. |
| `report-json-path` | Path to the structured JSON report when configured. |
| `config-warnings-count` | Number of configuration diagnostics emitted while loading and validating config. |
| `config-warnings` | JSON array of configuration diagnostics emitted while loading and validating config. |
| `runtime-warnings-count` | Number of runtime diagnostics emitted while best-effort operations ran. |
| `runtime-warnings` | JSON array of runtime diagnostics emitted while best-effort operations ran. |

## Configuration

The `$schema` line enables editor descriptions, completion, enums, and default values. Config files can be partial: omit fields you do not need to change. Array values replace the default list rather than appending to it, so include the full list when customizing arrays.

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/wangjiehu/maintainer-firewall/main/schema/maintainer-firewall.schema.json
version: 1

issue:
  enabled: true
  minBodyCharacters: 120
  requireReproduction: true
  requireEnvironment: true
  duplicateSearchLimit: 8
  requiredSections: []

pullRequest:
  enabled: true
  minBodyCharacters: 120
  requireLinkedIssue: true
  requireTestsForCodeChanges: true
  largeChangeThreshold: 800
  sensitivePaths:
    - ".github/workflows/**"
    - "package-lock.json"
    - "pnpm-lock.yaml"
    - "yarn.lock"
    - "Cargo.lock"
    - "go.sum"
  testPathPatterns:
    - "**/*.test.*"
    - "**/*.spec.*"
    - "**/__tests__/**"
    - "tests/**"
  requiredSections:
    - "Test plan"

repository:
  guidancePaths:
    - "CONTRIBUTING.md"
    - ".github/CONTRIBUTING.md"
    - "docs/CONTRIBUTING.md"
    - "PULL_REQUEST_TEMPLATE.md"
    - ".github/pull_request_template.md"
    - ".github/PULL_REQUEST_TEMPLATE.md"
    - ".github/PULL_REQUEST_TEMPLATE"
    - ".github/ISSUE_TEMPLATE.md"
    - ".github/ISSUE_TEMPLATE"
  codeOwnersPaths:
    - "CODEOWNERS"
    - ".github/CODEOWNERS"
    - "docs/CODEOWNERS"
  maxGuidanceCharacters: 16000

security:
  enabled: true
  reportPatterns:
    - "\\bCVE-\\d{4}-\\d+\\b"
    - "\\bvulnerab(?:ility|le)\\b"
    - "\\bexploit\\b"
    - "\\bRCE\\b"
    - "\\bremote code execution\\b"
    - "\\bXSS\\b"
    - "\\bCSRF\\b"
    - "\\bSSRF\\b"
    - "\\bSQL injection\\b"
    - "\\bpath traversal\\b"
    - "\\bprototype pollution\\b"
    - "\\bauth bypass\\b"
    - "\\bcredential leak\\b"
    - "\\btoken leak\\b"
    - "\\bsecret leak\\b"
  secretPatterns:
    - "\\bgithub_pat_[A-Za-z0-9_]{20,}\\b"
    - "\\bgh[pousr]_[A-Za-z0-9_]{36,}\\b"
    - "\\bsk-[A-Za-z0-9_-]{20,}\\b"
    - "\\bglpat-[A-Za-z0-9_-]{20,}\\b"
    - "\\bnpm_[A-Za-z0-9]{20,}\\b"
    - "\\bAIza[0-9A-Za-z\\-_]{35}\\b"
    - "\\bAKIA[0-9A-Z]{16}\\b"
    - "\\bxox[baprs]-[A-Za-z0-9-]{20,}\\b"
    - "\\bSG\\.[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{16,}\\b"
    - "\\beyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\b"
    - "\\b-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----\\b"

labels:
  needsInfo: needs-info
  needsTests: needs-tests
  largeScope: large-scope
  possibleDuplicate: possible-duplicate
  securityReview: security-review
  maintainerReview: maintainer-review

labeling:
  enabled: true
  createMissing: true
  removeStale: true

comment:
  enabled: true
  updateExisting: true
  header: Maintainer Firewall report
  postWhen: findings
  maxFindings: 8
  includePassingChecks: true

rules:
  disabled: []
  severityOverrides:
    notice: []
    warning: []
    error: []

ignore:
  authors:
    - dependabot[bot]
    - renovate[bot]
    - github-actions[bot]
  labels:
    - skip-firewall
  titlePatterns:
    - "^\\[skip firewall\\]"

ai:
  enabled: false
  model: gpt-5-mini
  maxInputCharacters: 12000
  maxOutputTokens: 1200
  timeoutMs: 15000
```

See [`examples/config.quiet.yml`](examples/config.quiet.yml) for a gentle rollout preset and [`examples/config.strict.yml`](examples/config.strict.yml) for stricter projects.
See [Rules](docs/RULES.md) for finding IDs, default severities, labels, suppression, severity overrides, and tuning knobs.

## Local development

```bash
npm install
npm run check
npm run demo
npm run bundle
npm run verify:dist
```

The bundled action entry point is `dist/index.js`.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the internal flow and safety model.

## Release

```bash
npm run check
npm run verify:dist
git tag v0.6.0
git push origin main v0.6.0
```

The release workflow publishes GitHub release notes for `v*` tags.
