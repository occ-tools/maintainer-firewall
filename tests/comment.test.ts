import { describe, expect, it } from "vitest";
import {
  composeReport,
  composeSkippedReport,
  shouldPostComment,
  shouldPostSkippedComment,
  shouldRefreshExistingCleanReport
} from "../src/comment.js";
import { defaultConfig } from "../src/config.js";
import { createReviewSummary } from "../src/review.js";
import type { Finding, IssueSubject } from "../src/types.js";

const subject: IssueSubject = {
  kind: "issue",
  number: 9,
  title: "Crash on startup",
  body: "It crashes.",
  author: "contributor",
  labels: [],
  htmlUrl: "https://github.com/example/repo/issues/9",
  duplicateCandidates: []
};

describe("composeReport", () => {
  it("renders outcome, score, next steps, and details", () => {
    const findings: Finding[] = [
      {
        id: "issue.reproduction.missing",
        severity: "warning",
        title: "No clear reproduction details found",
        details: "No steps were found.",
        suggestion: "Request a minimal reproduction.",
        label: "needsInfo",
        source: "rule"
      }
    ];
    const summary = createReviewSummary(subject, findings, defaultConfig);

    const report = composeReport(subject, findings, defaultConfig, summary);

    expect(report).toContain("**Outcome:** Needs contributor info");
    expect(report).toContain("**Review readiness:** 82/100");
    expect(report).toContain("[Issue #9](https://github.com/example/repo/issues/9)");
    expect(report).toContain("### Next steps");
    expect(report).not.toContain("- [ ]");
    expect(report).toContain("<details>");
    expect(report).toContain("`needs-info`");
  });

  it("renders routing hints even when there are no findings", () => {
    const summary = {
      ...createReviewSummary(subject, [], defaultConfig),
      routingHints: [
        {
          owner: "@docs",
          files: ["README.md"]
        }
      ]
    };

    const report = composeReport(subject, [], defaultConfig, summary);

    expect(report).toContain("Routing hints:");
    expect(report).toContain("@docs: README.md");
  });
});

describe("composeSkippedReport", () => {
  it("renders a marked skipped report for existing comments", () => {
    const report = composeSkippedReport(subject, "label skip-firewall is ignored", defaultConfig);

    expect(report).toContain("<!-- maintainer-firewall:report -->");
    expect(report).toContain("Skipped issue #9: label skip-firewall is ignored.");
  });
});

describe("shouldPostComment", () => {
  it("posts only when findings exist by default", () => {
    expect(shouldPostComment(defaultConfig, [])).toBe(false);
    expect(shouldPostComment(defaultConfig, [
      {
        id: "issue.body.too_short",
        severity: "warning",
        title: "Issue body is short",
        details: "Missing context.",
        label: "needsInfo",
        source: "rule"
      }
    ])).toBe(true);
  });

  it("supports always and never modes", () => {
    expect(shouldPostComment({
      ...defaultConfig,
      comment: {
        ...defaultConfig.comment,
        postWhen: "always"
      }
    }, [])).toBe(true);

    expect(shouldPostComment({
      ...defaultConfig,
      comment: {
        ...defaultConfig.comment,
        postWhen: "never"
      }
    }, [
      {
        id: "issue.body.too_short",
        severity: "warning",
        title: "Issue body is short",
        details: "Missing context.",
        label: "needsInfo",
        source: "rule"
      }
    ])).toBe(false);
  });
});

describe("shouldPostSkippedComment", () => {
  it("refreshes skipped reports only when a report already exists by default", () => {
    expect(shouldPostSkippedComment(defaultConfig, false)).toBe(false);
    expect(shouldPostSkippedComment(defaultConfig, true)).toBe(true);
  });

  it("supports always and never modes for skipped reports", () => {
    expect(shouldPostSkippedComment({
      ...defaultConfig,
      comment: {
        ...defaultConfig.comment,
        postWhen: "always"
      }
    }, false)).toBe(true);

    expect(shouldPostSkippedComment({
      ...defaultConfig,
      comment: {
        ...defaultConfig.comment,
        postWhen: "never"
      }
    }, true)).toBe(false);
  });
});

describe("shouldRefreshExistingCleanReport", () => {
  it("refreshes only clean reports in findings mode", () => {
    expect(shouldRefreshExistingCleanReport(defaultConfig, [])).toBe(true);
    expect(shouldRefreshExistingCleanReport(defaultConfig, [
      {
        id: "issue.body.too_short",
        severity: "warning",
        title: "Issue body is short",
        details: "Missing context.",
        label: "needsInfo",
        source: "rule"
      }
    ])).toBe(false);
  });

  it("does not refresh comments in never mode", () => {
    expect(shouldRefreshExistingCleanReport({
      ...defaultConfig,
      comment: {
        ...defaultConfig.comment,
        postWhen: "never"
      }
    }, [])).toBe(false);
  });
});
