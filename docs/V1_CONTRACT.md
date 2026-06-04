# V1 Contract

This document defines the public contract Maintainer Firewall must keep stable for a v1 release.

## Stability Rules

- Finding IDs are stable once released in v1.
- Action inputs keep their names and default behavior through v1.
- Action outputs keep their names and value shapes through v1.
- JSON report `version: 1` keeps backward-compatible fields through v1.
- Effective config report `version: 1` keeps backward-compatible fields through v1.
- Comment wording may improve, but report structure and managed comment marker remain stable.
- New findings may be added in minor releases when they are advisory by default.
- Existing findings may be removed only in a major release unless they are proven unsafe or incorrect.

## Action Inputs

| Input | Required | Default | Stable behavior |
| --- | --- | --- | --- |
| `github-token` | Yes |  | Reads repository context and writes comments or labels when configured and not in dry-run. |
| `openai-api-key` | No |  | Enables optional AI analysis only when `ai.enabled: true`. |
| `config-path` | No | `.maintainer-firewall.yml` | Loads YAML config from the base ref for pull requests. |
| `dry-run` | No | `false` | Suppresses label writes, comment writes, and stale-label removals. |
| `fail-on-findings` | No | `false` | Fails only when warning or error findings exist. |
| `emit-annotations` | No | `false` | Emits GitHub Actions annotations for findings. |
| `write-step-summary` | No | `true` | Writes setup state and report to the Actions step summary. |
| `report-json-path` | No |  | Writes a structured JSON report to a workspace-relative path. |
| `effective-config-json-path` | No |  | Writes a redacted effective configuration report to a workspace-relative path. |

## Action Outputs

| Output | Shape |
| --- | --- |
| `outcome` | String enum: `ready`, `needs_info`, `needs_tests`, `needs_maintainer_review`, `possible_duplicate`, `blocked`, or `skipped`. |
| `score` | Stringified integer from `0` to `100`, or empty when skipped. |
| `findings-count` | Stringified integer. |
| `labels` | Comma-separated label names after redaction. |
| `routing-hints` | JSON array of `{ "owner": string, "files": string[] }` after redaction. |
| `skipped` | `true` or `false`. |
| `skip-reason` | Redacted string when skipped. |
| `report-json-path` | Configured path or empty string. |
| `effective-config-json-path` | Configured path or empty string. |
| `config-warnings-count` | Stringified integer. |
| `config-warnings` | JSON array of redacted strings. |
| `runtime-warnings-count` | Stringified integer. |
| `runtime-warnings` | JSON array of redacted strings. |

## JSON Report

The report payload is versioned:

```json
{
  "version": 1,
  "skipped": false,
  "subject": {
    "kind": "pull_request",
    "number": 42,
    "title": "Example",
    "author": "contributor",
    "url": "https://github.com/owner/repo/pull/42",
    "labels": [],
    "changedFiles": []
  },
  "summary": {
    "score": 82,
    "outcome": "needs_info",
    "headline": "This pull request needs more context before review will be efficient.",
    "nextSteps": [],
    "passedChecks": [],
    "labels": [],
    "routingHints": []
  },
  "findings": [
    {
      "id": "pr.required_sections.missing",
      "severity": "warning",
      "title": "Required template sections are missing",
      "details": "Missing section: Test plan.",
      "suggestion": "Please fill out the missing template sections before review.",
      "label": "needsInfo",
      "source": "rule",
      "references": [
        {
          "source": "config",
          "path": "pullRequest.requiredSections",
          "label": "Test plan"
        }
      ]
    }
  ],
  "diagnostics": {
    "configWarnings": [],
    "runtimeWarnings": []
  }
}
```

The subject body is intentionally not serialized. Finding details, summary text, labels, routing hints, changed file names, and diagnostics are redacted using configured secret patterns.

Finding `references` are optional and additive. They identify configured requirements or guidance that explain a finding without changing contributor-facing comment structure.

## Effective Config Report

The effective config report is versioned and redacted. It is intended for rollout debugging and metrics, not for storing secrets:

```json
{
  "version": 1,
  "configPath": ".maintainer-firewall.yml",
  "subjectKind": "pull_request",
  "surfaces": {
    "dryRun": true,
    "comments": "enabled:findings:updateExisting=true",
    "labels": "enabled:dry-run",
    "annotations": false,
    "stepSummary": true,
    "reportJsonPath": "reports/firewall.json",
    "effectiveConfigJsonPath": "reports/effective-config.json",
    "failOnFindings": false,
    "ai": {
      "enabled": false,
      "apiKeyProvided": false,
      "model": "gpt-5-mini",
      "timeoutMs": 15000,
      "maxInputCharacters": 12000,
      "maxOutputTokens": 1200
    }
  },
  "enabledChecks": {
    "issue": {
      "enabled": true,
      "minBodyCharacters": 120,
      "requireReproduction": true,
      "requireEnvironment": true,
      "duplicateSearchLimit": 8,
      "requiredSections": []
    },
    "pullRequest": {
      "enabled": true,
      "minBodyCharacters": 120,
      "requireLinkedIssue": true,
      "requireTestsForCodeChanges": true,
      "largeChangeThreshold": 800,
      "requiredSections": [],
      "sensitivePathPatterns": 6,
      "testPathPatterns": 4
    },
    "security": {
      "enabled": true,
      "reportPatterns": 15,
      "secretPatterns": 11
    }
  },
  "labels": {
    "needsInfo": "needs-info"
  },
  "rules": {
    "disabled": [],
    "severityOverrides": {
      "notice": [],
      "warning": [],
      "error": []
    }
  },
  "ignore": {
    "authors": ["dependabot[bot]"],
    "labels": ["skip-firewall"],
    "titlePatterns": ["^\\[skip firewall\\]"]
  },
  "repository": {
    "guidancePaths": ["CONTRIBUTING.md"],
    "codeOwnersPaths": ["CODEOWNERS"],
    "maxGuidanceCharacters": 16000
  }
}
```

Raw `security.secretPatterns` and `security.reportPatterns` are not serialized; the report exposes counts instead.

## Managed Comment Marker

Maintainer Firewall identifies its own comments with:

```html
<!-- maintainer-firewall:report -->
```

This marker must not change within v1 because it prevents duplicate report comments.

## Finding Policy

Deterministic finding IDs are listed in [Rules](RULES.md). AI-assisted finding IDs are normalized into stable `ai.*` policy IDs where possible.

Policy behavior:

- `rules.disabled` removes exact matching findings before reports, labels, annotations, JSON output, and failure checks.
- `rules.severityOverrides` changes exact matching severities.
- `content.secret.possible` remains protected and cannot be suppressed or downgraded.

## Release Compatibility Gate

Before v1 release candidates:

```bash
npm run ci
npm run market:check
```

Breaking changes require a major version bump and changelog entry.
