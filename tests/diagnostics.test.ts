import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { validateConfig } from "../src/diagnostics.js";

describe("validateConfig", () => {
  it("accepts the default config without diagnostics", () => {
    expect(validateConfig(defaultConfig)).toEqual([]);
  });

  it("warns about invalid regex patterns", () => {
    const warnings = validateConfig({
      ...defaultConfig,
      security: {
        ...defaultConfig.security,
        secretPatterns: ["["]
      }
    });

    expect(warnings.some((warning) => warning.includes("security.secretPatterns"))).toBe(true);
  });

  it("warns about unsafe configured regex patterns", () => {
    const warnings = validateConfig({
      ...defaultConfig,
      security: {
        ...defaultConfig.security,
        reportPatterns: [unsafeNestedQuantifierPattern()]
      }
    });

    expect(warnings).toContain("security.reportPatterns[0] contains a potentially unsafe regular expression and will be ignored.");
  });

  it("warns about duplicate configured labels", () => {
    const warnings = validateConfig({
      ...defaultConfig,
      labels: {
        ...defaultConfig.labels,
        needsTests: defaultConfig.labels.needsInfo
      }
    });

    expect(warnings.some((warning) => warning.includes(defaultConfig.labels.needsInfo))).toBe(true);
  });

  it("warns about conflicting rule policy settings", () => {
    const warnings = validateConfig({
      ...defaultConfig,
      rules: {
        disabled: ["pr.tests.missing"],
        severityOverrides: {
          notice: ["pr.tests.missing", "issue.environment.missing"],
          warning: ["issue.environment.missing"],
          error: []
        }
      }
    });

    expect(warnings).toContain('rules.disabled includes "pr.tests.missing" and rules.severityOverrides also configures it; disabled wins.');
    expect(warnings).toContain('rules.severityOverrides configures "issue.environment.missing" more than once (notice, warning); strongest severity wins.');
  });

  it("warns when protected findings are suppressed or downgraded", () => {
    const warnings = validateConfig({
      ...defaultConfig,
      rules: {
        disabled: ["content.secret.possible"],
        severityOverrides: {
          notice: ["content.secret.possible"],
          warning: [],
          error: []
        }
      }
    });

    expect(warnings).toContain('rules.disabled cannot suppress protected finding "content.secret.possible"; it will still be reported.');
    expect(warnings).toContain('rules.severityOverrides cannot downgrade protected finding "content.secret.possible"; default severity remains error.');
  });
});

function unsafeNestedQuantifierPattern(): string {
  return ["(", "a", "+", ")", "+", "$"].join("");
}
