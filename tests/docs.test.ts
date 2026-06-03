import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("project documentation", () => {
  it("does not list shipped report surfaces as near-term roadmap work", () => {
    const roadmap = readFileSync("ROADMAP.md", "utf8");
    const nearTerm = sectionBetween(roadmap, "## Near Term", "## Later");

    expect(nearTerm).not.toContain("CODEOWNERS-aware routing hints");
    expect(nearTerm).not.toContain("step-summary output");
  });

  it("documents runtime resilience in the architecture guide", () => {
    const architecture = readFileSync("docs/ARCHITECTURE.md", "utf8");

    expect(architecture).toContain("degrade to warnings");
    expect(architecture).toContain("shared redaction helpers");
  });

  it("links focused onboarding docs from the README", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("docs/INSTALLATION.md");
    expect(readme).toContain("docs/ROLLOUT_PLAYBOOK.md");
    expect(readme).toContain("docs/RULES.md");
    expect(readme).toContain("docs/TROUBLESHOOTING.md");
  });

  it("keeps rollout workflow examples on the current release tag", () => {
    for (const path of [
      "examples/workflow.audit.yml",
      "examples/workflow.advisory.yml",
      "examples/workflow.collaborative.yml",
      "examples/workflow.strict.yml"
    ]) {
      expect(readFileSync(path, "utf8")).toContain("wangjiehu/maintainer-firewall@v0.6.0");
    }
  });
});

function sectionBetween(markdown: string, start: string, end: string): string {
  const startIndex = markdown.indexOf(start);
  const endIndex = markdown.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return markdown.slice(startIndex, endIndex);
}
