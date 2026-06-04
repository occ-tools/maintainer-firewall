import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("metrics summary script", () => {
  it("aggregates report JSON files and ignores non-report JSON", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "maintainer-firewall-metrics-"));

    try {
      await writeFile(join(tempDir, "one.json"), `\uFEFF${JSON.stringify({
        version: 1,
        skipped: false,
        summary: {
          outcome: "needs_tests"
        },
        findings: [
          {
            id: "pr.tests.missing",
            severity: "warning",
            label: "needsTests"
          }
        ],
        diagnostics: {
          configWarnings: ["config warning"],
          runtimeWarnings: []
        }
      })}`, "utf8");
      await writeFile(join(tempDir, "two.json"), JSON.stringify({
        version: 1,
        skipped: true,
        findings: [],
        diagnostics: {
          runtimeWarnings: ["runtime warning"]
        }
      }), "utf8");
      await writeFile(join(tempDir, "effective-config.json"), JSON.stringify({
        version: 1,
        enabledChecks: {}
      }), "utf8");

      const { stdout } = await execFileAsync("node", ["scripts/summarize-metrics.mjs", tempDir], {
        cwd: process.cwd()
      });
      const summary = JSON.parse(stdout);

      expect(summary).toMatchObject({
        reports: 2,
        skipped: 1,
        outcomes: {
          needs_tests: 1,
          skipped: 1
        },
        findingsById: {
          "pr.tests.missing": 1
        },
        findingsBySeverity: {
          warning: 1
        },
        labels: {
          needsTests: 1
        },
        configWarnings: 1,
        runtimeWarnings: 1
      });
      expect(summary.ignoredFiles).toContain(join(tempDir, "effective-config.json"));
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails when JSON files exist but none are report payloads", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "maintainer-firewall-metrics-empty-"));

    try {
      await writeFile(join(tempDir, "effective-config.json"), JSON.stringify({
        version: 1,
        enabledChecks: {}
      }), "utf8");

      await expect(execFileAsync("node", ["scripts/summarize-metrics.mjs", tempDir], {
        cwd: process.cwd()
      })).rejects.toMatchObject({
        stdout: expect.stringContaining('"reports": 0'),
        stderr: expect.stringContaining("No valid Maintainer Firewall report JSON files found.")
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
