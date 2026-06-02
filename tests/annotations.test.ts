import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitFindingAnnotations } from "../src/annotations.js";
import { defaultConfig } from "../src/config.js";
import type { Finding } from "../src/types.js";

vi.mock("@actions/core", () => ({
  error: vi.fn(),
  notice: vi.fn(),
  warning: vi.fn()
}));

describe("emitFindingAnnotations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits findings using GitHub Actions annotation severities", () => {
    emitFindingAnnotations([
      finding("notice", "Notice finding"),
      finding("warning", "Warning finding"),
      finding("error", "Error finding")
    ], defaultConfig);

    expect(core.notice).toHaveBeenCalledWith(
      "[notice.finding] Notice finding: Details for Notice finding Suggested next step: Suggested action.",
      { title: "Maintainer Firewall: Notice finding (notice.finding)" }
    );
    expect(core.warning).toHaveBeenCalledWith(
      "[warning.finding] Warning finding: Details for Warning finding Suggested next step: Suggested action.",
      { title: "Maintainer Firewall: Warning finding (warning.finding)" }
    );
    expect(core.error).toHaveBeenCalledWith(
      "[error.finding] Error finding: Details for Error finding Suggested next step: Suggested action.",
      { title: "Maintainer Firewall: Error finding (error.finding)" }
    );
  });

  it("redacts configured secrets and compacts annotation text", () => {
    const secret = "sk-abc12345678901234567890";
    emitFindingAnnotations([
      {
        ...finding("warning", `Token ${secret}`),
        details: `Line one\nLine two ${secret}`,
        suggestion: `Rotate ${secret}`
      }
    ], defaultConfig);

    const [message, properties] = vi.mocked(core.warning).mock.calls[0] ?? [];

    expect(message).not.toContain(secret);
    expect(message).not.toContain("\n");
    expect(message).toContain("[redacted]");
    expect(properties).toEqual({ title: "Maintainer Firewall: Token [redacted] (token.[redacted])" });
  });

  it("truncates oversized annotation messages", () => {
    emitFindingAnnotations([
      {
        ...finding("warning", "Large finding"),
        details: "details ".repeat(300),
        suggestion: "suggestion ".repeat(100)
      }
    ], defaultConfig);

    const [message] = vi.mocked(core.warning).mock.calls[0] ?? [];

    expect(String(message).length).toBeLessThanOrEqual(1000);
    expect(message).toContain("...[truncated]");
  });
});

function finding(severity: Finding["severity"], title: string): Finding {
  return {
    id: title.toLowerCase().replace(/\s+/g, "."),
    severity,
    title,
    details: `Details for ${title}`,
    suggestion: "Suggested action.",
    label: "needsInfo",
    source: "rule"
  };
}
