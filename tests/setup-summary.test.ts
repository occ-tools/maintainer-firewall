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
      effectiveConfigJsonPath: "reports/effective-config.json",
      subjectKind: "pull_request"
    });

    expect(summary).toContain("## Maintainer Firewall setup");
    expect(summary).toContain("| Subject | Pull request |");
    expect(summary).toContain("Dry run; no labels, comments, or stale-label removals are written");
    expect(summary).toContain("writes suppressed by dry-run");
    expect(summary).toContain("| Annotations | Enabled |");
    expect(summary).toContain("| JSON report | reports/firewall.json |");
    expect(summary).toContain("| Effective config | reports/effective-config.json |");
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

  it("renders disabled surfaces and live failure policy without warning sections", () => {
    const summary = composeSetupSummary({
      config: {
        ...defaultConfig,
        comment: {
          ...defaultConfig.comment,
          enabled: false
        },
        labeling: {
          ...defaultConfig.labeling,
          enabled: false
        },
        ai: {
          ...defaultConfig.ai,
          enabled: true
        }
      },
      configPath: "configs\\firewall|prod\n.yml",
      configWarnings: [],
      dryRun: false,
      emitAnnotations: false,
      failOnFindings: true,
      openAiApiKeyProvided: true,
      reportJsonPath: "",
      subjectKind: null
    });

    expect(summary).toContain("| Subject | No handled issue or pull request |");
    expect(summary).toContain("| Config | configs\\\\firewall\\|prod .yml |");
    expect(summary).toContain("| Run mode | Live writes allowed |");
    expect(summary).toContain("| Comments | Disabled |");
    expect(summary).toContain("| Labels | Disabled |");
    expect(summary).toContain("| JSON report | Disabled |");
    expect(summary).toContain("| Rule policy | Default |");
    expect(summary).toContain("| AI analysis | Enabled; model=gpt-5-mini; timeoutMs=15000 |");
    expect(summary).toContain("| Failure policy | Fail on warning or error findings |");
    expect(summary).not.toContain("### Configuration warnings");
    expect(summary).not.toContain("### Runtime warnings");
  });

  it("compacts long warning lists in step summaries", () => {
    const summary = composeSetupSummary({
      config: defaultConfig,
      configPath: ".maintainer-firewall.yml",
      configWarnings: Array.from({ length: 11 }, (_, index) => `config warning ${index + 1}`),
      runtimeWarnings: Array.from({ length: 12 }, (_, index) => `runtime warning ${index + 1}`),
      dryRun: false,
      emitAnnotations: false,
      failOnFindings: false,
      openAiApiKeyProvided: false,
      reportJsonPath: "",
      subjectKind: "pull_request"
    });

    expect(summary).toContain("1 additional warning hidden.");
    expect(summary).toContain("2 additional warnings hidden.");
    expect(summary).not.toContain("config warning 11");
    expect(summary).not.toContain("runtime warning 12");
  });
});
