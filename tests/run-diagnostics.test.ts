import * as core from "@actions/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../src/config.js";
import {
  createRunDiagnostics,
  createRuntimeWarningSink
} from "../src/run-diagnostics.js";

vi.mock("@actions/core", () => ({
  setOutput: vi.fn(),
  warning: vi.fn()
}));

describe("run diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redacts runtime warnings before logging or storing them", () => {
    const secret = "sk-abc12345678901234567890";
    const diagnostics = createRunDiagnostics(["config warning"]);
    const warn = createRuntimeWarningSink(diagnostics, defaultConfig);

    warn(`Could not apply labels: ${secret}`);

    expect(diagnostics.runtimeWarnings).toEqual(["Could not apply labels: [redacted]"]);
    expect(core.warning).toHaveBeenCalledWith("Could not apply labels: [redacted]");
  });
});
