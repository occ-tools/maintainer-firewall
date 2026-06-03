# Changelog

All notable changes to Maintainer Firewall will be documented in this file.

## 0.6.0 - Runtime Diagnostics Visibility

- Captures runtime warnings from AI fallback, repository guidance loading, CODEOWNERS loading, GitHub write operations, comment lookups, JSON report writes, and step-summary writes.
- Adds `runtime-warnings-count` and `runtime-warnings` outputs for downstream workflow steps.
- Adds runtime diagnostics to structured JSON reports when `report-json-path` is configured.
- Shows runtime warning counts and warning details in the Actions step summary setup table.
- Centralizes protected finding IDs so diagnostics, setup summaries, and finding policy cannot drift.

## 0.5.0 - Configuration Diagnostics Visibility

- Captures configuration loading and validation warnings as first-class diagnostics.
- Shows configuration warning counts and warning details in the Actions step summary setup table.
- Adds `config-warnings-count` and `config-warnings` outputs for downstream workflow steps.
- Adds configuration diagnostics to structured JSON reports.
- Redacts configuration diagnostics before exposing them through summaries, outputs, or JSON reports.

## 0.4.0 - Rule Policy Tuning

- Adds `rules.disabled` for suppressing exact finding IDs across comments, labels, annotations, JSON reports, summaries, and failure checks.
- Adds `rules.severityOverrides.notice`, `rules.severityOverrides.warning`, and `rules.severityOverrides.error` for exact finding ID severity tuning.
- Adds config diagnostics for disabled/override conflicts and duplicate severity override entries.
- Keeps `content.secret.possible` protected so possible credential leaks cannot be suppressed or downgraded.
- Shows rule policy state in the Actions step summary setup table.
- Documents suppression and severity override workflows in README, Rules, Troubleshooting, Roadmap, and Architecture docs.

## 0.3.0 - Onboarding and Setup Clarity

- Adds installation, rollout, rules, troubleshooting, and UX improvement planning docs.
- Adds audit, advisory, collaborative, and strict workflow examples.
- Adds a setup table to the Actions step summary so first runs show active comments, labels, annotations, JSON, AI, and failure policy.
- Shows stable finding IDs in report comments and GitHub Actions annotations.
- Redacts finding IDs alongside titles, details, and suggestions.

## 0.2.0 - Workflow Annotations

- Adds an `emit-annotations` input for optional GitHub Actions notice, warning, and error annotations for findings.
- Redacts, compacts, and truncates annotation text before emitting it.
- Documents annotation output in README, ROADMAP, and Architecture docs.
- Adds annotation tests and updates action metadata coverage for the new input.

## 0.1.11 - Documentation Alignment

- Moves shipped CODEOWNERS routing, repository guidance, schema guidance, reports, and AI guardrails out of near-term roadmap items.
- Updates architecture docs to describe report redaction coverage and GitHub API fallback behavior.
- Adds documentation consistency tests for roadmap and architecture coverage.

## 0.1.10 - Report Redaction Coverage

- Redacts configured secret patterns from finding titles, details, suggestions, summary headlines, next steps, passed checks, and routing hint files.
- Applies the same redaction helper to both GitHub comments and structured JSON reports.
- Adds redaction, comment, and report tests for finding and summary fields.

## 0.1.9 - Comment Lookup Resilience

- Keeps runs from failing when GitHub cannot list existing report comments during clean-report or skipped-report refresh checks.
- Emits a workflow warning for failed report-comment lookups and continues with outputs, step summaries, and JSON reports.
- Adds GitHub client tests for existing report comment detection and comment lookup fallback.

## 0.1.8 - AI Output Guardrails

- Normalizes AI finding text by compacting whitespace before reports, summaries, and JSON output use it.
- Caps AI finding ids, titles, details, and suggestions so model output cannot produce oversized comments or reports.
- Adds AI response normalization tests for long multiline findings and malformed findings.

## 0.1.7 - Runtime Resilience

- Continues pull request triage with title and body checks when GitHub cannot list changed files, instead of failing the entire action.
- Handles concurrent managed-label creation races by continuing when GitHub reports the label already exists.
- Adds GitHub client tests for pull request file-list fallback, changed-file mapping, and concurrent label creation.

## 0.1.6 - Action Metadata Guidance

- Clarifies Marketplace-facing action input descriptions for dry-run behavior, advisory failures, summaries, and JSON reports.
- Adds a README inputs table so workflow authors can scan every supported input without opening `action.yml`.
- Adds action metadata tests that keep declared inputs, outputs, defaults, and README tables aligned.

## 0.1.5 - Schema Guidance

- Adds descriptions, defaults, examples, and enum guidance to the YAML configuration schema so editors can explain settings inline.
- Adds schema coverage tests that compare documented defaults against the runtime default configuration.
- Clarifies that array settings replace defaults rather than appending to them, and expands README examples to avoid accidental narrowing.
- Lets the repository dogfood current default security patterns instead of pinning an older partial pattern list.

## 0.1.4 - Contributor-Friendly Reports

- Rewrites prominent next steps to speak directly and respectfully to contributors instead of describing them in third person.
- Updates deterministic finding suggestions and the details table heading to use contributor-friendly next-step language.
- Keeps maintainer-only routing guidance explicit for security-sensitive or ownership-sensitive findings.
- Adds workflow warnings for invalid `comment.postWhen` values and below-minimum numeric settings before normalization falls back to safe values.

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
