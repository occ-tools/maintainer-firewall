import * as core from "@actions/core";
import { redactByPatterns } from "./redaction.js";
import type { FirewallConfig } from "./types.js";

export interface RunDiagnostics {
  configWarnings: string[];
  runtimeWarnings: string[];
}

export type RuntimeWarningSink = (message: string) => void;

export function createRunDiagnostics(configWarnings: string[] = []): RunDiagnostics {
  return {
    configWarnings: [...configWarnings],
    runtimeWarnings: []
  };
}

export function createRuntimeWarningSink(
  diagnostics: RunDiagnostics,
  config: FirewallConfig
): RuntimeWarningSink {
  return (message: string) => {
    const redacted = redactByPatterns(message, config.security.secretPatterns);
    diagnostics.runtimeWarnings.push(redacted);
    core.warning(redacted);
  };
}

