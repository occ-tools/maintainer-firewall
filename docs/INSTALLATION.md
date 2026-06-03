# Installation

This guide is for maintainers installing Maintainer Firewall for the first time.

## Before You Install

Use Maintainer Firewall when you want:

- A calmer issue and pull request triage queue.
- Contributor-friendly requests for missing context, reproduction steps, linked issues, tests, or maintainer routing.
- Advisory reports that can start in dry-run mode.
- Optional labels, comments, workflow annotations, step summaries, and JSON reports.

Do not use Maintainer Firewall as:

- An AI-detector.
- An automatic rejection or closing system.
- A replacement for maintainer judgment.
- A workflow that checks out untrusted pull request code with write permissions.

## Recommended First Install

Start with audit mode. It uses read permissions, writes only the Actions step summary, and does not post comments or labels.

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

After the first run, inspect the step summary. It now shows both the review report and a setup table that confirms active surfaces such as dry-run, comments, labels, annotations, JSON report output, diagnostics, AI status, and failure policy.

## Fork Pull Requests

Use `pull_request_target` only when you need the action to comment on pull requests from forks.

Maintainer Firewall itself does not check out pull request code and loads configuration from the base ref. Keep that safety property intact:

- Do not add `actions/checkout` of untrusted pull request code to the same job.
- Do not run contributor-controlled scripts in a job with write permissions.
- Keep permissions as small as possible for the rollout mode.

## Permissions By Mode

| Mode | Event | Permissions | Writes |
| --- | --- | --- | --- |
| Audit | `pull_request` | `contents: read`, `issues: read`, `pull-requests: read` | Step summary only |
| Advisory | `pull_request_target` | `contents: read`, `issues: write`, `pull-requests: write` | Comments on findings |
| Collaborative | `pull_request_target` | `contents: read`, `issues: write`, `pull-requests: write` | Comments and labels |
| Strict | `pull_request_target` | `contents: read`, `issues: write`, `pull-requests: write` | Comments, labels, and workflow failure |

See [Rollout Playbook](ROLLOUT_PLAYBOOK.md) for complete examples.

## Optional Configuration

Maintainer Firewall works without a config file. Add `.maintainer-firewall.yml` only when you need to tune thresholds, labels, comments, ignore rules, security patterns, or optional AI analysis.

Use the schema line for editor completion:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/wangjiehu/maintainer-firewall/main/schema/maintainer-firewall.schema.json
version: 1
```

Start from one of these examples:

- [Quiet config](../examples/config.quiet.yml)
- [Strict config](../examples/config.strict.yml)

## Optional AI Analysis

AI analysis is disabled by default. Deterministic rules run without an OpenAI API key.

To enable AI-assisted semantic findings:

1. Set `ai.enabled: true` in `.maintainer-firewall.yml`.
2. Add `openai-api-key: ${{ secrets.OPENAI_API_KEY }}` to the action inputs.

The action redacts configured secret patterns before AI prompts and skips AI analysis if a possible credential is detected in the issue or pull request text.

## First-Run Checklist

After the first successful run, confirm:

- The setup table shows the intended event type and config path.
- Configuration warnings are zero, or every warning is understood and intentional.
- `dry-run` is still enabled for the first calibration run.
- Comments are disabled or limited to findings, depending on your rollout mode.
- Label writes are disabled or intentionally suppressed by dry-run.
- Rule policy shows the expected disabled and severity override counts.
- Suggested labels match your repository naming conventions.
- The report's finding IDs match documented rules in [Rules](RULES.md).
- No unexpected workflow failure occurred.
- Fork pull request jobs do not check out or execute untrusted code.

## Promote Gradually

Recommended rollout:

1. Run audit mode for several issues and pull requests.
2. Tune `.maintainer-firewall.yml` for noisy thresholds or labels.
3. Enable comments on findings.
4. Enable labels after the suggested labels look correct.
5. Enable annotations or `fail-on-findings` only when maintainers explicitly want those surfaces.
