import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";
import { createReportPayload } from "../src/report.js";
import type { Finding, IssueSubject, ReviewSummary } from "../src/types.js";

describe("createReportPayload", () => {
  it("omits body content and redacts configured secrets from titles", () => {
    const subject: IssueSubject = {
      kind: "issue",
      number: 1,
      title: "Leaked sk-123456789012345678901234567890",
      body: "secret body should not be serialized",
      author: "reporter",
      labels: [],
      htmlUrl: "https://github.com/example/repo/issues/1",
      duplicateCandidates: []
    };

    const payload = createReportPayload(subject, [], null, defaultConfig);

    expect(JSON.stringify(payload)).not.toContain("secret body");
    expect(payload.subject?.title).toBe("Leaked [redacted]");
  });

  it("redacts configured secrets from findings and summary fields", () => {
    const secret = "sk-abc12345678901234567890";
    const subject: IssueSubject = {
      kind: "issue",
      number: 1,
      title: "Bug report",
      body: "body",
      author: "reporter",
      labels: [],
      htmlUrl: "https://github.com/example/repo/issues/1",
      duplicateCandidates: []
    };
    const findings: Finding[] = [
      {
        id: "ai.secret",
        severity: "warning",
        title: `Token ${secret}`,
        details: `Details mention ${secret}`,
        suggestion: `Rotate ${secret}`,
        label: "securityReview",
        source: "ai"
      }
    ];
    const summary: ReviewSummary = {
      score: 70,
      outcome: "needs_maintainer_review",
      headline: `Headline mentions ${secret}`,
      nextSteps: [`Next step mentions ${secret}`],
      passedChecks: [`Check mentions ${secret}`],
      labels: ["security-review"],
      routingHints: [
        {
          owner: "@security",
          files: [`src/${secret}.ts`]
        }
      ]
    };

    const payload = createReportPayload(subject, findings, summary, defaultConfig);
    const serialized = JSON.stringify(payload);

    expect(serialized).not.toContain(secret);
    expect(serialized).toContain("[redacted]");
  });

  it("includes redacted configuration diagnostics when present", () => {
    const secret = "sk-abc12345678901234567890";
    const subject: IssueSubject = {
      kind: "issue",
      number: 1,
      title: "Bug report",
      body: "body",
      author: "reporter",
      labels: [],
      htmlUrl: "https://github.com/example/repo/issues/1",
      duplicateCandidates: []
    };

    const payload = createReportPayload(subject, [], null, defaultConfig, undefined, {
      configWarnings: [
        `config.rules.disabled contains ${secret}`
      ],
      runtimeWarnings: [
        `Could not apply labels: ${secret}`
      ]
    });

    expect(payload.diagnostics?.configWarnings).toEqual(["config.rules.disabled contains [redacted]"]);
    expect(payload.diagnostics?.runtimeWarnings).toEqual(["Could not apply labels: [redacted]"]);
    expect(JSON.stringify(payload)).not.toContain(secret);
  });
});
