# Marketplace Readiness

This checklist is for preparing Maintainer Firewall for a public beta, release tagging, and a possible GitHub Marketplace listing.

## Current Target

The next target is a public beta that is safe for real repositories in audit mode. The v1 target is broader market readiness: predictable install, stable contract, strong safety posture, and measurable maintainer value.

GitHub Marketplace has repository-level listing requirements in addition to product quality. GitHub's current publishing documentation says action repositories must contain a single root `action.yml` or `action.yaml` and must not contain workflow files. This repository intentionally keeps CI, CodeQL, dependency, release, and Scorecard workflows because they are part of the product's trust posture. If direct Marketplace listing becomes the priority, choose one of these paths before publishing:

- Move the listed action into a dedicated listing repository that contains only the action metadata, runtime bundle, and required product files.
- Temporarily remove workflow files from the listing repository after preserving equivalent CI in a source or release repository.
- Treat GitHub Marketplace listing as deferred and ship public beta through tagged releases until the listing structure is resolved.

## Required Before Public Beta

- Public repository with root `action.yml`.
- Tagged release such as `v1.0.0-beta.1` or `v1.0.0`.
- `dist/` bundle committed and matching source.
- README includes install path, permissions, safety boundary, and examples.
- License, security policy, support policy, contribution guide, and changelog are present.
- Package dry-run contains only runtime bundle, docs, examples, schema, and required metadata.
- `npm run check`, `npm run coverage`, `npm run demo`, `npm audit --audit-level=moderate`, and `npm pack --dry-run` pass.
- `npm run market:check` passes, including CI, bundled `dist/` verification, coverage, demo, audit, package dry-run, and launch-document checks.
- Coverage is configured to include source modules explicitly, with only the thin action entry point and type-only module excluded.

Additional requirements before a direct GitHub Marketplace listing:

- Repository structure satisfies the current Marketplace publishing rules.
- Action metadata `name` is unique and does not conflict with existing Marketplace names, user or organization names, categories, or reserved GitHub feature names.
- Release notes clearly state the public contract, support channel, and known limitations.

## Security Gate

- Do not check out pull request code in Maintainer Firewall workflows.
- Keep `pull_request_target` examples separated from any untrusted checkout or contributor-controlled scripts.
- Mask GitHub and OpenAI tokens.
- Redact findings, outputs, step summaries, JSON reports, labels, routing hints, changed file names, diagnostics, and skipped reasons.
- Ignore invalid or potentially unsafe configured regular expressions.
- Keep AI disabled by default.
- Skip AI analysis when possible credentials are detected.
- Run CodeQL and dependency update workflows.
- Run OpenSSF Scorecard before public launch and record remediation items. This repository includes `.github/workflows/scorecard.yml` for scheduled and manual checks.
- Keep CODEOWNERS review on workflow, action metadata, runtime source, bundle, schema, package, and release-gate files.
- Keep the AI data boundary documented before promoting optional AI usage.

Suggested Scorecard command:

```bash
scorecard --repo=github.com/wangjiehu/maintainer-firewall
```

If the CLI is unavailable locally, run the GitHub Action version and publish the score in release notes.

## Product Gate

- First install works in read-only audit mode.
- Step summary clearly explains active config, dry-run state, comments, labels, annotations, JSON report, diagnostics, AI state, and failure policy.
- Clean issues and pull requests do not create noisy comments by default.
- Contributors receive specific next steps when findings exist.
- Maintainers can tune exact finding IDs through `rules.disabled` and `rules.severityOverrides`.
- Presets exist for quiet, strict, library, monorepo, and security-sensitive repositories.
- Deterministic evaluation fixtures run through `npm run evaluate`.
- Metrics workflow examples exist for audit-mode calibration.
- Docs explain when not to use the action.

## Launch Sequence

1. Cut `v1.0.0-beta.1`.
2. Install in audit mode on this repository and at least two external repositories.
3. Record false positives, false negatives, runtime warnings, and install friction.
4. Fix the highest-frequency issues.
5. Cut `v1.0.0-beta.2` if needed.
6. Decide the listing path: direct Marketplace listing, dedicated listing repository, or tagged-release public beta.
7. Keep the listing beta until at least 10 repositories have completed audit-mode calibration.
8. Cut `v1.0.0` after stable contract, docs, and support workflow are proven.

## Listing Copy

Short description:

> Maintainer-first issue and pull request triage for evidence, reproducibility, scope, tests, security-sensitive signals, and repository rules.

Long description should emphasize:

- Advisory review readiness, not AI detection.
- Read-only audit mode for first install.
- Optional comments, labels, annotations, step summaries, and JSON reports.
- Optional OpenAI-assisted semantic review with redaction and timeout.
- No checkout of pull request code.

## Evidence To Collect

- Number of audit runs.
- Percentage of findings accepted as useful by maintainers.
- Top false-positive finding IDs.
- Time from install to first useful report.
- Number of runtime warnings per run.
- Number of repositories that kept the action after calibration.
