import { describe, expect, it } from "vitest";
import { redactByPatterns, redactFinding, redactReviewSummary } from "../src/redaction.js";
import type { Finding, ReviewSummary } from "../src/types.js";

describe("redactByPatterns", () => {
  it("redacts configured secret-like patterns", () => {
    const text = "token sk-abc12345678901234567890 should not leave";

    expect(redactByPatterns(text, ["\\bsk-[A-Za-z0-9_-]{20,}\\b"])).toBe("token [redacted] should not leave");
  });

  it("ignores invalid patterns", () => {
    expect(redactByPatterns("hello", ["["])).toBe("hello");
  });

  it("redacts finding fields", () => {
    const finding: Finding = {
      id: "ai.secret.sk-abc12345678901234567890",
      severity: "warning",
      title: "Token sk-abc12345678901234567890",
      details: "Details mention sk-abc12345678901234567890",
      suggestion: "Rotate sk-abc12345678901234567890",
      label: "securityReview",
      source: "ai"
    };

    expect(redactFinding(finding, ["\\bsk-[A-Za-z0-9_-]{20,}\\b"])).toEqual({
      ...finding,
      id: "ai.secret.[redacted]",
      title: "Token [redacted]",
      details: "Details mention [redacted]",
      suggestion: "Rotate [redacted]"
    });
  });

  it("redacts review summary fields", () => {
    const summary: ReviewSummary = {
      score: 70,
      outcome: "needs_maintainer_review",
      headline: "Token sk-abc12345678901234567890 appears",
      nextSteps: ["Rotate sk-abc12345678901234567890"],
      passedChecks: ["No sk-abc12345678901234567890 in checks"],
      labels: ["security-review"],
      routingHints: [
        {
          owner: "@security",
          files: ["src/sk-abc12345678901234567890.ts"]
        }
      ]
    };

    const redacted = redactReviewSummary(summary, ["\\bsk-[A-Za-z0-9_-]{20,}\\b"]);

    expect(JSON.stringify(redacted)).not.toContain("sk-abc12345678901234567890");
    expect(redacted.headline).toBe("Token [redacted] appears");
    expect(redacted.nextSteps).toEqual(["Rotate [redacted]"]);
    expect(redacted.routingHints[0]?.files).toEqual(["src/[redacted].ts"]);
  });
});
