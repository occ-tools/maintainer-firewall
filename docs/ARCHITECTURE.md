# Architecture

Maintainer Firewall is built as a GitHub JavaScript Action with a small deterministic core and an optional AI layer.

## Flow

1. Load configuration from the base ref.
2. Build an issue or pull request subject from the GitHub event.
3. Apply ignore rules.
4. Run deterministic rules.
5. Skip AI analysis if a possible secret is detected.
6. Load repository guidance and CODEOWNERS hints when needed.
7. Run optional AI analysis with timeout, input truncation, output normalization, and redaction.
8. Create a review summary with outcome, score, next steps, labels, and routing hints.
9. Redact report-facing finding and summary fields.
10. Set action outputs and optionally emit GitHub Actions annotations for findings.
11. Compose a maintainer-only setup summary for the Actions step summary.
12. Write logs, step summary, optional JSON report, labels, and comment.

## Design Principles

- Deterministic checks run first and work without network calls beyond GitHub.
- AI analysis is advisory, optional, and disabled by default.
- Issue and pull request text are treated as untrusted input.
- Possible credentials are not repeated in findings or structured reports.
- The action does not check out pull request code.
- Label and comment writes are best-effort so triage does not fail because of permission differences.
- Pull request file listing and existing report comment lookup degrade to warnings so body/title triage can continue.
- Native workflow annotations are opt-in to keep the default experience low-noise.
- The setup summary is kept out of issue and pull request comments so contributor-facing reports stay focused.

## Main Modules

- `src/index.ts`: action entry point and orchestration.
- `src/annotations.ts`: optional GitHub Actions annotation emission.
- `src/rules.ts`: deterministic issue and pull request findings.
- `src/review.ts`: outcome, score, passed checks, next steps, and routing model.
- `src/comment.ts`: Markdown report rendering and comment policy.
- `src/redaction.ts`: shared redaction helpers for subjects, findings, summaries, comments, and JSON reports.
- `src/ai.ts`: optional OpenAI Responses API integration.
- `src/guidance.ts`: repository guidance loading.
- `src/codeowners.ts`: best-effort CODEOWNERS routing hints.
- `src/report.ts`: structured JSON report generation.
- `src/labels.ts`: desired and stale managed label calculation.
- `src/setup-summary.ts`: maintainer-facing setup state for Actions step summaries.
