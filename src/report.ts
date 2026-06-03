import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RunDiagnostics } from "./run-diagnostics.js";
import type { Finding, FirewallConfig, ReviewSummary, Subject } from "./types.js";
import { redactByPatterns, redactFinding, redactReviewSummary } from "./redaction.js";

type DiagnosticsInput = Partial<RunDiagnostics> | string[];

export interface ReportPayload {
  version: 1;
  skipped: boolean;
  skipReason?: string;
  subject?: {
    kind: Subject["kind"];
    number: number;
    title: string;
    author: string;
    url: string;
    labels: string[];
    changedFiles?: Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
    }>;
  };
  summary?: ReviewSummary;
  findings: Finding[];
  diagnostics?: {
    configWarnings?: string[];
    runtimeWarnings?: string[];
  };
}

export function createReportPayload(
  subject: Subject | null,
  findings: Finding[],
  summary: ReviewSummary | null,
  config: FirewallConfig,
  skipReason?: string,
  diagnostics: DiagnosticsInput = {}
): ReportPayload {
  const safeDiagnostics = sanitizeDiagnostics(diagnostics, config);
  return {
    version: 1,
    skipped: Boolean(skipReason),
    skipReason,
    subject: subject ? sanitizeSubject(subject, config) : undefined,
    summary: summary ? redactReviewSummary(summary, config.security.secretPatterns) : undefined,
    findings: findings.map((finding) => redactFinding(finding, config.security.secretPatterns)),
    diagnostics: safeDiagnostics
  };
}

export async function writeReportJson(path: string, payload: ReportPayload): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function sanitizeSubject(subject: Subject, config: FirewallConfig): NonNullable<ReportPayload["subject"]> {
  const base = {
    kind: subject.kind,
    number: subject.number,
    title: redactByPatterns(subject.title, config.security.secretPatterns),
    author: subject.author,
    url: subject.htmlUrl,
    labels: subject.labels
  };

  if (subject.kind === "issue") {
    return base;
  }

  return {
    ...base,
    changedFiles: subject.changedFiles.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions
    }))
  };
}

function sanitizeDiagnostics(
  diagnostics: DiagnosticsInput,
  config: FirewallConfig
): ReportPayload["diagnostics"] {
  const normalized = Array.isArray(diagnostics)
    ? { configWarnings: diagnostics, runtimeWarnings: [] }
    : diagnostics;
  const configWarnings = (normalized.configWarnings ?? []).map((warning) =>
    redactByPatterns(warning, config.security.secretPatterns)
  );
  const runtimeWarnings = (normalized.runtimeWarnings ?? []).map((warning) =>
    redactByPatterns(warning, config.security.secretPatterns)
  );

  if (configWarnings.length === 0 && runtimeWarnings.length === 0) {
    return undefined;
  }

  return {
    ...(configWarnings.length > 0 ? { configWarnings } : {}),
    ...(runtimeWarnings.length > 0 ? { runtimeWarnings } : {})
  };
}
