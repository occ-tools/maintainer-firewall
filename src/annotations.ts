import * as core from "@actions/core";
import { redactFinding } from "./redaction.js";
import type { Finding, FirewallConfig } from "./types.js";

const MAX_ANNOTATION_TITLE_CHARACTERS = 255;
const MAX_ANNOTATION_MESSAGE_CHARACTERS = 1000;

export function emitFindingAnnotations(findings: Finding[], config: FirewallConfig): void {
  for (const finding of findings.map((item) => redactFinding(item, config.security.secretPatterns))) {
    const title = truncateSingleLine(
      `Maintainer Firewall: ${finding.title} (${finding.id})`,
      MAX_ANNOTATION_TITLE_CHARACTERS
    );
    const message = truncateSingleLine(annotationMessage(finding), MAX_ANNOTATION_MESSAGE_CHARACTERS);
    const properties = { title };

    if (finding.severity === "error") {
      core.error(message, properties);
      continue;
    }

    if (finding.severity === "warning") {
      core.warning(message, properties);
      continue;
    }

    core.notice(message, properties);
  }
}

function annotationMessage(finding: Finding): string {
  const parts = [
    `[${finding.id}] ${finding.title}: ${finding.details}`,
    finding.suggestion ? `Suggested next step: ${finding.suggestion}` : undefined
  ];

  return parts.filter(Boolean).join(" ");
}

function truncateSingleLine(value: string, maxCharacters: number): string {
  const compacted = value.replace(/\s+/g, " ").trim();
  if (compacted.length <= maxCharacters) {
    return compacted;
  }

  return `${compacted.slice(0, Math.max(0, maxCharacters - 14))}...[truncated]`;
}
