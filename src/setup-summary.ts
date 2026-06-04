import type { FirewallConfig, Subject } from "./types.js";
import { isProtectedFindingId } from "./finding-ids.js";

export interface SetupSummaryOptions {
  config: FirewallConfig;
  configPath: string;
  configWarnings: string[];
  runtimeWarnings?: string[];
  dryRun: boolean;
  emitAnnotations: boolean;
  failOnFindings: boolean;
  openAiApiKeyProvided: boolean;
  reportJsonPath: string;
  effectiveConfigJsonPath?: string;
  subjectKind: Subject["kind"] | null;
}

export function composeSetupSummary(options: SetupSummaryOptions): string {
  const runtimeWarnings = options.runtimeWarnings ?? [];
  const rows: Array<[string, string]> = [
    ["Subject", options.subjectKind ? subjectLabel(options.subjectKind) : "No handled issue or pull request"],
    ["Config", options.configPath],
    ["Run mode", options.dryRun ? "Dry run; no labels, comments, or stale-label removals are written" : "Live writes allowed"],
    ["Comments", commentState(options.config)],
    ["Labels", labelState(options.config, options.dryRun)],
    ["Annotations", options.emitAnnotations ? "Enabled" : "Disabled"],
    ["JSON report", options.reportJsonPath || "Disabled"],
    ["Effective config", options.effectiveConfigJsonPath || "Disabled"],
    ["Rule policy", rulePolicyState(options.config)],
    ["Configuration warnings", options.configWarnings.length === 0 ? "None" : String(options.configWarnings.length)],
    ["Runtime warnings", runtimeWarnings.length === 0 ? "None" : String(runtimeWarnings.length)],
    ["AI analysis", aiState(options.config, options.openAiApiKeyProvided)],
    ["Failure policy", options.failOnFindings ? "Fail on warning or error findings" : "Advisory; workflow does not fail on findings"]
  ];

  const lines = [
    "## Maintainer Firewall setup",
    "",
    "| Setting | Active state |",
    "| --- | --- |",
    ...rows.map(([setting, state]) => `| ${escapeTable(setting)} | ${escapeTable(state)} |`)
  ];

  if (options.configWarnings.length > 0) {
    lines.push("");
    lines.push("### Configuration warnings");
    for (const warning of options.configWarnings.slice(0, 10)) {
      lines.push(`- ${warning}`);
    }

    if (options.configWarnings.length > 10) {
      lines.push(`- ${options.configWarnings.length - 10} additional warning${options.configWarnings.length === 11 ? "" : "s"} hidden.`);
    }
  }

  if (runtimeWarnings.length > 0) {
    lines.push("");
    lines.push("### Runtime warnings");
    for (const warning of runtimeWarnings.slice(0, 10)) {
      lines.push(`- ${warning}`);
    }

    if (runtimeWarnings.length > 10) {
      lines.push(`- ${runtimeWarnings.length - 10} additional warning${runtimeWarnings.length === 11 ? "" : "s"} hidden.`);
    }
  }

  return lines.join("\n");
}

export function composeStepSummary(setupSummary: string, report: string): string {
  return `${setupSummary}\n\n${report}`;
}

function subjectLabel(kind: Subject["kind"]): string {
  return kind === "issue" ? "Issue" : "Pull request";
}

function commentState(config: FirewallConfig): string {
  if (!config.comment.enabled || config.comment.postWhen === "never") {
    return "Disabled";
  }

  return `Enabled; postWhen=${config.comment.postWhen}; updateExisting=${String(config.comment.updateExisting)}`;
}

function labelState(config: FirewallConfig, dryRun: boolean): string {
  if (!config.labeling.enabled) {
    return "Disabled";
  }

  const state = `Enabled; createMissing=${String(config.labeling.createMissing)}; removeStale=${String(config.labeling.removeStale)}`;
  return dryRun ? `${state}; writes suppressed by dry-run` : state;
}

function aiState(config: FirewallConfig, openAiApiKeyProvided: boolean): string {
  if (!config.ai.enabled) {
    return "Disabled";
  }

  return openAiApiKeyProvided
    ? `Enabled; model=${config.ai.model}; timeoutMs=${config.ai.timeoutMs}`
    : "Configured, but no API key was provided";
}

function rulePolicyState(config: FirewallConfig): string {
  const disabledCount = config.rules.disabled.filter((id) => !isProtectedFindingId(id)).length;
  const overrideCount = Object.entries(config.rules.severityOverrides).reduce(
    (sum, [severity, ids]) => sum + ids.filter((id) => !isProtectedFindingId(id) || severity === "error").length,
    0
  );
  if (disabledCount === 0 && overrideCount === 0) {
    return "Default";
  }

  return `${disabledCount} disabled; ${overrideCount} severity override${overrideCount === 1 ? "" : "s"}`;
}

function escapeTable(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}
