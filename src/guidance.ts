import * as core from "@actions/core";
import type * as github from "@actions/github";
import type { FirewallConfig, RepositoryGuidanceDoc } from "./types.js";
import type { RuntimeWarningSink } from "./run-diagnostics.js";
import { truncate } from "./text.js";

type Octokit = ReturnType<typeof github.getOctokit>;

const GUIDANCE_FILE_PATTERN = /\.(md|mdx|txt|ya?ml)$/i;

export async function loadRepositoryGuidance(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string | undefined,
  config: FirewallConfig,
  warningSink: RuntimeWarningSink = (message) => core.warning(message)
): Promise<RepositoryGuidanceDoc[]> {
  const docs: RepositoryGuidanceDoc[] = [];
  const seen = new Set<string>();
  let remainingCharacters = config.repository.maxGuidanceCharacters;

  if (remainingCharacters <= 0) {
    return [];
  }

  for (const path of config.repository.guidancePaths) {
    if (remainingCharacters <= 0) {
      break;
    }

    const loaded = await loadGuidancePath(octokit, owner, repo, ref, path, warningSink);
    for (const doc of loaded) {
      if (remainingCharacters <= 0) {
        break;
      }

      if (seen.has(doc.path)) {
        continue;
      }

      seen.add(doc.path);
      const content = truncate(doc.content.trim(), remainingCharacters);
      if (!content) {
        continue;
      }

      docs.push({
        path: doc.path,
        content
      });
      remainingCharacters -= content.length;
    }
  }

  if (docs.length > 0) {
    core.info(`Loaded ${docs.length} repository guidance file${docs.length === 1 ? "" : "s"} for AI analysis.`);
  }

  return docs;
}

export function summarizeGuidanceForPrompt(docs: RepositoryGuidanceDoc[]): string {
  if (docs.length === 0) {
    return "No repository guidance files were loaded.";
  }

  return docs
    .map((doc) => `# ${doc.path}\n${doc.content}`)
    .join("\n\n---\n\n");
}

async function loadGuidancePath(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string | undefined,
  path: string,
  warningSink: RuntimeWarningSink
): Promise<RepositoryGuidanceDoc[]> {
  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref
    });

    if (Array.isArray(response.data)) {
      const children = response.data
        .filter((entry) => entry.type === "file" && GUIDANCE_FILE_PATTERN.test(entry.name))
        .slice(0, 20);

      const nested = await Promise.all(
        children.map((entry) => loadGuidancePath(octokit, owner, repo, ref, entry.path, warningSink))
      );
      return nested.flat();
    }

    if (response.data.type !== "file" || !response.data.content) {
      return [];
    }

    if (!GUIDANCE_FILE_PATTERN.test(response.data.name)) {
      return [];
    }

    return [
      {
        path: response.data.path,
        content: Buffer.from(response.data.content, "base64").toString("utf8")
      }
    ];
  } catch (error) {
    const status = getErrorStatus(error);
    if (status !== 404) {
      warningSink(`Failed to load repository guidance ${path}: ${getErrorMessage(error)}`);
    }

    return [];
  }
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error && "status" in error) {
    return Number((error as { status?: unknown }).status);
  }

  return undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
