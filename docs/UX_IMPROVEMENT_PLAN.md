# User Experience Improvement Plan

Status: approved direction; Phase 0, Phase 1, part of Phase 2, and the highest-value calibration controls are implemented in v0.7.0.

Baseline: Maintainer Firewall v0.7.0 already supports low-noise triage reports, labels, setup-state step summaries, structured JSON reports with configuration and runtime diagnostics, redacted effective-config reports, optional workflow annotations, CODEOWNERS routing hints, configuration schema guidance, stable finding IDs, focused onboarding docs, exact finding-ID suppression, exact finding-ID severity overrides, warning outputs, deterministic evaluation fixtures, metrics workflow examples, and optional AI-assisted semantic review.

## Objective

Improve the full user experience from evaluation to long-term operation:

- Pre-install: help maintainers decide whether this action fits their repository and which rollout path to choose.
- Install: reduce setup mistakes around events, permissions, `pull_request_target`, labels, config files, and optional AI.
- First run: make the first successful dry run easy to interpret and safe to promote.
- Daily use: make reports more actionable for contributors and less noisy for maintainers.
- Long-term use: support tuning, metrics, feedback loops, and organization-scale adoption.

The north-star user outcome is: a maintainer can install safely in under 10 minutes, understand the first report without reading source code, tune false positives in one place, and keep using the action without comment noise or unclear failures.

## Product Principles

- Keep the default advisory and low-noise.
- Make safe setup the easiest setup.
- Prefer explicit rollout modes over hidden behavior changes.
- Explain why a finding fired and how to resolve it.
- Give maintainers tuning tools before enforcement tools.
- Treat contributor-facing text as product UI, not raw diagnostics.
- Keep secret redaction and untrusted-code safety as non-negotiable constraints.
- Make every new surface measurable through outputs, JSON, or summary data.

## Current Strengths

- The quick start is copy-pasteable and uses minimal GitHub permissions.
- The action avoids checking out pull request code, which keeps fork PR usage safer.
- The report is concise and contributor-friendly.
- `dry-run`, `comment.postWhen`, `report-json-path`, `write-step-summary`, and `emit-annotations` already provide multiple rollout surfaces.
- The schema gives editor completion and guards invalid configuration shapes at runtime.
- Examples already cover quiet and strict configurations.
- The roadmap correctly avoids AI-detection framing and automatic rejection.

## Main Experience Gaps

| Stage | Gap | Impact |
| --- | --- | --- |
| Evaluation | Maintainers do not yet have a clear "should I use this?" decision guide. | Users may bounce before installing or install with the wrong expectations. |
| Installation | README mixes quick start, safety notes, inputs, config, and release info in one long page. | First-time users can miss important permission or rollout details. |
| Mode selection | Users must combine `dry-run`, `labeling.enabled`, `comment.postWhen`, annotations, summaries, and JSON manually. | More setup errors and inconsistent rollout patterns. |
| First run | There is no dedicated "what to look at after the first run" checklist. | Users may not know whether findings are expected, noisy, or misconfigured. |
| Config tuning | Schema, exact finding-ID policy, surfaced diagnostics, and redacted effective-config output now exist. | Complex org configs still need real pilot feedback before central policy support. |
| Report explainability | Stable IDs and rule docs now exist, but project-specific guidance links are still not attached to individual findings. | Contributors may still need template examples for some project-specific cases. |
| Contributor UX | Next steps are good, but not yet linked to project-specific examples or accepted evidence patterns. | Contributors may still ask what counts as enough information. |
| Long-term operations | JSON output exists, but no documented metrics workflow or dashboard path exists. | Teams cannot easily measure noise reduction or false positives. |
| Organization scale | Roadmap mentions GitHub App packaging, but no adoption model is documented. | Larger teams lack a clear path from one repo to many repos. |

## User Journey Improvements

### 1. Pre-Install Evaluation

Create a focused evaluation path before the quick start.

Recommended artifacts:

- `docs/INSTALLATION.md`: focused setup guide separate from README.
- `docs/ROLLOUT_PLAYBOOK.md`: choose between audit, advisory, collaborative, and strict operation.
- README decision block: "Use this if..." and "Do not use this if...".
- Visual example of one issue report and one pull request report.
- Security model summary near the quick start, not only in architecture docs.

Acceptance criteria:

- A maintainer can identify the correct mode before copying YAML.
- The docs state clearly that the action does not detect AI usage, does not auto-close issues, and does not replace maintainer judgment.
- The fork PR safety model is visible before the user sees `pull_request_target`.

### 2. Installation and First Run

Reduce the number of decisions required for the first successful run.

Recommended product changes:

