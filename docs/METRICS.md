# Metrics

Use metrics to decide whether Maintainer Firewall is reducing triage friction. Do not claim time savings without pilot evidence.

## What To Track

Useful rollout metrics:

- Number of audit runs.
- Outcome distribution.
- Finding counts by ID and severity.
- Runtime warning count.
- Config warning count.
- Suggested labels.
- Whether maintainers marked findings useful, noisy, or wrong.

## JSON Report Workflow

Set `report-json-path` and upload the report as an artifact. During rollout, also set `effective-config-json-path` so maintainers can confirm active thresholds and surfaces without reading source code.

See [`examples/workflow.metrics.yml`](../examples/workflow.metrics.yml) for a workflow that writes both JSON files, uploads them, and prints a compact metrics line.

For local aggregation, download one or more report artifacts and run:

```bash
npm run metrics:summary -- reports/
```

The summary script counts reports, skipped runs, outcomes, findings by ID and severity, labels, configuration warnings, and runtime warnings. It ignores effective-config JSON files and exits non-zero when no valid report payloads are found.

## Calibration Labels

For pilots, use maintainer-only labels or notes:

- `firewall-useful`
- `firewall-noisy`
- `firewall-wrong`

These labels should inform manual tuning. Maintainer Firewall does not automatically learn from labels or change repository policy.

## Pilot Thresholds

Before v1, target:

- 70% or higher useful finding rate during pilot.
- 0 severe false positives before enabling contributor comments.
- 0 runtime warnings on clean public repositories.
- 5 or more repositories keeping audit mode after week two.
