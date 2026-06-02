import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { composeSetupSummary, composeStepSummary } from "../src/setup-summary.js";

describe("composeSetupSummary", () => {
  it("renders the active rollout surfaces without secrets", () => {
    const summary = composeSetupSummary({
      config: {
        ...defaultConfig,
        ai: {
          ...defaultConfig.ai,
          enabled: true
        }
      },
      configPath: ".maintainer-firewall.yml",
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
    expect(summary).toContain("Configured, but no API key was provided");
    expect(summary).not.toContain("OPENAI_API_KEY");
  });

  it("combines setup state with the normal report for step summaries", () => {
    expect(composeStepSummary("setup", "report")).toBe("setup\n\nreport");
  });
});
