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
const marketplaceReadiness = readFileSync("docs/MARKETPLACE_READINESS.md", "utf8");
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
