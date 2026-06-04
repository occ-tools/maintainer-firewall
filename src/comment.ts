import type { Finding, FirewallConfig, ReviewSummary, Subject } from "./types.js";
import { redactByPatterns, redactFinding, redactReviewSummary } from "./redaction.js";
import { outcomeLabel } from "./review.js";

const MARKER = "<!-- maintainer-firewall:report -->";

export function composeReport(
  subject: Subject,
  findings: Finding[],
  config: FirewallConfig,
  summary: ReviewSummary
): string {
  const title = config.comment.header;
  const safeFindings = findings.map((finding) => redactFinding(finding, config.security.secretPatterns));
  const safeSummary = redactReviewSummary(summary, config.security.secretPatterns);
  const visibleFindings = safeFindings.slice(0, config.comment.maxFindings);
  const hiddenFindingCount = Math.max(0, safeFindings.length - visibleFindings.length);
  const lines = [
    MARKER,
    `## ${title}`,
    "",
    `**Outcome:** ${outcomeLabel(safeSummary.outcome)}`,
    `**Review readiness:** ${safeSummary.score}/100`,
    "",
    `Subject: [${subject.kind === "issue" ? "Issue" : "Pull request"} #${subject.number}](${subject.htmlUrl})`,
    "",
    safeSummary.headline,
    ""
  ];

  if (safeFindings.length === 0) {
    lines.push("No action is needed from this automated check.");
    appendPassedChecks(lines, config, safeSummary);
    appendRoutingHints(lines, safeSummary);
    lines.push("");
    lines.push("_Review readiness is an advisory triage score, not a judgment of contributor quality. Maintainer Firewall does not decide whether text was AI-generated._");
    return lines.join("\n");
  }

  lines.push("### Next steps");
  lines.push("");
  for (const step of safeSummary.nextSteps) {
    lines.push(`- ${step}`);
  }

  lines.push("");
  lines.push("<details>");
  lines.push(`<summary>${safeFindings.length} finding${safeFindings.length === 1 ? "" : "s"} from enabled checks</summary>`);
  lines.push("");
  lines.push("| Severity | Source / ID | Finding | Suggested next step |");
  lines.push("| --- | --- | --- | --- |");

  for (const finding of visibleFindings) {
    lines.push(
      `| ${finding.severity} | ${finding.source}<br>\`${escapeInlineCode(escapeTable(finding.id))}\` | ${escapeTable(`${finding.title}: ${finding.details}`)} | ${escapeTable(finding.suggestion ?? "Review manually.")} |`
    );
  }

  if (hiddenFindingCount > 0) {
    lines.push(`| notice | system | ${hiddenFindingCount} additional finding${hiddenFindingCount === 1 ? "" : "s"} hidden by comment.maxFindings. | Increase comment.maxFindings to show more. |`);
  }

  lines.push("");
  lines.push("</details>");

  appendPassedChecks(lines, config, safeSummary);

  appendRoutingHints(lines, safeSummary);

  lines.push("");
  if (safeSummary.labels.length > 0) {
    lines.push("Suggested labels:");
    lines.push(safeSummary.labels.map((label) => `- \`${label}\``).join("\n"));
  }

  lines.push("");
  lines.push("_Review readiness is an advisory triage score, not a judgment of contributor quality. Maintainer Firewall does not decide whether text was AI-generated._");

  return lines.join("\n");
}

export function composeSkippedReport(subject: Subject | null, skipReason: string, config: FirewallConfig): string {
  const safeSkipReason = escapeMarkdownLine(redactByPatterns(skipReason, config.security.secretPatterns));
  const lines = [
    MARKER,
    `## ${config.comment.header}`,
    "",
    subject
      ? `Skipped ${subject.kind === "issue" ? "issue" : "pull request"} #${subject.number}: ${safeSkipReason}.`
      : `Skipped: ${safeSkipReason}.`,
    "",
    "_Maintainer Firewall skipped this subject because an ignore rule matched._"
  ];

  return lines.join("\n");
}

export function shouldFail(findings: Finding[]): boolean {
  return findings.some((finding) => finding.severity === "warning" || finding.severity === "error");
}

export function shouldPostComment(config: FirewallConfig, findings: Finding[]): boolean {
  if (!config.comment.enabled || config.comment.postWhen === "never") {
    return false;
  }

  if (config.comment.postWhen === "always") {
    return true;
  }

  return findings.length > 0;
}

export function shouldRefreshExistingCleanReport(config: FirewallConfig, findings: Finding[]): boolean {
  return config.comment.enabled &&
    config.comment.updateExisting &&
    config.comment.postWhen === "findings" &&
    findings.length === 0;
}

export function shouldPostSkippedComment(config: FirewallConfig, hasExistingReport: boolean): boolean {
  if (!config.comment.enabled || config.comment.postWhen === "never") {
    return false;
  }

  if (config.comment.postWhen === "always") {
    return true;
  }

  return config.comment.updateExisting && hasExistingReport;
}

function escapeTable(value: string): string {
  return escapeMarkdownTableCell(value, "<br>");
}

function escapeInlineCode(value: string): string {
  return value.replace(/`/g, "'");
}

function escapeMarkdownLine(value: string): string {
  return escapeMarkdownTableCell(value, " ");
}

function escapeMarkdownTableCell(value: string, newlineReplacement: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, newlineReplacement);
}

function appendPassedChecks(lines: string[], config: FirewallConfig, summary: ReviewSummary): void {
  if (!config.comment.includePassingChecks || summary.passedChecks.length === 0) {
    return;
  }

  lines.push("");
  lines.push("Checks that passed:");
  for (const check of summary.passedChecks) {
    lines.push(`- ${check}`);
  }
}

function appendRoutingHints(lines: string[], summary: ReviewSummary): void {
  if (summary.routingHints.length === 0) {
    return;
  }

  lines.push("");
  lines.push("Routing hints:");
  for (const hint of summary.routingHints) {
    lines.push(`- ${hint.owner}: ${hint.files.join(", ")}`);
  }
}
