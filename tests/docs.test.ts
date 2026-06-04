import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

interface PackageJson {
  scripts: Record<string, string>;
}

interface IssueTemplateField {
  id?: string;
  attributes?: {
    description?: string;
    options?: string[];
    placeholder?: string;
  };
  validations?: {
    required?: boolean;
  };
}

interface IssueTemplate {
  body: IssueTemplateField[];
}

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
    expect(readme).toContain("docs/MAINTENANCE.md");
    expect(readme).toContain("docs/V1_CONTRACT.md");
    expect(readme).toContain("docs/MARKETPLACE_READINESS.md");
    expect(readme).toContain("docs/ADOPTION_PLAYBOOK.md");
    expect(readme).toContain("docs/PILOT_RUNBOOK.md");
    expect(readme).toContain("docs/EVALUATION.md");
    expect(readme).toContain("docs/AI_DATA_BOUNDARY.md");
    expect(readme).toContain("docs/METRICS.md");
  });

  it("keeps maintenance scripts wired into workflows and contributor docs", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
    const testWorkflow = readFileSync(".github/workflows/test.yml", "utf8");
    const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
    const readme = readFileSync("README.md", "utf8");
    const contributing = readFileSync("CONTRIBUTING.md", "utf8");
    const troubleshooting = readFileSync("docs/TROUBLESHOOTING.md", "utf8");
    const pullRequestTemplate = readFileSync(".github/pull_request_template.md", "utf8");
    const maintenance = readFileSync("docs/MAINTENANCE.md", "utf8");

    expect(packageJson.scripts.ci).toContain("npm run check");
    expect(packageJson.scripts.ci).toContain("npm run evaluate");
    expect(packageJson.scripts.ci).toContain("npm run verify:dist");
    expect(packageJson.scripts["release:check"]).toContain("npm run demo");
    expect(packageJson.scripts["release:check"]).toContain("npm run evaluate");
    expect(packageJson.scripts["release:check"]).toContain("npm run coverage");
    expect(packageJson.scripts["release:check"]).toContain("npm audit --audit-level=moderate");
    expect(packageJson.scripts["market:check"]).toContain("npm run ci");
    expect(packageJson.scripts["market:check"]).toContain("npm pack --dry-run");
    expect(packageJson.scripts["market:check"]).toContain("npm audit --audit-level=moderate");
    expect(packageJson.scripts["metrics:summary"]).toContain("scripts/summarize-metrics.mjs");
    expect(packageJson.scripts["market:check"]).toContain("scripts/market-check.mjs");

    expect(testWorkflow).toContain("npm run ci");
    expect(releaseWorkflow).toContain("npm run release:check");
    expect(readme).toContain("npm run ci");
    expect(contributing).toContain("docs/MAINTENANCE.md");
    expect(contributing).toContain("npm run ci");
    expect(troubleshooting).toContain("npm run ci");
    expect(pullRequestTemplate).toContain("New best-effort failures are surfaced through runtime diagnostics");
    expect(maintenance).toContain("Release Checklist");
    expect(maintenance).toContain("`npm run bundle`, then `npm run ci`");
    expect(maintenance).toContain("npm run market:check");
    expect(maintenance).toContain("npm run evaluate");
    expect(readFileSync("docs/METRICS.md", "utf8")).toContain("npm run metrics:summary");
  });

  it("keeps routine docs on canonical maintenance commands", () => {
    for (const path of ["README.md", "CONTRIBUTING.md"]) {
      const content = readFileSync(path, "utf8");

      expect(content).toContain("npm run ci");
      expect(content).not.toContain("npm run verify:dist");
    }
  });

  it("keeps updated workflow YAML parseable", () => {
    expect(() => parse(readFileSync(".github/workflows/test.yml", "utf8"))).not.toThrow();
    expect(() => parse(readFileSync(".github/workflows/release.yml", "utf8"))).not.toThrow();
    expect(() => parse(readFileSync(".github/workflows/codeql.yml", "utf8"))).not.toThrow();
    expect(() => parse(readFileSync(".github/workflows/scorecard.yml", "utf8"))).not.toThrow();
    expect(() => parse(readFileSync("examples/workflow.metrics.yml", "utf8"))).not.toThrow();
  });

  it("keeps marketplace preset configs parseable and linked", () => {
    const readme = readFileSync("README.md", "utf8");
    for (const path of [
      "examples/config.library.yml",
      "examples/config.monorepo.yml",
      "examples/config.security-sensitive.yml"
    ]) {
      expect(() => parse(readFileSync(path, "utf8"))).not.toThrow();
      expect(readme).toContain(path);
    }
  });

  it("keeps issue templates aligned with current support and maintenance surfaces", () => {
    const bugReport = parse(readFileSync(".github/ISSUE_TEMPLATE/bug_report.yml", "utf8")) as IssueTemplate;
    const featureRequest = parse(readFileSync(".github/ISSUE_TEMPLATE/feature_request.yml", "utf8")) as IssueTemplate;
    const support = readFileSync("SUPPORT.md", "utf8");

    const version = fieldById(bugReport, "version");
    const logs = fieldById(bugReport, "logs");
    const surface = fieldById(featureRequest, "surface");
    const tradeoffs = fieldById(featureRequest, "tradeoffs");

    expect(version.attributes?.placeholder).toContain("v0.6.0");
    expect(logs.attributes?.description).toContain("runtime warnings");
    expect(surface.attributes?.options).toContain("Maintenance or release workflow");
    expect(tradeoffs.validations?.required).toBe(true);
    expect(support).toContain("runtime warning outputs");
  });

  it("keeps rollout workflow examples on the current release tag", () => {
    for (const path of [
      "examples/workflow.audit.yml",
      "examples/workflow.advisory.yml",
      "examples/workflow.collaborative.yml",
      "examples/workflow.strict.yml",
      "examples/workflow.metrics.yml"
    ]) {
      expect(readFileSync(path, "utf8")).toContain("wangjiehu/maintainer-firewall@v0.6.0");
    }
  });

  it("keeps evaluation fixtures and docs wired to the evaluation command", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson;
    const evaluation = readFileSync("docs/EVALUATION.md", "utf8");

    expect(packageJson.scripts.evaluate).toContain("scripts/evaluate.mjs");
    expect(packageJson.scripts["evaluate:ai"]).toContain("scripts/evaluate-ai.mjs");
    expect(evaluation).toContain("fixtures/evaluation/");
    expect(evaluation).toContain("npm run evaluate");
    expect(evaluation).toContain("npm run evaluate:ai");
    for (const path of [
      "fixtures/evaluation/clean-issue.json",
      "fixtures/evaluation/missing-tests-pr.json",
      "fixtures/evaluation/prompt-injection-ai-eligible.json",
      "fixtures/evaluation/possible-secret-skips-ai.json"
    ]) {
      expect(() => JSON.parse(readFileSync(path, "utf8"))).not.toThrow();
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

function fieldById(template: IssueTemplate, id: string): IssueTemplateField {
  const field = template.body.find((item) => item.id === id);
  expect(field, `${id} should exist`).toBeDefined();
  return field as IssueTemplateField;
}
