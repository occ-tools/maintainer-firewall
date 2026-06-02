# Rules

Maintainer Firewall findings have stable IDs. Use these IDs to discuss reports, inspect JSON output, tune configuration, and connect comments, annotations, and step summaries.

AI-assisted findings also include IDs. They use model-provided IDs when valid, or fallback IDs such as `ai.finding.1`.

## Deterministic Rules

| ID | Applies to | Severity | Label | Trigger | Main tuning knobs |
| --- | --- | --- | --- | --- | --- |
| `issue.body.too_short` | Issues | warning | `needsInfo` | Issue body is shorter than `issue.minBodyCharacters`. | `issue.minBodyCharacters` |
| `issue.required_sections.missing` | Issues | warning | `needsInfo` | Required issue template headings are missing. | `issue.requiredSections` |
| `issue.reproduction.missing` | Issues | warning | `needsInfo` | Issue text does not include clear reproduction steps, examples, commands, or expected versus actual behavior. | `issue.requireReproduction` |
| `issue.environment.missing` | Issues | notice | `needsInfo` | Issue text does not mention version, runtime, OS, browser, or similar environment details. | `issue.requireEnvironment` |
| `issue.duplicate.possible` | Issues | notice | `possibleDuplicate` | A similar existing issue was found from duplicate candidate search. | `issue.duplicateSearchLimit` |
| `pr.draft` | Pull requests | notice | `maintainerReview` | Pull request is still marked as draft. | Mark PR ready for review |
| `pr.body.too_short` | Pull requests | warning | `needsInfo` | Pull request body is shorter than `pullRequest.minBodyCharacters`. | `pullRequest.minBodyCharacters` |
| `pr.required_sections.missing` | Pull requests | warning | `needsInfo` | Required pull request template headings are missing. | `pullRequest.requiredSections` |
| `pr.linked_issue.missing` | Pull requests | notice | `needsInfo` | Pull request body does not link or close an issue. | `pullRequest.requireLinkedIssue` |
| `pr.scope.large` | Pull requests | warning | `largeScope` | Changed line count exceeds `pullRequest.largeChangeThreshold`. | `pullRequest.largeChangeThreshold` |
| `pr.tests.missing` | Pull requests | warning | `needsTests` | Code files changed but no test files were detected. | `pullRequest.requireTestsForCodeChanges`, `pullRequest.testPathPatterns` |
| `pr.sensitive_paths.changed` | Pull requests | notice | `securityReview` | Changed files match configured sensitive path globs. | `pullRequest.sensitivePaths` |
| `content.secret.possible` | Issues and PRs | error | `securityReview` | Title or body matches a configured secret-like pattern. AI analysis is skipped when this fires. | `security.secretPatterns` |
| `content.security_report.possible` | Issues and PRs | warning for issues, notice for PRs | `securityReview` | Text mentions security-sensitive language such as CVEs, exploits, credential leaks, or vulnerability terms. | `security.reportPatterns` |

## Labels

Labels are configured separately from rule IDs. Defaults:

| Label key | Default label |
| --- | --- |
| `needsInfo` | `needs-info` |
| `needsTests` | `needs-tests` |
| `largeScope` | `large-scope` |
| `possibleDuplicate` | `possible-duplicate` |
| `securityReview` | `security-review` |
| `maintainerReview` | `maintainer-review` |

Change label names in `.maintainer-firewall.yml`:

```yaml
labels:
  needsInfo: needs-info
  needsTests: needs-tests
  securityReview: security-review
```

Disable label writes while keeping comments and summaries:

```yaml
labeling:
  enabled: false
```

## Severity Semantics

- `notice`: useful context or routing hint.
- `warning`: likely missing information or review friction.
- `error`: security-sensitive problem that should be handled before normal review.

`fail-on-findings: true` fails the workflow when warning or error findings exist. The default is advisory.

## Report Surfaces

Finding IDs appear in:

- Report comments.
- Step summaries.
- Structured JSON reports.
- Optional GitHub Actions annotations.

Finding IDs do not change contributor quality scoring. They are identifiers for maintainers to tune and debug the action.

## Tuning Patterns

Gentler issue intake:

```yaml
issue:
  minBodyCharacters: 80
  requireEnvironment: false
```

Strict pull request review:

```yaml
pullRequest:
  minBodyCharacters: 200
  requireLinkedIssue: true
  requireTestsForCodeChanges: true
  largeChangeThreshold: 400
  requiredSections:
    - Summary
    - Test plan
```

Disable security-sensitive language checks only if another process handles this:

```yaml
security:
  enabled: false
```

Prefer tuning `security.reportPatterns` and `security.secretPatterns` instead of disabling security checks completely.

