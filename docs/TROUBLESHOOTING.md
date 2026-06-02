# Troubleshooting

Use the Actions step summary first. It shows the active setup state and the review report.

## The Action Did Not Run

Check:

- The workflow file is under `.github/workflows/`.
- The event includes the activity type that happened, for example `opened`, `edited`, `synchronize`, or `ready_for_review`.
- For pull requests from forks, use `pull_request_target` only when you need write access for comments or labels.
- The job has `contents: read`.

## The Action Ran But Did Not Comment

Common causes:

- `dry-run: true` suppresses labels, comments, and stale-label removals.
- `comment.enabled: false` disables comments.
- `comment.postWhen: findings` posts only when findings exist.
- `comment.postWhen: never` disables comments.
- The job lacks `issues: write` or `pull-requests: write`.
- For skipped subjects, the action updates an existing managed report by default but does not create a new skipped comment unless `comment.postWhen: always`.

## Labels Were Not Applied

Common causes:

- `dry-run: true` suppresses label writes.
- `labeling.enabled: false` disables label writes.
- The job lacks `issues: write` or `pull-requests: write`.
- `labeling.createMissing: false` prevents creating labels that do not already exist.
- No finding mapped to a label.

## Stale Labels Were Not Removed

Check:

- `labeling.enabled: true`
- `labeling.removeStale: true`
- The existing label is one of the managed labels configured under `labels`.
- The job has write permissions.
- `dry-run` is not enabled.

## The Workflow Failed

Maintainer Firewall is advisory by default. If it failed because of findings, `fail-on-findings: true` is enabled.

Use strict mode only after calibration:

```yaml
with:
  fail-on-findings: true
```

Warnings and errors fail the workflow in strict mode. Notices do not.

## AI Analysis Did Not Run

Check:

- `.maintainer-firewall.yml` has `ai.enabled: true`.
- The action input includes `openai-api-key`.
- The secret exists in repository or organization settings.
- No `content.secret.possible` finding fired. The action skips AI analysis when a possible credential is detected.

Deterministic rules still run without AI.

## Config Warnings

The action normalizes invalid or below-minimum config values to safe defaults and emits workflow warnings.

Common examples:

- Unknown top-level key.
- Invalid `comment.postWhen`.
- Numeric setting below the minimum.
- Array field provided as a non-array value.

Use the schema line for editor guidance:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/wangjiehu/maintainer-firewall/main/schema/maintainer-firewall.schema.json
version: 1
```

## Finding Seems Wrong

Use the finding ID shown in the report table and check [Rules](RULES.md).

Typical adjustments:

- Raise or lower `issue.minBodyCharacters`.
- Disable `issue.requireEnvironment` for projects where environment rarely matters.
- Tune `pullRequest.testPathPatterns` when tests live in custom directories.
- Raise `pullRequest.largeChangeThreshold` for repositories with large generated changes.
- Add or remove `pullRequest.sensitivePaths`.
- Keep `labeling.enabled: false` during calibration.

## Duplicate Reports

Maintainer Firewall marks its own comments with `<!-- maintainer-firewall:report -->` and updates existing managed comments by default.

If duplicate comments appear:

- Confirm `comment.updateExisting: true`.
- Confirm old comments still include the marker.
- Confirm the workflow is not running multiple jobs with different configs for the same issue or pull request.
- Keep the concurrency group from the examples.

## Fork Pull Request Safety

For fork PR comments, `pull_request_target` is useful but must be handled carefully.

Safe pattern:

- No checkout of untrusted pull request code.
- No contributor-controlled scripts.
- Minimal write permissions.
- Maintainer Firewall job separated from build/test jobs that run PR code.

Unsafe pattern:

- `pull_request_target`
- write permissions
- checkout of the fork head
- running scripts from the pull request

## Release Or Dist Verification Failed

This repository commits the bundled action under `dist/`.

After runtime source changes:

```bash
npm run check
npm run bundle
npm run verify:dist
```

If `verify:dist` reports differences, commit the updated `dist/index.js` and `dist/index.js.map` with the source changes.