- Add workflow examples for named rollout modes:
  - `examples/workflow.audit.yml`: read-only, dry-run, step summary only.
  - `examples/workflow.advisory.yml`: comments on findings, labels disabled.
  - `examples/workflow.collaborative.yml`: comments plus labels, no workflow failure.
  - `examples/workflow.strict.yml`: labels plus `fail-on-findings` for teams that explicitly want enforcement.
- Add config examples by repository type:
  - library/package
  - CLI/tooling
  - web application
  - security-sensitive repository
- Add a first-run checklist:
  - confirm event type
  - confirm permissions
  - confirm dry-run behavior
  - inspect step summary
  - inspect suggested labels
  - inspect skipped automation authors
  - decide whether to enable comments, labels, annotations, or JSON

Possible code changes:

- Add an optional `mode` input with values such as `audit`, `advisory`, `collaborative`, and `strict`.
- Keep existing low-level inputs available, but let `mode` set safe defaults unless explicitly overridden.
- Add a `setup-summary` section to the step summary that shows active surfaces: comments, labels, annotations, JSON, AI, dry-run, fail-on-findings.

Acceptance criteria:

- A first-time user can install with one workflow file and zero custom config.
- The first run tells the user exactly what it did and did not write.
- The action warns when a risky setup is detected, for example `pull_request_target` with broad permissions and unexpected checkout steps cannot be detected reliably by this action, so the docs must clearly cover that boundary.

### 3. Configuration Tuning

Make configuration understandable after installation.

Recommended product changes:

- Keep the effective configuration JSON useful and redacted as new config fields are added.
- Add a `diagnostics` or `config-report` input that writes:
  - loaded config path
  - unknown keys ignored or rejected
  - defaulted values
  - enabled checks
  - label names
  - comment policy
  - AI status and timeout settings, excluding secrets
- Add stable finding IDs to report comments and annotations.
- Add `docs/RULES.md` with each finding ID, trigger condition, default severity, label, and tuning knobs.
- Add suppression controls:
  - ignore by finding ID (implemented as `rules.disabled`)
  - ignore by label
  - ignore by path pattern for PR checks
  - downgrade severity by finding ID (implemented as `rules.severityOverrides.notice`)

Acceptance criteria:

- A maintainer can answer "why did this fire?" without reading TypeScript source.
- A false positive can be silenced or downgraded with a documented config key.
- Invalid config produces a warning that includes the exact path and expected shape.

### 4. Contributor-Facing Report UX

Improve the report as a product surface.

Recommended product changes:

- Add stable finding IDs to the table, for example `pr.missing_tests`.
- Add optional links to relevant project guidance sections when guidance files are loaded.
- Separate "required next step" from "optional improvement" in next steps.
- Include a compact "what already looks good" section only when it adds signal.
- Add report snapshots to docs so maintainers understand the contributor view before installing.
- Keep comments updated in place and avoid posting clean reports unless explicitly configured.

Acceptance criteria:

- A contributor can fix a finding without asking what the report means.
- The report remains compact for common cases.
- Reports do not expose secrets, large pasted content, or raw model output.

### 5. Maintainer Daily Workflow

Improve the action for repeat use after the first week.

Recommended product changes:

- Add optional maintainer-only summary metadata:
  - changed files count
  - detected test files count
  - matched CODEOWNERS entries
  - duplicate candidates inspected
  - applied labels and removed stale labels
- Keep the `report-json-path` metrics example aligned with the JSON report contract.
- Add documented label strategy:
  - suggested labels
  - managed labels
  - stale label removal
  - skip labels
  - security review labels
- Add a "calibration week" playbook: run quiet mode for one week, review JSON reports, then enable comments or labels.

Acceptance criteria:

- Maintainers can see what happened in one step summary without opening logs.
- JSON reports can be used by a downstream workflow without reverse-engineering the payload.
- Label behavior is predictable and documented before labels are enabled.

### 6. Metrics and Long-Term Experience

Turn the action from a one-off gate into an operational tool.

Recommended product changes:

- Add a metrics JSON artifact option with aggregate fields:
  - issue versus PR count
  - finding counts by ID and severity
  - outcome distribution
  - labels suggested and applied
  - skipped count and skip reasons
  - AI enabled/disabled count
- Document a GitHub Actions workflow that appends metrics to an artifact or dashboard.
- Add maintainer feedback labels:
  - `firewall-useful`
  - `firewall-noisy`
  - `firewall-ignore`
- Add a feedback loop that can read those labels later and summarize likely noisy rules, without automatically changing policy.

Acceptance criteria:

- A team can measure whether the action reduces review friction.
- False positives can be tracked over time.
- No automatic learning changes repository policy without explicit maintainer config.

### 7. Organization-Scale Adoption

Prepare the product for teams managing many repositories.

