import * as core from "@actions/core";
import * as github from "@actions/github";
import { analyzeWithAi } from "./ai.js";
import { emitFindingAnnotations } from "./annotations.js";
import { loadCodeOwnerHints } from "./codeowners.js";
import {
  composeReport,
  composeSkippedReport,
  shouldFail,
  shouldPostComment,
  shouldPostSkippedComment,
  shouldRefreshExistingCleanReport
} from "./comment.js";
import { loadConfigWithDiagnostics } from "./config.js";
import { validateConfig } from "./diagnostics.js";
import { applyFindingPolicy } from "./finding-policy.js";
import { loadRepositoryGuidance } from "./guidance.js";
import { getSkipReason } from "./ignore.js";
import { staleManagedLabels } from "./labels.js";
import { createReportPayload, writeReportJson } from "./report.js";
import { redactByPatterns } from "./redaction.js";
import { createReviewSummary } from "./review.js";
import {
  createRunDiagnostics,
  createRuntimeWarningSink,
  setDiagnosticOutputs,
  type RunDiagnostics,
  type RuntimeWarningSink
} from "./run-diagnostics.js";
import { analyzeSubject } from "./rules.js";
import { composeSetupSummary, composeStepSummary } from "./setup-summary.js";
import { applyLabels, buildSubject, getConfigRef, hasReportComment, removeLabels, upsertComment } from "./github-client.js";
import type { Finding, FirewallConfig, ReviewSummary, Subject } from "./types.js";

async function run(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const openAiApiKey = core.getInput("openai-api-key") || process.env.OPENAI_API_KEY;
  const configPath = core.getInput("config-path") || ".maintainer-firewall.yml";
  const dryRun = parseBoolean(core.getInput("dry-run"));
  const failOnFindings = parseBoolean(core.getInput("fail-on-findings"));
  const emitAnnotations = parseBoolean(core.getInput("emit-annotations"));
  const writeStepSummary = parseBoolean(core.getInput("write-step-summary") || "true");
  const reportJsonPath = core.getInput("report-json-path");

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  const configRef = getConfigRef(github.context);
  const configLoad = await loadConfigWithDiagnostics(octokit, owner, repo, configPath, configRef);
  const config = configLoad.config;
  const configWarnings = [...configLoad.warnings, ...validateConfig(config)]
    .map((warning) => redactByPatterns(warning, config.security.secretPatterns));
  const diagnostics = createRunDiagnostics(configWarnings);
  const warn = createRuntimeWarningSink(diagnostics, config);
  for (const warning of configWarnings) {
    core.warning(warning);
  }

  const subject = await buildSubject(octokit, github.context, config.issue.duplicateSearchLimit, warn);

  if (!subject) {
    const skipReason = `event ${github.context.eventName} is not handled`;
    setSkippedOutputs(skipReason, reportJsonPath, diagnostics);
    const skippedReport = composeSkippedReport(null, skipReason, config);
    core.info(skippedReport);

    if (reportJsonPath) {
      await tryWrite(
        "write JSON report",
        () => writeReportJson(reportJsonPath, createReportPayload(null, [], null, config, skipReason, diagnostics)),
        warn
      );
    }

    if (writeStepSummary) {
      await writeSummary(
        "write step summary",
        composeRunStepSummary(config, configPath, diagnostics, {
          dryRun,
          emitAnnotations,
          failOnFindings,
          openAiApiKeyProvided: Boolean(openAiApiKey),
          reportJsonPath,
          subjectKind: null
        }, skippedReport),
        warn
      );
    }

    setSkippedOutputs(skipReason, reportJsonPath, diagnostics);
    return;
  }

  const skipReason = getSkipReason(subject, config);
  if (skipReason) {
    setSkippedOutputs(skipReason, reportJsonPath, diagnostics);
    const skippedReport = composeSkippedReport(subject, skipReason, config);
    core.info(skippedReport);

    if (!dryRun) {
      if (config.labeling.enabled && config.labeling.removeStale) {
        const staleLabels = staleManagedLabels(subject.labels, [], config);
        if (staleLabels.length > 0) {
          await tryWrite("remove stale labels", () => removeLabels(octokit, owner, repo, subject.number, staleLabels), warn);
        }
      }

      const hasExistingReport = await hasReportComment(octokit, owner, repo, subject.number, warn);
      if (shouldPostSkippedComment(config, hasExistingReport)) {
        await tryWrite("upsert skipped comment", () => upsertComment(
          octokit,
          owner,
          repo,
          subject.number,
          skippedReport,
          config.comment.updateExisting
        ), warn);
      }
    }

    if (reportJsonPath) {
      await tryWrite(
        "write JSON report",
        () => writeReportJson(reportJsonPath, createReportPayload(subject, [], null, config, skipReason, diagnostics)),
        warn
      );
    }

    if (writeStepSummary) {
      await writeSummary(
        "write step summary",
        composeRunStepSummary(config, configPath, diagnostics, {
          dryRun,
          emitAnnotations,
          failOnFindings,
          openAiApiKeyProvided: Boolean(openAiApiKey),
          reportJsonPath,
          subjectKind: subject.kind
        }, skippedReport),
        warn
      );
    }

    setSkippedOutputs(skipReason, reportJsonPath, diagnostics);
    return;
  }

  const ruleFindings = analyzeSubject(subject, config);
  const hasPossibleSecret = ruleFindings.some((finding) => finding.id === "content.secret.possible");
  if (config.ai.enabled && !openAiApiKey) {
    warn("AI analysis is enabled in config, but no OpenAI API key was provided. Running deterministic checks only.");
  }

  if (hasPossibleSecret && config.ai.enabled && openAiApiKey) {
    warn("Skipping OpenAI analysis because a possible secret or credential was detected in the subject.");
  }

  const guidanceDocs = config.ai.enabled && openAiApiKey && !hasPossibleSecret
    ? await loadRepositoryGuidance(octokit, owner, repo, configRef, config, warn)
    : [];
  const aiFindings = hasPossibleSecret
    ? []
    : await analyzeWithAi(subject, config, openAiApiKey, guidanceDocs, warn);
  const findings = applyFindingPolicy(dedupeFindings([...ruleFindings, ...aiFindings]), config);
  const routingHints = subject.kind === "pull_request"
    ? await loadCodeOwnerHints(octokit, owner, repo, configRef, config, subject, warn)
    : [];
  const summary = createReviewSummary(subject, findings, config, routingHints);
  const report = composeReport(subject, findings, config, summary);

  setCompletedOutputs(summary, findings, reportJsonPath, diagnostics);
  if (emitAnnotations) {
    emitFindingAnnotations(findings, config);
  }

  core.info(report);

  if (!dryRun) {
    if (summary.labels.length > 0) {
      await tryWrite(
        "apply labels",
        () => applyLabels(octokit, owner, repo, subject.number, summary.labels, config.labeling.createMissing),
        warn
      );
    }

    if (config.labeling.enabled && config.labeling.removeStale) {
      const staleLabels = staleManagedLabels(subject.labels, summary.labels, config);
      if (staleLabels.length > 0) {
        await tryWrite("remove stale labels", () => removeLabels(octokit, owner, repo, subject.number, staleLabels), warn);
      }
    }

    const shouldUpdateExistingCleanReport =
      shouldRefreshExistingCleanReport(config, findings) &&
      await hasReportComment(octokit, owner, repo, subject.number, warn);

    if (shouldPostComment(config, findings) || shouldUpdateExistingCleanReport) {
      await tryWrite("upsert comment", () => upsertComment(
        octokit,
        owner,
        repo,
        subject.number,
        report,
        config.comment.updateExisting
      ), warn);
    }
  } else {
    core.info("Dry run enabled. No labels or comments were written.");
  }

  if (reportJsonPath) {
    await tryWrite(
      "write JSON report",
      () => writeReportJson(reportJsonPath, createReportPayload(subject, findings, summary, config, undefined, diagnostics)),
      warn
    );
  }

  if (writeStepSummary) {
    await writeSummary(
      "write step summary",
      composeRunStepSummary(config, configPath, diagnostics, {
        dryRun,
        emitAnnotations,
        failOnFindings,
        openAiApiKeyProvided: Boolean(openAiApiKey),
        reportJsonPath,
        subjectKind: subject.kind
      }, report),
      warn
    );
  }

  setCompletedOutputs(summary, findings, reportJsonPath, diagnostics);
  if (failOnFindings && shouldFail(findings)) {
    core.setFailed("Maintainer Firewall produced warning or error findings.");
  }
}

