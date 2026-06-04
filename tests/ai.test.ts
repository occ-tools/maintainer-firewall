import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWithAi } from "../src/ai.js";
import { defaultConfig } from "../src/config.js";
import type { IssueSubject, PullRequestSubject } from "../src/types.js";

const subject: IssueSubject = {
  kind: "issue",
  number: 17,
  title: "Crash on startup",
  body: "The app crashes on startup with version 1.2.3.",
  author: "reporter",
  labels: [],
  htmlUrl: "https://github.com/example/repo/issues/17",
  duplicateCandidates: []
};

const pullRequestSubject: PullRequestSubject = {
  kind: "pull_request",
  number: 42,
  title: "Improve cache handling",
  body: "Fixes #41 and includes a test plan.",
  author: "contributor",
  labels: [],
  htmlUrl: "https://github.com/example/repo/pull/42",
  draft: false,
  baseRef: "main",
  headRef: "cache",
  changedFiles: [
    {
      filename: "src/cache.ts",
      status: "modified",
      additions: 20,
      deletions: 4,
      changes: 24
    }
  ]
};

describe("analyzeWithAi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes long multiline AI findings before returning them", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          findings: [
            {
              id: `ai.custom.${"x".repeat(120)}`,
              severity: "warning",
              title: `Missing context\n${"title ".repeat(40)}`,
              details: `Line one\n${"details ".repeat(120)}`,
              suggestion: `Please add context\n${"suggestion ".repeat(60)}`,
              label: "needsInfo"
            }
          ]
        })
      })
    }));

    const findings = await analyzeWithAi(subject, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, "test-key");

    expect(findings).toHaveLength(1);
    const [finding] = findings;
    expect(finding?.id.length).toBeLessThanOrEqual(80);
    expect(finding?.id).toMatch(/^ai\.[a-z0-9._-]+$/);
    expect(finding?.title.length).toBeLessThanOrEqual(120);
    expect(finding?.details.length).toBeLessThanOrEqual(600);
    expect(finding?.suggestion?.length).toBeLessThanOrEqual(240);
    expect(finding?.title).not.toContain("\n");
    expect(finding?.details).not.toContain("\n");
    expect(finding?.suggestion).not.toContain("\n");
    expect(finding).toMatchObject({
      severity: "warning",
      label: "needsInfo",
      source: "ai"
    });
  });

  it("normalizes missing or unprefixed AI finding IDs into stable policy IDs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          findings: [
            {
              id: "Needs Context / Missing Repro",
              severity: "warning",
              title: "Missing reproduction",
              details: "The issue does not include enough reproduction context.",
              suggestion: "Add exact steps.",
              label: "needsInfo"
            },
            {
              id: {},
              severity: "notice",
              title: "Missing environment",
              details: "The issue does not include version details.",
              suggestion: "Add versions.",
              label: "needsInfo"
            }
          ]
        })
      })
    }));

    const findings = await analyzeWithAi(subject, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, "test-key");

    expect(findings.map((finding) => finding.id)).toEqual([
      "ai.needs.context.missing.repro",
      "ai.finding.2"
    ]);
  });

  it("drops malformed AI findings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          findings: [
            {
              severity: "critical",
              title: "Invalid severity",
              details: "Should be ignored.",
              suggestion: "Ignore.",
              label: "needsInfo"
            },
            {
              severity: "notice",
              title: "Invalid label",
              details: "Should be ignored.",
              suggestion: "Ignore.",
              label: "unknown"
            }
          ]
        })
      })
    }));

    await expect(analyzeWithAi(subject, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, "test-key")).resolves.toEqual([]);
  });

  it("drops non-object and empty AI findings while keeping valid findings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          findings: [
            null,
            "not an object",
            {
              id: "empty-title",
              severity: "notice",
              title: "",
              details: "Details",
              suggestion: "Suggestion",
              label: "needsInfo"
            },
            {
              id: "usable-finding",
              severity: "notice",
              title: "Usable finding",
              details: "This one has enough structure.",
              suggestion: "",
              label: "maintainerReview"
            }
          ]
        })
      })
    }));

    const findings = await analyzeWithAi(subject, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, "test-key");

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      id: "ai.usable-finding",
      label: "maintainerReview"
    });
  });

  it("accepts Responses API output content chunks and summarizes pull requests", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  findings: [
                    {
                      id: "ai.cache.review",
                      severity: "notice",
                      title: "Review cache owner",
                      details: "The change touches cache behavior.",
                      suggestion: "Route this to the cache maintainer.",
                      label: "maintainerReview"
                    }
                  ]
                })
              }
            ]
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetch);

    const findings = await analyzeWithAi(pullRequestSubject, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, "test-key");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.id).toBe("ai.cache.review");
    const requestBody = JSON.stringify(fetch.mock.calls[0]?.[1]);
    expect(requestBody).toContain("pull_request");
    expect(requestBody).toContain("src/cache.ts");
    expect(requestBody).toContain("baseRef");
  });

  it("does not call OpenAI when AI is disabled or no key is provided", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(analyzeWithAi(subject, defaultConfig, "test-key")).resolves.toEqual([]);
    await expect(analyzeWithAi(subject, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, undefined)).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back cleanly when OpenAI returns an HTTP error", async () => {
    const warnings: string[] = [];
    const secret = "sk-abc12345678901234567890";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => `rate limited ${secret}\n${"details ".repeat(80)}`
    }));

    await expect(analyzeWithAi(subject, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, "test-key", [], (warning) => warnings.push(warning))).resolves.toEqual([]);
    expect(warnings[0]).toContain("OpenAI analysis failed with HTTP 429: rate limited [redacted]");
    expect(warnings[0]).not.toContain(secret);
    expect(warnings[0]?.length).toBeLessThanOrEqual(340);
  });

  it("falls back cleanly when OpenAI returns no text output", async () => {
    const warnings: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output: [] })
    }));

    await expect(analyzeWithAi(subject, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, "test-key", [], (warning) => warnings.push(warning))).resolves.toEqual([]);
    expect(warnings).toEqual(["OpenAI analysis returned no text output."]);
  });

  it("falls back cleanly when OpenAI returns invalid JSON", async () => {
    const warnings: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: "not-json" })
    }));

    await expect(analyzeWithAi(subject, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, "test-key", [], (warning) => warnings.push(warning))).resolves.toEqual([]);
    expect(warnings[0]).toContain("OpenAI analysis failed:");
  });

  it("returns no AI findings when the parsed findings field is absent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: JSON.stringify({}) })
    }));

    await expect(analyzeWithAi(subject, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, "test-key")).resolves.toEqual([]);
  });

  it("redacts subject and guidance content before sending the prompt", async () => {
    const secret = "sk-abc12345678901234567890";
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({ findings: [] })
      })
    });
    vi.stubGlobal("fetch", fetch);

    await analyzeWithAi({
      ...subject,
      body: `The logs contain ${secret}.`
    }, {
      ...defaultConfig,
      ai: {
        ...defaultConfig.ai,
        enabled: true
      }
    }, "test-key", [
      {
        path: "CONTRIBUTING.md",
        content: `Do not paste ${secret}.`
      }
    ]);

    const requestBody = JSON.stringify(fetch.mock.calls[0]?.[1]);
    expect(requestBody).not.toContain(secret);
    expect(requestBody).toContain("[redacted]");
  });
});
