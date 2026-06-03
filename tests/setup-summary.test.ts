import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { composeSetupSummary, composeStepSummary } from "../src/setup-summary.js";

describe("composeSetupSummary", () => {
  it("renders the active rollout surfaces without secrets", () => {
    const summary = composeSetupSummary({
      config: {
        ...defaultConfig,
        rules: {
          disabled: ["issue.environment.missing"],
          severityOverrides: {
            notice: ["pr.tests.missing"],
            warning: [],
            error: []
          }
        },
        ai: {
          ...defaultConfig.ai,
          enabled: true
        }
      },
      configPath: ".maintainer-firewall.yml",
      configWarnings: [
        "config.rules.disabled[0] should be a string; using the default value for config.rules.disabled."
      ],
      runtimeWarnings: [
        "Could not upsert comment: Resource not accessible by integration."
      ],
      dryRun: true,
      emitAnnotations: true,
      failOnFindings: false,
      openAiApiKeyProvided: false,
      reportJsonPath: "reports/firewall.json",
      subjectKind: "pull_request"
    });

    expect(summary).toContain("## Maintainer Firewall setup");
    expect(summary).toContain("| Subject | Pull request |");
    expect(summary).toContain("Dry run; no labels, comments, or stale-label removals are written");
    expect(summary).toContain("writes suppressed by dry-run");
    expect(summary).toContain("| Annotations | Enabled |");
    expect(summary).toContain("| JSON report | reports/firewall.json |");
    expect(summary).toContain("| Rule policy | 1 disabled; 1 severity override |");
    expect(summary).toContain("| Configuration warnings | 1 |");
    expect(summary).toContain("| Runtime warnings | 1 |");
    expect(summary).toContain("### Configuration warnings");
    expect(summary).toContain("config.rules.disabled[0] should be a string");
    expect(summary).toContain("### Runtime warnings");
    expect(summary).toContain("Could not upsert comment");
    expect(summary).toContain("Configured, but no API key was provided");
    expect(summary).not.toContain("OPENAI_API_KEY");
  });

  it("combines setup state with the normal report for step summaries", () => {
    expect(composeStepSummary("setup", "report")).toBe("setup\n\nreport");
  });
});
