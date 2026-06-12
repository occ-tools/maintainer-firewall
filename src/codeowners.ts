import * as core from "@actions/core";
import { minimatch } from "minimatch";
import type * as github from "@actions/github";
import { getErrorMessage, getErrorStatus } from "./errors.js";
import type { FirewallConfig, PullRequestSubject, RoutingHint } from "./types.js";
import type { RuntimeWarningSink } from "./run-diagnostics.js";

type Octokit = ReturnType<typeof github.getOctokit>;

interface CodeOwnerRule {
  pattern: string;
  owners: string[];
}

export async function loadCodeOwnerHints(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string | undefined,
  config: FirewallConfig,
  subject: PullRequestSubject,
  warningSink: RuntimeWarningSink = (message) => core.warning(message)
): Promise<RoutingHint[]> {
  const content = await loadFirstCodeOwnersFile(octokit, owner, repo, ref, config.repository.codeOwnersPaths, warningSink);
  if (!content) {
    return [];
  }

  const rules = parseCodeOwners(content);
  if (rules.length === 0) {
    return [];
  }

  const ownerToFiles = new Map<string, string[]>();
  for (const file of subject.changedFiles) {
    const ownersForFile = ownersForPath(file.filename, rules);
    for (const ownerName of ownersForFile) {
      const files = ownerToFiles.get(ownerName) ?? [];
      files.push(file.filename);
      ownerToFiles.set(ownerName, files);
    }
  }

  return [...ownerToFiles.entries()]
    .map(([ownerName, files]) => ({
      owner: ownerName,
      files: files.slice(0, 5)
    }))
    .sort((left, right) => right.files.length - left.files.length)
    .slice(0, 5);
}

export function parseCodeOwners(content: string): CodeOwnerRule[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split(/\s+/);
      const pattern = parts[0];
      const owners = parts.slice(1).filter((part) => part.startsWith("@"));

      if (!pattern || owners.length === 0) {
        return null;
      }

      return {
        pattern,
        owners
      };
    })
    .filter((rule): rule is CodeOwnerRule => Boolean(rule));
}

export function ownersForPath(path: string, rules: CodeOwnerRule[]): string[] {
  for (let index = rules.length - 1; index >= 0; index -= 1) {
    const rule = rules[index];
    if (rule && matchesCodeOwnerPattern(path, rule.pattern)) {
      return rule.owners;
    }
  }

  return [];
}

async function loadFirstCodeOwnersFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string | undefined,
  paths: string[],
  warningSink: RuntimeWarningSink
): Promise<string | null> {
  for (const path of paths) {
    try {
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref
      });

      if (!Array.isArray(response.data) && response.data.type === "file" && response.data.content) {
        core.info(`Loaded CODEOWNERS routing hints from ${response.data.path}.`);
        return Buffer.from(response.data.content, "base64").toString("utf8");
      }
    } catch (error) {
      const status = getErrorStatus(error);
      if (status !== 404) {
        warningSink(`Failed to load CODEOWNERS from ${path}: ${getErrorMessage(error)}`);
      }
    }
  }

  return null;
}

function matchesCodeOwnerPattern(path: string, pattern: string): boolean {
  const normalizedPath = path.replace(/\\/g, "/");
  const normalizedPattern = pattern.replace(/\\/g, "/").replace(/^\/+/, "");
  const globs = expandCodeOwnerPattern(normalizedPattern);

  return globs.some((glob) => minimatch(normalizedPath, glob, { dot: true }));
}

function expandCodeOwnerPattern(pattern: string): string[] {
  const withoutTrailingSlash = pattern.replace(/\/+$/, "");
  if (!withoutTrailingSlash) {
    return [];
  }

  if (pattern.endsWith("/")) {
    return [
      `${withoutTrailingSlash}/**`
    ];
  }

  if (!withoutTrailingSlash.includes("/")) {
    return [
      withoutTrailingSlash,
      `**/${withoutTrailingSlash}`
    ];
  }

  return [
    withoutTrailingSlash,
    `${withoutTrailingSlash}/**`
  ];
}


