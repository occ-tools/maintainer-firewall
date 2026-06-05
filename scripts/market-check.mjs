import { readFileSync } from "node:fs";
import { parse } from "yaml";

const requiredFiles = [
  "action.yml",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "SUPPORT.md",
  "CHANGELOG.md",
  "docs/V1_CONTRACT.md",
  "docs/MARKETPLACE_READINESS.md",
  "docs/ADOPTION_PLAYBOOK.md",
  "docs/PILOT_RUNBOOK.md",
  "docs/EVALUATION.md",
  "docs/AI_DATA_BOUNDARY.md",
  "docs/METRICS.md",
  "schema/maintainer-firewall.schema.json",
  "dist/index.js"
];

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const readme = readFileSync("README.md", "utf8");
const metricsWorkflow = readFileSync("examples/workflow.metrics.yml", "utf8");
const maintenanceGuide = readFileSync("docs/MAINTENANCE.md", "utf8");
const marketplaceReadiness = readFileSync("docs/MARKETPLACE_READINESS.md", "utf8");
const releaseWorkflow = readFileSync(".github/workflows/release.yml", "utf8");
const vitestConfig = readFileSync("vitest.config.ts", "utf8");

for (const file of requiredFiles) {
  readFileSync(file, "utf8");
}

for (const file of [
  "examples/config.quiet.yml",
  "examples/config.strict.yml",
  "examples/config.library.yml",
  "examples/config.monorepo.yml",
  "examples/config.security-sensitive.yml",
  "examples/workflow.metrics.yml"
]) {
  parse(readFileSync(file, "utf8"));
}

for (const doc of [
  "docs/V1_CONTRACT.md",
  "docs/MARKETPLACE_READINESS.md",
  "docs/ADOPTION_PLAYBOOK.md",
  "docs/PILOT_RUNBOOK.md",
  "docs/EVALUATION.md",
  "docs/AI_DATA_BOUNDARY.md",
  "docs/METRICS.md"
]) {
  if (!readme.includes(doc)) {
    throw new Error(`README.md should link ${doc}`);
  }
}

if (!packageJson.scripts?.evaluate?.includes("scripts/evaluate.mjs")) {
  throw new Error("package.json should expose npm run evaluate.");
}

if (!packageJson.scripts?.["evaluate:ai"]?.includes("scripts/evaluate-ai.mjs")) {
  throw new Error("package.json should expose npm run evaluate:ai.");
}

if (!packageJson.scripts?.["metrics:summary"]?.includes("scripts/summarize-metrics.mjs")) {
  throw new Error("package.json should expose npm run metrics:summary.");
}

if (!packageJson.scripts?.["market:check"]?.includes("npm run ci")) {
  throw new Error("package.json market:check should include npm run ci so bundled dist verification cannot be skipped.");
}

if (!marketplaceReadiness.includes("GitHub Marketplace has repository-level listing requirements")) {
  throw new Error("docs/MARKETPLACE_READINESS.md should document the direct Marketplace listing caveat.");
}

if (metricsWorkflow.includes("actions/upload-artifact@v4")) {
  throw new Error("examples/workflow.metrics.yml should use the current upload-artifact major version.");
}

if (!metricsWorkflow.includes("actions/upload-artifact@v7")) {
  throw new Error("examples/workflow.metrics.yml should include the current upload-artifact example.");
}

for (const requiredReleaseWorkflowText of [
  "attestations: write",
  "actions/attest@59d89421af93a897026c735860bf21b6eb4f7b26",
  "release-assets/*.tgz"
]) {
  if (!releaseWorkflow.includes(requiredReleaseWorkflowText)) {
    throw new Error(`.github/workflows/release.yml should include ${requiredReleaseWorkflowText}.`);
  }
}

if (!maintenanceGuide.includes("gh attestation verify")) {
  throw new Error("docs/MAINTENANCE.md should document release asset attestation verification.");
}

if (!marketplaceReadiness.includes("GitHub artifact attestations")) {
  throw new Error("docs/MARKETPLACE_READINESS.md should include release attestation readiness.");
}

for (const fixture of [
  "fixtures/evaluation/clean-issue.json",
  "fixtures/evaluation/missing-tests-pr.json",
  "fixtures/evaluation/prompt-injection-ai-eligible.json",
  "fixtures/evaluation/possible-secret-skips-ai.json"
]) {
  JSON.parse(readFileSync(fixture, "utf8"));
}

const files = new Set(packageJson.files ?? []);
for (const entry of ["action.yml", "dist", "README.md", "LICENSE", "docs", "examples", "schema"]) {
  if (!files.has(entry)) {
    throw new Error(`package.json files should include ${entry}`);
  }
}

if (!vitestConfig.includes('"src/**/*.ts"')) {
  throw new Error("vitest.config.ts should include all source files in coverage.");
}

for (const excludedSource of ['"src/index.ts"', '"src/types.ts"']) {
  if (!vitestConfig.includes(excludedSource)) {
    throw new Error(`vitest.config.ts should explicitly document the ${excludedSource} coverage exclusion.`);
  }
}

console.log("Local market-readiness checks passed. Direct GitHub Marketplace listing still depends on repository-level listing requirements.");
