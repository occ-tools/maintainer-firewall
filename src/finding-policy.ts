import type { Finding, FirewallConfig, Severity } from "./types.js";
import { isProtectedFindingId } from "./finding-ids.js";

const SEVERITY_OVERRIDE_PRECEDENCE: Severity[] = ["error", "warning", "notice"];

export function applyFindingPolicy(findings: Finding[], config: FirewallConfig): Finding[] {
  const disabled = new Set(config.rules.disabled);

  return findings
    .filter((finding) => !disabled.has(finding.id) || isProtectedFindingId(finding.id))
    .map((finding) => ({
      ...finding,
      severity: severityForFinding(finding, config) ?? finding.severity
    }));
}

function severityForFinding(finding: Finding, config: FirewallConfig): Severity | null {
  if (isProtectedFindingId(finding.id)) {
    return null;
  }

  for (const severity of SEVERITY_OVERRIDE_PRECEDENCE) {
    if (config.rules.severityOverrides[severity].includes(finding.id)) {
      return severity;
    }
  }

  return null;
}
