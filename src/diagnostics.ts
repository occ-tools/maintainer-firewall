import type { FirewallConfig } from "./types.js";
import { isProtectedFindingId } from "./finding-ids.js";

export function validateConfig(config: FirewallConfig): string[] {
  const warnings: string[] = [];

  if (config.version !== 1) {
    warnings.push(`Unsupported config version ${config.version}; version 1 is the only supported version.`);
  }

  warnings.push(...invalidRegexWarnings("security.reportPatterns", config.security.reportPatterns));
  warnings.push(...invalidRegexWarnings("security.secretPatterns", config.security.secretPatterns));
  warnings.push(...invalidRegexWarnings("ignore.titlePatterns", config.ignore.titlePatterns));

  const labelValues = Object.values(config.labels).filter(Boolean);
  const duplicateLabels = labelValues.filter((label, index) => labelValues.indexOf(label) !== index);
  for (const label of [...new Set(duplicateLabels)]) {
    warnings.push(`Label "${label}" is configured for more than one finding type.`);
  }

  if (config.ai.enabled && !config.ai.model.trim()) {
    warnings.push("AI analysis is enabled, but ai.model is empty.");
  }

  if (config.comment.maxFindings < 1) {
    warnings.push("comment.maxFindings should be at least 1.");
  }

  warnings.push(...rulePolicyWarnings(config));

  return warnings;
}

function invalidRegexWarnings(path: string, patterns: string[]): string[] {
  return patterns
    .map((pattern, index) => {
      try {
        new RegExp(pattern);
        return null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `${path}[${index}] contains an invalid regular expression: ${message}`;
      }
    })
    .filter((warning): warning is string => Boolean(warning));
}

function rulePolicyWarnings(config: FirewallConfig): string[] {
  const warnings: string[] = [];
  const disabled = new Set(config.rules.disabled);
  const overrides = new Map<string, string[]>();

  for (const [severity, ids] of Object.entries(config.rules.severityOverrides)) {
    for (const id of ids) {
      const configuredSeverities = overrides.get(id) ?? [];
      configuredSeverities.push(severity);
      overrides.set(id, configuredSeverities);
    }
  }

  for (const [id, severities] of overrides) {
    if (disabled.has(id) && !isProtectedFindingId(id)) {
      warnings.push(`rules.disabled includes "${id}" and rules.severityOverrides also configures it; disabled wins.`);
    }

    if (isProtectedFindingId(id) && severities.some((severity) => severity !== "error")) {
      warnings.push(`rules.severityOverrides cannot downgrade protected finding "${id}"; default severity remains error.`);
    }

    if (severities.length > 1) {
      warnings.push(`rules.severityOverrides configures "${id}" more than once (${severities.join(", ")}); strongest severity wins.`);
    }
  }

  for (const id of disabled) {
    if (isProtectedFindingId(id)) {
      warnings.push(`rules.disabled cannot suppress protected finding "${id}"; it will still be reported.`);
    }
  }

  return warnings;
}
