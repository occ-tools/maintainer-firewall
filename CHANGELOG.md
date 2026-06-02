# Changelog

All notable changes to Maintainer Firewall will be documented in this file.

## 0.1.3 - Skip State Cleanup

- Refreshes an existing Maintainer Firewall report when an ignore rule starts skipping a subject, avoiding stale contributor instructions.
- Removes stale managed labels when a skipped subject still has labels from an earlier run.
- Keeps the default skip path low-noise by updating existing reports instead of creating new skip comments.

## 0.1.2 - Config Robustness

- Makes YAML config merging shape-aware so invalid object, array, boolean, number, or string overrides fall back to defaults instead of crashing the action.
- Ignores unknown config keys during runtime normalization to keep loaded configuration predictable.
- Emits workflow warnings for unsupported config keys and invalid value shapes.

## 0.1.1 - Experience Polish

- Updates existing clean reports so stale bot comments do not keep telling contributors to fix already-resolved findings.
- Renames the visible score from "Quality score" to "Review readiness" and links the checked subject in the report.
- Adds repository dogfooding workflow for Maintainer Firewall itself.
- Clarifies that review readiness is advisory and not a judgment of contributor quality.
- Improves CODEOWNERS routing, JSON reports, AI safety controls, stale label cleanup, and configuration diagnostics.
- Groups Dependabot updates to reduce repository maintenance noise.
- Skips common automation authors by default and documents workflow concurrency to avoid duplicate report updates during rapid edits.
- Stabilizes skipped-event outputs and broadens default secret redaction for common token formats.
- Updates recommended workflows so skip labels and stale label cleanup react to label changes.

## 0.1.0 - Initial Release

- GitHub Action for issue and pull request review-readiness triage.
- Deterministic checks for missing context, reproduction details, environment details, linked issues, tests, large scope, sensitive paths, security-sensitive language, and possible exposed credentials.
- Optional OpenAI-assisted semantic analysis with repository guidance context, timeout handling, and pre-send redaction.
- Low-noise report comments, GitHub Actions step summaries, structured JSON report output, and workflow outputs.
- Label creation, stale label cleanup, CODEOWNERS routing hints, ignore rules, and dry-run support.
