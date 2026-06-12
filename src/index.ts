import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  composeRunStepSummary,
  dedupeFindings,
  parseBoolean,
  setCompletedOutputs,
  setSkippedOutputs,
  tryWrite,
  writeSummary
} from "./action-runtime.js";
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
import { createEffectiveConfigPayload, writeEffectiveConfigJson } from "./effective-config.js";
import { applyFindingPolicy } from "./finding-policy.js";
import { loadRepositoryGuidance } from "./guidance.js";
import { getSkipReason } from "./ignore.js";
import { staleManagedLabels } from "./labels.js";
import { createReportPayload, writeReportJson } from "./report.js";
import { redactByPatterns } from "./redaction.js";
import { createReviewSummary } from "./review.js";
import {
  createRunDiagnostics,
  createRuntimeWarningSink
} from "./run-diagnostics.js";
import { analyzeSubject } from "./rules.js";
import { applyLabels, buildSubject, getConfigRef, hasReportComment, removeLabels, upsertComment } from "./github-client.js";

async function run(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const openAiApiKey = core.getInput("openai-api-key") || process.env.OPENAI_API_KEY;
  core.setSecret(token);
  if (openAiApiKey) {
    core.setSecret(openAiApiKey);
  }

  const configPath = core.getInput("config-path") || ".maintainer-firewall.yml";
  const dryRun = parseBoolean(core.getInput("dry-run"));
  const failOnFindings = parseBoolean(core.getInput("fail-on-findings"));
  const emitAnnotations = parseBoolean(core.getInput("emit-annotations"));
  const writeStepSummary = parseBoolean(core.getInput("write-step-summary") || "true");
  const reportJsonPath = core.getInput("report-json-path");
  const effectiveConfigJsonPath = core.getInput("effective-config-json-path");

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
  if (effectiveConfigJsonPath) {
    await tryWrite(
      "write effective config JSON",
      () => writeEffectiveConfigJson(effectiveConfigJsonPath, createEffectiveConfigPayload(config, configPath, {
        dryRun,
        emitAnnotations,
        failOnFindings,
        writeStepSummary,
        openAiApiKeyProvided: Boolean(openAiApiKey),
        reportJsonPath,
        effectiveConfigJsonPath,
        subjectKind: subject?.kind ?? null
      }, diagnostics)),
      warn
    );
  }

  if (!subject) {
    const skipReason = `event ${github.context.eventName} is not handled`;
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
          effectiveConfigJsonPath,
          subjectKind: null
        }, skippedReport),
        warn
      );
    }

    setSkippedOutputs(skipReason, reportJsonPath, effectiveConfigJsonPath, diagnostics, config);
    return;
  }

  const skipReason = getSkipReason(subject, config);
  if (skipReason) {
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
          effectiveConfigJsonPath,
          subjectKind: subject.kind
        }, skippedReport),
        warn
      );
    }

    setSkippedOutputs(skipReason, reportJsonPath, effectiveConfigJsonPath, diagnostics, config);
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

  const shouldRunAi = config.ai.enabled && Boolean(openAiApiKey) && !hasPossibleSecret;
  const guidanceDocs = shouldRunAi
    ? await loadRepositoryGuidance(octokit, owner, repo, configRef, config, warn)
    : [];
  const aiFindings = shouldRunAi
    ? await analyzeWithAi(subject, config, openAiApiKey, guidanceDocs, warn)
    : [];
  const findings = applyFindingPolicy(dedupeFindings([...ruleFindings, ...aiFindings]), config);
  const routingHints = subject.kind === "pull_request"
    ? await loadCodeOwnerHints(octokit, owner, repo, configRef, config, subject, warn)
    : [];
  const summary = createReviewSummary(subject, findings, config, routingHints);
  const report = composeReport(subject, findings, config, summary);

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
        effectiveConfigJsonPath,
        subjectKind: subject.kind
      }, report),
      warn
    );
  }

  setCompletedOutputs(summary, findings, reportJsonPath, effectiveConfigJsonPath, diagnostics, config);
  if (failOnFindings && shouldFail(findings)) {
    core.setFailed("Maintainer Firewall produced warning or error findings.");
  }
}

run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
