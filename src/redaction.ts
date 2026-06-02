import type { Finding, ReviewSummary } from "./types.js";

export function redactByPatterns(value: string, patterns: string[], replacement = "[redacted]"): string {
  return patterns.reduce((output, pattern) => {
    try {
      return output.replace(new RegExp(pattern, "gi"), replacement);
    } catch {
      return output;
    }
  }, value);
}

export function redactFinding(finding: Finding, patterns: string[]): Finding {
  return {
    ...finding,
    id: redactByPatterns(finding.id, patterns),
    title: redactByPatterns(finding.title, patterns),
    details: redactByPatterns(finding.details, patterns),
    suggestion: finding.suggestion ? redactByPatterns(finding.suggestion, patterns) : undefined
  };
}

export function redactReviewSummary(summary: ReviewSummary, patterns: string[]): ReviewSummary {
  return {
    ...summary,
    headline: redactByPatterns(summary.headline, patterns),
    nextSteps: summary.nextSteps.map((step) => redactByPatterns(step, patterns)),
    passedChecks: summary.passedChecks.map((check) => redactByPatterns(check, patterns)),
    routingHints: summary.routingHints.map((hint) => ({
      ...hint,
      owner: redactByPatterns(hint.owner, patterns),
      files: hint.files.map((file) => redactByPatterns(file, patterns))
    }))
  };
}
