# Roadmap

## Shipped

- Low-noise issue and pull request triage with comments, labels, step summaries, and structured JSON reports.
- Optional GitHub Actions annotations for native workflow notices, warnings, and errors.
- Setup-state step summaries for first-run clarity.
- Focused installation, rollout, rules, troubleshooting, and UX planning documentation.
- Stable finding IDs surfaced in comments, annotations, and JSON reports.
- Suppression and severity override controls keyed by exact finding ID.
- Configuration diagnostics surfaced in step summaries, outputs, and structured JSON reports.
- Runtime diagnostics surfaced in step summaries, outputs, and structured JSON reports.
- CODEOWNERS-aware routing hints for pull requests.
- Repository guidance loading from `CONTRIBUTING.md`, pull request templates, and issue templates.
- Optional OpenAI-assisted semantic review with timeout, truncation, response normalization, and redaction.
- Configuration schema guidance with editor descriptions and runtime shape warnings.

## Near Term

- GitHub App packaging for teams that want central configuration.
- Deeper project-specific rule extraction from `CONTRIBUTING.md` and templates into deterministic checks.
- Better duplicate detection using embeddings when AI is enabled.
- SARIF or code-scanning output for teams that prefer security dashboard surfaces over workflow annotations.
- Organization-scale configuration review workflows.

## Later

- Dashboard for maintainers to tune false positives.
- Per-repository policy presets for libraries, CLIs, frameworks, and security-sensitive projects.
- Maintainer feedback loop that learns which findings were useful.
- Private security-report verification workflows.

## Non Goals

- Detecting whether a contributor used AI.
- Automatically closing issues.
- Automatically rejecting pull requests.
- Replacing maintainer judgment.
