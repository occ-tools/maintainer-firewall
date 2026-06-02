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
import { loadConfig } from "./config.js";
import { validateConfig } from "./diagnostics.js";
import { loadRepositoryGuidance } from "./guidance.js";
import { getSkipReason } from "./ignore.js";
import { staleManagedLabels } from "./labels.js";
import { createReportPayload, writeReportJson } from "./report.js";
import { createReviewSummary } from "./review.js";
import { analyzeSubject } from "./rules.js";
import { composeSetupSummary, composeStepSummary } from "./setup-summary.js";
import { applyLabels, buildSubject, getConfigRef, hasReportComment, removeLabels, upsertComment } from "./github-client.js";
import type { Finding, ReviewSummary } from "./types.js";

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
  const config = await loadConfig(octokit, owner, repo, configPath, configRef);
  for (const warning of validateConfig(config)) {
    core.warning(warning);
  }

  const subject = await buildSubject(octokit, github.context, config.issue.duplicateSearchLimit);

  if (!subject) {
    const skipReason = `event ${github.context.eventName} is not handled`;
    setSkippedOutputs(skipReason, reportJsonPath);
    const skippedReport = composeSkippedReport(null, skipReason, config);
    const setupSummary = composeSetupSummary({
      config,
      configPath,
      dryRun,
      emitAnnotations,
      failOnFindings,
      openAiApiKeyProvided: Boolean(openAiApiKey),
      reportJsonPath,
      subjectKind: null
    });
    core.info(skippedReport);
    if (writeStepSummary) {
      await tryWrite("write step summary", async () => {
        await core.summary.addRaw(composeStepSummary(setupSummary, skippedReport), true).write();
      });
    }

    if (reportJsonPath) {
      await tryWrite("write JSON report", () =>
        writeReportJson(reportJsonPath, createReportPayload(null, [], null, config, skipReason))
      );
    }

    return;
  }

  const skipReason = getSkipReason(subject, config);
  if (skipReason) {
    setSkippedOutputs(skipReason, reportJsonPath);
    const skippedReport = composeSkippedReport(subject, skipReason, config);
    const setupSummary = composeSetupSummary({
      config,
      configPath,
      dryRun,
      emitAnnotations,
      failOnFindings,
      openAiApiKeyProvided: Boolean(openAiApiKey),
      reportJsonPath,
      subjectKind: subject.kind
    });
    core.info(skippedReport);
    if (writeStepSummary) {
      await tryWrite("write step summary", async () => {
        await core.summary.addRaw(composeStepSummary(setupSummary, skippedReport), true).write();
      });
    }

    if (reportJsonPath) {
      await tryWrite("write JSON report", () =>
        writeReportJson(reportJsonPath, createReportPayload(subject, [], null, config, skipReason))
      );
    }

    if (!dryRun) {
      if (config.labeling.enabled && config.labeling.removeStale) {
        const staleLabels = staleManagedLabels(subject.labels, [], config);
        if (staleLabels.length > 0) {
          await tryWrite("remove stale labels", () => removeLabels(octokit, owner, repo, subject.number, staleLabels));
        }
      }

      const hasExistingReport = await hasReportComment(octokit, owner, repo, subject.number);
      if (shouldPostSkippedComment(config, hasExistingReport)) {
        await tryWrite("upsert skipped comment", () => upsertComment(
          octokit,
          owner,
          repo,
          subject.number,
          skippedReport,
          config.comment.updateExisting
        ));
      }
    }

    return;
  }

  const ruleFindings = analyzeSubject(subject, config);
  const hasPossibleSecret = ruleFindings.some((finding) => finding.id === "content.secret.possible");
  if (config.ai.enabled && !openAiApiKey) {
    core.warning("AI analysis is enabled in config, but no OpenAI API key was provided. Running deterministic checks only.");
  }

  if (hasPossibleSecret && config.ai.enabled && openAiApiKey) {
    core.warning("Skipping OpenAI analysis because a possible secret or credential was detected in the subject.");
  }

  const guidanceDocs = config.ai.enabled && openAiApiKey && !hasPossibleSecret
    ? await loadRepositoryGuidance(octokit, owner, repo, configRef, config)
    : [];
  const aiFindings = hasPossibleSecret
    ? []
    : await analyzeWithAi(subject, config, openAiApiKey, guidanceDocs);
  const findings = dedupeFindings([...ruleFindings, ...aiFindings]);
  const routingHints = subject.kind === "pull_request"
    ? await loadCodeOwnerHints(octokit, owner, repo, configRef, config, subject)
    : [];
  const summary = createReviewSummary(subject, findings, config, routingHints);
  const report = composeReport(subject, findings, config, summary);
  const setupSummary = composeSetupSummary({
    config,
    configPath,
    dryRun,
    emitAnnotations,
    failOnFindings,
    openAiApiKeyProvided: Boolean(openAiApiKey),
    reportJsonPath,
    subjectKind: subject.kind
  });

  setCompletedOutputs(summary, findings, reportJsonPath);
  if (emitAnnotations) {
    emitFindingAnnotations(findings, config);
  }

  core.info(report);
  if (writeStepSummary) {
    await tryWrite("write step summary", async () => {
      await core.summary.addRaw(composeStepSummary(setupSummary, report), true).write();
    });
  }

  if (!dryRun) {
    if (summary.labels.length > 0) {
      await tryWrite("apply labels", () =>
        applyLabels(octokit, owner, repo, subject.number, summary.labels, config.labeling.createMissing)
      );
    }

    if (config.labeling.enabled && config.labeling.removeStale) {
      const staleLabels = staleManagedLabels(subject.labels, summary.labels, config);
      if (staleLabels.length > 0) {
        await tryWrite("remove stale labels", () => removeLabels(octokit, owner, repo, subject.number, staleLabels));
      }
    }

    const shouldUpdateExistingCleanReport =
      shouldRefreshExistingCleanReport(config, findings) &&
      await hasReportComment(octokit, owner, repo, subject.number);

    if (shouldPostComment(config, findings) || shouldUpdateExistingCleanReport) {
      await tryWrite("upsert comment", () => upsertComment(
        octokit,
        owner,
        repo,
        subject.number,
        report,
        config.comment.updateExisting
      ));
    }
  } else {
    core.info("Dry run enabled. No labels or comments were written.");
  }

  if (reportJsonPath) {
    await tryWrite("write JSON report", () =>
      writeReportJson(reportJsonPath, createReportPayload(subject, findings, summary, config))
    );
  }

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

function setSkippedOutputs(skipReason: string, reportJsonPath?: string): void {
  core.setOutput("skipped", "true");
  core.setOutput("skip-reason", skipReason);
  core.setOutput("outcome", "skipped");
  core.setOutput("score", "");
  core.setOutput("findings-count", "0");
  core.setOutput("labels", "");
  core.setOutput("routing-hints", "[]");
  core.setOutput("report-json-path", reportJsonPath ?? "");
}

function setCompletedOutputs(summary: ReviewSummary, findings: Finding[], reportJsonPath?: string): void {
  core.setOutput("skipped", "false");
  core.setOutput("skip-reason", "");
  core.setOutput("outcome", summary.outcome);
  core.setOutput("score", String(summary.score));
  core.setOutput("findings-count", String(findings.length));
  core.setOutput("labels", summary.labels.join(","));
  core.setOutput("routing-hints", JSON.stringify(summary.routingHints));
  core.setOutput("report-json-path", reportJsonPath ?? "");
}

function parseBoolean(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

async function tryWrite(operation: string, write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (error) {
    core.warning(`Could not ${operation}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