Recommended product changes:

- Document a central-policy pattern using a shared config repository or GitHub App.
- Add config inheritance later, for example:
  - base policy URL
  - repository override file
  - merge strategy for arrays
- Add organization presets:
  - open source library
  - internal platform repository
  - security-sensitive repository
  - beginner-friendly community project
- Add migration docs from single repo to organization rollout.

Acceptance criteria:

- A team can pilot on one repo and scale to ten without rewriting policy.
- Per-repo overrides are explicit and reviewable.
- The action remains useful without requiring AI or a paid API key.

## Proposed Execution Plan

### Phase 0: Documentation-Only Upgrade

Goal: improve pre-install and first-run experience without changing runtime behavior.

Deliverables:

- `docs/INSTALLATION.md`
- `docs/ROLLOUT_PLAYBOOK.md`
- `docs/RULES.md`
- `docs/TROUBLESHOOTING.md`
- More workflow examples for audit, advisory, collaborative, and strict rollout.
- README shortened into a product overview plus links to focused docs.

Why first:

- Lowest risk.
- Immediately improves adoption.
- Gives a stable product language before adding code features.

### Phase 1: First-Run Clarity

Goal: make the first run self-explanatory.

Deliverables:

- Setup/effective-config section in step summary.
- Optional redacted effective-config JSON output. (implemented as `effective-config-json-path`)
- Structured diagnostics in JSON reports. (configuration warnings implemented)
- Warning copy improved for common mistakes.
- Tests for config diagnostics and summary output.

### Phase 2: Rule Explainability and Tuning

Goal: make every finding explainable and tunable.

Deliverables:

- Stable finding IDs in comments, annotations, summaries, and JSON.
- Rule documentation generated or kept in sync with source IDs.
- Config keys for suppressing or downgrading specific findings.
- Tests for finding ID stability.

### Phase 3: Presets and Modes

Goal: reduce install-time decision load.

Deliverables:

- Optional `mode` input or preset config files.
- Runtime summary of active mode and overridden settings.
- Docs mapping each mode to expected behavior.
- Backward compatibility tests for existing inputs.

### Phase 4: Metrics and Feedback Loop

Goal: help maintainers measure and tune long-term value.

Deliverables:

- Metrics-focused JSON output or artifact example.
- Feedback label strategy.
- Dashboard workflow example.
- Noise analysis report, advisory only.

### Phase 5: Organization Scale

Goal: support multi-repo adoption.

Deliverables:

- Central policy documentation.
- GitHub App packaging plan.
- Config inheritance design.
- Organization rollout checklist.

## Priority Recommendation

Build Phase 0 and Phase 1 next.

Reasoning:

- The strongest current gap is not missing detection power; it is onboarding and calibration clarity.
- Better docs and first-run summaries reduce support burden and prevent unsafe setup.
- Stable rule IDs and config diagnostics prepare the project for later suppression, metrics, and presets.
- Dashboard and organization-scale work should wait until the basic install/tune loop is easier.

## Suggested Next Engineering Batch

If this plan is approved, the next implementation batch should be:

1. Add focused docs:
   - `docs/INSTALLATION.md`
   - `docs/ROLLOUT_PLAYBOOK.md`
   - `docs/RULES.md`
   - `docs/TROUBLESHOOTING.md`
2. Add workflow examples:
   - `examples/workflow.audit.yml`
   - `examples/workflow.advisory.yml`
   - `examples/workflow.collaborative.yml`
   - `examples/workflow.strict.yml`
3. Refactor README into a shorter overview that points to those docs.
4. Add stable finding IDs to report comments and annotations.
5. Add a step-summary "setup state" block showing dry-run, comments, labels, annotations, JSON report, AI, and fail-on-findings status.

## Review Questions

Please review these product decisions before implementation:

1. Should the next batch stay documentation-first, or should it include stable finding IDs immediately?
2. Should rollout behavior be controlled by a new high-level `mode` input, or should we avoid another input and rely on preset workflow examples?
3. Should contributor-facing comments include finding IDs, or should IDs stay in JSON/annotations only to keep comments friendlier?
4. Which pilot repositories can provide enough JSON reports to justify a first-class metrics feature?

## Risks

- Adding too many modes can make behavior harder to predict.
- Showing finding IDs in comments can make reports feel more technical.
- Metrics can become a distraction if the basic setup path is still unclear.
- Suppression controls can hide real problems if they are too broad.
- GitHub App packaging is valuable but should not precede single-repo onboarding quality.

## Non-Goals For The Next Batch

- No automatic issue closing.
- No automatic pull request rejection.
- No AI-generated contributor scoring.
- No hidden policy changes based on feedback labels.
- No checkout of untrusted pull request code.
