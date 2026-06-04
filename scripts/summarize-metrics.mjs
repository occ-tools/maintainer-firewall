import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const inputs = process.argv.slice(2);

if (inputs.length === 0) {
  console.error("Usage: node scripts/summarize-metrics.mjs <report-json-file-or-directory> [...]");
  process.exitCode = 2;
} else {
  const files = inputs.flatMap((input) => collectJsonFiles(input));
  if (files.length === 0) {
    console.error("No JSON report files found.");
    process.exitCode = 2;
  } else {
    const summary = summarizeReports(files);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.reports === 0) {
      console.error("No valid Maintainer Firewall report JSON files found.");
      process.exitCode = 1;
    }
  }
}

export function summarizeReports(files) {
  const summary = {
    reports: 0,
    skipped: 0,
    outcomes: {},
    findingsById: {},
    findingsBySeverity: {},
    labels: {},
    configWarnings: 0,
    runtimeWarnings: 0,
    ignoredFiles: []
  };

  for (const file of files) {
    const payload = readJson(file);
    if (!isReportPayload(payload)) {
      summary.ignoredFiles.push(file);
      continue;
    }

    summary.reports += 1;
    if (payload.skipped) {
      summary.skipped += 1;
    }

    increment(summary.outcomes, payload.summary?.outcome ?? (payload.skipped ? "skipped" : "unknown"));
    for (const finding of payload.findings) {
      increment(summary.findingsById, finding.id);
      increment(summary.findingsBySeverity, finding.severity);
      if (finding.label) {
        increment(summary.labels, finding.label);
      }
    }

    summary.configWarnings += payload.diagnostics?.configWarnings?.length ?? 0;
    summary.runtimeWarnings += payload.diagnostics?.runtimeWarnings?.length ?? 0;
  }

  return summary;
}

function collectJsonFiles(input) {
  const status = statSync(input, { throwIfNoEntry: false });
  if (!status) {
    return [];
  }

  if (status.isFile()) {
    return input.endsWith(".json") ? [input] : [];
  }

  if (!status.isDirectory()) {
    return [];
  }

  const output = [];
  for (const entry of readdirSync(input)) {
    output.push(...collectJsonFiles(join(input, entry)));
  }

  return output;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function isReportPayload(payload) {
  return Boolean(
    payload &&
    payload.version === 1 &&
    typeof payload.skipped === "boolean" &&
    Array.isArray(payload.findings)
  );
}

function increment(record, key) {
  record[key] = (record[key] ?? 0) + 1;
}
