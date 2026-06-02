# Rollout Playbook

Maintainer Firewall is easiest to adopt when rollout mode is explicit. Start quiet, inspect the first reports, then turn on the surfaces that match your maintenance style.

## Mode Matrix

| Mode | Best for | Writes comments | Writes labels | Fails workflow | Recommended duration |
| --- | --- | --- | --- | --- | --- |
| Audit | First install, policy calibration, private evaluation | No | No | No | First week or first 10-20 runs |
| Advisory | Contributor guidance without label changes | Findings only | No | No | Default open-source rollout |
| Collaborative | Maintainer queue management with labels | Findings only | Yes | No | Repositories with established labels |
| Strict | Teams that require triage checks to block | Findings only | Yes | Yes | Only after calibration |

## Audit Mode

Use this first. It is read-only and writes the report to the Actions step summary.

```yaml
- uses: wangjiehu/maintainer-firewall@v0.3.0
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    dry-run: true
```

Pair with:

```yaml
permissions:
  contents: read
  issues: read
  pull-requests: read
```

Use [examples/workflow.audit.yml](../examples/workflow.audit.yml).

## Advisory Mode

Use this when contributor-facing comments are useful but labels should remain under maintainer control.

```yaml
- uses: wangjiehu/maintainer-firewall@v0.3.0
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Pair with a quiet config:

```yaml
labeling:
  enabled: false

comment:
  enabled: true
  postWhen: findings
```

Use [examples/workflow.advisory.yml](../examples/workflow.advisory.yml) and [examples/config.quiet.yml](../examples/config.quiet.yml).

## Collaborative Mode

Use this when labels should help maintainers scan the queue.

```yaml
- uses: wangjiehu/maintainer-firewall@v0.3.0
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Pair with:

```yaml
labeling:
  enabled: true
  createMissing: true
  removeStale: true

comment:
  enabled: true
  postWhen: findings
```

Use [examples/workflow.collaborative.yml](../examples/workflow.collaborative.yml).

## Strict Mode

Use this only after the rule set has been calibrated. It fails the workflow for warning or error findings.

```yaml
- uses: wangjiehu/maintainer-firewall@v0.3.0
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    emit-annotations: true
    fail-on-findings: true
```

Use [examples/workflow.strict.yml](../examples/workflow.strict.yml) and [examples/config.strict.yml](../examples/config.strict.yml).

## Promotion Checklist

Before moving from audit to advisory:

- Findings are understandable to contributors.
- Thresholds do not flag normal high-quality reports.
- Suggested labels match your existing label taxonomy.
- Skip labels and ignored automation authors work as expected.

Before moving from advisory to collaborative:

- Maintainers agree that the labels help queue scanning.
- `labeling.removeStale` behavior is understood.
- Existing labels with the same names are acceptable for the action to manage.

Before moving to strict:

- The repository has a clear policy that missing tests, missing context, or security-sensitive content should fail the check.
- False positives have been tuned.
- Maintainers have a fast path to override or re-run after contributors fix reports.

## Calibration Notes

- If issue reports are too noisy, lower `issue.requireEnvironment` or increase guidance in issue templates.
- If pull requests are too noisy, tune `pullRequest.minBodyCharacters`, `requireLinkedIssue`, and `requireTestsForCodeChanges`.
- If large refactors are expected, raise `pullRequest.largeChangeThreshold`.
- If labels are not desired, keep `labeling.enabled: false` and rely on comments, step summary, annotations, or JSON.
- If contributors complain about technical language, keep finding IDs in the details table but make next steps more specific through templates and project guidance.