function dedupeFindings(findings: ReturnType<typeof analyzeSubject>): ReturnType<typeof analyzeSubject> {
  const seen = new Set<string>();
  const output = [];

  for (const finding of findings) {
    const key = `${finding.id}:${finding.title}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(finding);
  }

  return output;
}

function setSkippedOutputs(skipReason: string, reportJsonPath: string | undefined, diagnostics: RunDiagnostics): void {
  core.setOutput("skipped", "true");
  core.setOutput("skip-reason", skipReason);
  core.setOutput("outcome", "skipped");
  core.setOutput("score", "");
  core.setOutput("findings-count", "0");
  core.setOutput("labels", "");
  core.setOutput("routing-hints", "[]");
  core.setOutput("report-json-path", reportJsonPath ?? "");
  setDiagnosticOutputs(diagnostics);
}

function setCompletedOutputs(
  summary: ReviewSummary,
  findings: Finding[],
  reportJsonPath: string | undefined,
  diagnostics: RunDiagnostics
): void {
  core.setOutput("skipped", "false");
  core.setOutput("skip-reason", "");
  core.setOutput("outcome", summary.outcome);
  core.setOutput("score", String(summary.score));
  core.setOutput("findings-count", String(findings.length));
  core.setOutput("labels", summary.labels.join(","));
  core.setOutput("routing-hints", JSON.stringify(summary.routingHints));
  core.setOutput("report-json-path", reportJsonPath ?? "");
  setDiagnosticOutputs(diagnostics);
}

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

async function writeSummary(operation: string, summary: string, warningSink: RuntimeWarningSink): Promise<void> {
  await tryWrite(operation, async () => {
    await core.summary.addRaw(summary, true).write();
  }, warningSink);
}

function composeRunStepSummary(
  config: FirewallConfig,
  configPath: string,
  diagnostics: RunDiagnostics,
  options: {
    dryRun: boolean;
    emitAnnotations: boolean;
    failOnFindings: boolean;
    openAiApiKeyProvided: boolean;
    reportJsonPath: string;
    subjectKind: Subject["kind"] | null;
  },
  report: string
): string {
  return composeStepSummary(composeSetupSummary({
    config,
    configPath,
    configWarnings: diagnostics.configWarnings,
    runtimeWarnings: diagnostics.runtimeWarnings,
    dryRun: options.dryRun,
    emitAnnotations: options.emitAnnotations,
    failOnFindings: options.failOnFindings,
    openAiApiKeyProvided: options.openAiApiKeyProvided,
    reportJsonPath: options.reportJsonPath,
    subjectKind: options.subjectKind
  }), report);
}

async function tryWrite(
  operation: string,
  write: () => Promise<void>,
  warningSink: RuntimeWarningSink = (message) => core.warning(message)
): Promise<void> {
  try {
    await write();
  } catch (error) {
    warningSink(`Could not ${operation}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
