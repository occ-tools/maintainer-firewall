import * as core from "@actions/core";
import { parse } from "yaml";
import type * as github from "@actions/github";
import { getErrorMessage, getErrorStatus } from "./errors.js";
import type { FirewallConfig } from "./types.js";

type Octokit = ReturnType<typeof github.getOctokit>;

export interface ConfigLoadResult {
  config: FirewallConfig;
  warnings: string[];
}

const MINIMUM_VALUES: Record<string, number> = {
  "config.issue.minBodyCharacters": 0,
  "config.issue.duplicateSearchLimit": 0,
  "config.pullRequest.minBodyCharacters": 0,
  "config.pullRequest.largeChangeThreshold": 1,
  "config.repository.maxGuidanceCharacters": 0,
  "config.comment.maxFindings": 1,
  "config.ai.maxInputCharacters": 1000,
  "config.ai.maxOutputTokens": 100,
  "config.ai.timeoutMs": 1000
};

const STRING_ENUM_VALUES: Record<string, string[]> = {
  "config.comment.postWhen": ["always", "findings", "never"]
};

export const defaultConfig: FirewallConfig = {
  version: 1,
  issue: {
    enabled: true,
    minBodyCharacters: 120,
    requireReproduction: true,
    requireEnvironment: true,
    duplicateSearchLimit: 8,
    requiredSections: []
  },
  pullRequest: {
    enabled: true,
    minBodyCharacters: 120,
    requireLinkedIssue: true,
    requireTestsForCodeChanges: true,
    largeChangeThreshold: 800,
    sensitivePaths: [
      ".github/workflows/**",
      "package-lock.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "Cargo.lock",
      "go.sum"
    ],
    testPathPatterns: [
      "**/*.test.*",
      "**/*.spec.*",
      "**/__tests__/**",
      "tests/**"
    ],
    requiredSections: []
  },
  repository: {
    guidancePaths: [
      "CONTRIBUTING.md",
      ".github/CONTRIBUTING.md",
      "docs/CONTRIBUTING.md",
      "PULL_REQUEST_TEMPLATE.md",
      ".github/pull_request_template.md",
      ".github/PULL_REQUEST_TEMPLATE.md",
      ".github/PULL_REQUEST_TEMPLATE",
      ".github/ISSUE_TEMPLATE.md",
      ".github/ISSUE_TEMPLATE"
    ],
    codeOwnersPaths: [
      "CODEOWNERS",
      ".github/CODEOWNERS",
      "docs/CODEOWNERS"
    ],
    maxGuidanceCharacters: 16000
  },
  security: {
    enabled: true,
    reportPatterns: [
      "\\bCVE-\\d{4}-\\d+\\b",
      "\\bvulnerab(?:ility|le)\\b",
      "\\bexploit\\b",
      "\\bRCE\\b",
      "\\bremote code execution\\b",
      "\\bXSS\\b",
      "\\bCSRF\\b",
      "\\bSSRF\\b",
      "\\bSQL injection\\b",
      "\\bpath traversal\\b",
      "\\bprototype pollution\\b",
      "\\bauth bypass\\b",
      "\\bcredential leak\\b",
      "\\btoken leak\\b",
      "\\bsecret leak\\b"
    ],
    secretPatterns: [
      "\\bgithub_pat_[A-Za-z0-9_]{20,}\\b",
      "\\bgh[pousr]_[A-Za-z0-9_]{36,}\\b",
      "\\bsk-[A-Za-z0-9_-]{20,}\\b",
      "\\bglpat-[A-Za-z0-9_-]{20,}\\b",
      "\\bnpm_[A-Za-z0-9]{20,}\\b",
      "\\bAIza[0-9A-Za-z\\-_]{35}\\b",
      "\\bAKIA[0-9A-Z]{16}\\b",
      "\\bxox[baprs]-[A-Za-z0-9-]{20,}\\b",
      "\\bSG\\.[A-Za-z0-9_-]{16,}\\.[A-Za-z0-9_-]{16,}\\b",
      "\\beyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\b",
      "\\b-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----\\b"
    ]
  },
  labeling: {
    enabled: true,
    createMissing: true,
    removeStale: true
  },
  labels: {
    needsInfo: "needs-info",
    needsTests: "needs-tests",
    largeScope: "large-scope",
    possibleDuplicate: "possible-duplicate",
    securityReview: "security-review",
    maintainerReview: "maintainer-review"
  },
  comment: {
    enabled: true,
    updateExisting: true,
    header: "Maintainer Firewall report",
    postWhen: "findings",
    maxFindings: 8,
    includePassingChecks: true
  },
  rules: {
    disabled: [],
    severityOverrides: {
      notice: [],
      warning: [],
      error: []
    }
  },
  ignore: {
    authors: [
      "dependabot[bot]",
      "renovate[bot]",
      "github-actions[bot]"
    ],
    labels: [
      "skip-firewall"
    ],
    titlePatterns: [
      "^\\[skip firewall\\]"
    ]
  },
  ai: {
    enabled: false,
    model: "gpt-5-mini",
    maxInputCharacters: 12000,
    maxOutputTokens: 1200,
    timeoutMs: 15000
  }
};

export async function loadConfig(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<FirewallConfig> {
  const result = await loadConfigWithDiagnostics(octokit, owner, repo, path, ref);
  for (const warning of result.warnings) {
    core.warning(warning);
  }

  return result.config;
}

export async function loadConfigWithDiagnostics(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<ConfigLoadResult> {
  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref
    });

    if (Array.isArray(response.data) || response.data.type !== "file") {
      return {
        config: defaultConfig,
        warnings: [`${path} is not a file. Falling back to defaults.`]
      };
    }

    const content = Buffer.from(response.data.content, "base64").toString("utf8");
    const parsed = parse(content) as Partial<FirewallConfig> | undefined;

    return {
      config: mergeConfig(parsed ?? {}),
      warnings: configShapeWarnings(parsed ?? {})
    };
  } catch (error) {
    const status = getErrorStatus(error);
    if (status === 404) {
      core.info(`No ${path} found. Using default Maintainer Firewall config.`);
      return {
        config: defaultConfig,
        warnings: []
      };
    }

    return {
      config: defaultConfig,
      warnings: [`Failed to load ${path}: ${getErrorMessage(error)}. Using defaults.`]
    };
  }
}

export function mergeConfig(override: unknown): FirewallConfig {
  return normalizeConfig(deepMerge(defaultConfig, override));
}

export function configShapeWarnings(
  override: unknown,
  base: unknown = defaultConfig,
  path = "config"
): string[] {
  if (override === null || override === undefined) {
    return [];
  }

  if (Array.isArray(base)) {
    if (!Array.isArray(override)) {
      return [`${path} should be an array; using the default value.`];
    }

    return override
      .map((item, index) => typeof item === "string"
        ? null
        : `${path}[${index}] should be a string; using the default value for ${path}.`)
      .filter((warning): warning is string => Boolean(warning));
  }

  if (isPlainObject(base)) {
    if (!isPlainObject(override)) {
      return [`${path} should be an object; using the default value.`];
    }

    const warnings: string[] = [];
    for (const [key, value] of Object.entries(override)) {
      if (!(key in base)) {
        warnings.push(`${path}.${key} is not a supported config key and will be ignored.`);
        continue;
      }

      warnings.push(...configShapeWarnings(value, base[key], `${path}.${key}`));
    }

    return warnings;
  }

  if (typeof base === "boolean" && typeof override !== "boolean") {
    return [`${path} should be a boolean; using the default value.`];
  }

  if (typeof base === "number" && (typeof override !== "number" || !Number.isFinite(override))) {
    return [`${path} should be a finite number; using the default value.`];
  }

  if (typeof base === "number" && typeof override === "number") {
    const minimum = MINIMUM_VALUES[path];
    if (minimum !== undefined && override < minimum) {
      return [`${path} should be at least ${minimum}; using ${minimum} during normalization.`];
    }
  }

  if (typeof base === "string" && typeof override !== "string") {
    return [`${path} should be a string; using the default value.`];
  }

  if (typeof base === "string" && typeof override === "string") {
    const allowedValues = STRING_ENUM_VALUES[path];
    if (allowedValues && !allowedValues.includes(override)) {
      return [`${path} should be one of: ${allowedValues.join(", ")}; using the default value.`];
    }
  }

  return [];
}

function normalizeConfig(config: FirewallConfig): FirewallConfig {
  return {
    ...config,
    issue: {
      ...config.issue,
      minBodyCharacters: Math.max(0, config.issue.minBodyCharacters),
      duplicateSearchLimit: Math.max(0, config.issue.duplicateSearchLimit),
      requiredSections: config.issue.requiredSections ?? []
    },
    pullRequest: {
      ...config.pullRequest,
      minBodyCharacters: Math.max(0, config.pullRequest.minBodyCharacters),
      largeChangeThreshold: Math.max(1, config.pullRequest.largeChangeThreshold),
      sensitivePaths: config.pullRequest.sensitivePaths ?? [],
      testPathPatterns: config.pullRequest.testPathPatterns ?? [],
      requiredSections: config.pullRequest.requiredSections ?? []
    },
    repository: {
      ...config.repository,
      guidancePaths: config.repository.guidancePaths ?? [],
      codeOwnersPaths: config.repository.codeOwnersPaths ?? [],
      maxGuidanceCharacters: Math.max(0, config.repository.maxGuidanceCharacters)
    },
    security: {
      ...config.security,
      reportPatterns: config.security.reportPatterns ?? [],
      secretPatterns: config.security.secretPatterns ?? []
    },
    labeling: config.labeling,
    comment: {
      ...config.comment,
      postWhen: isKnownPostWhen(config.comment.postWhen) ? config.comment.postWhen : "findings",
      maxFindings: Math.max(1, config.comment.maxFindings),
      includePassingChecks: config.comment.includePassingChecks
    },
    rules: {
      disabled: config.rules.disabled ?? [],
      severityOverrides: {
        notice: config.rules.severityOverrides.notice ?? [],
        warning: config.rules.severityOverrides.warning ?? [],
        error: config.rules.severityOverrides.error ?? []
      }
    },
    ignore: {
      authors: config.ignore.authors ?? [],
      labels: config.ignore.labels ?? [],
      titlePatterns: config.ignore.titlePatterns ?? []
    },
    ai: {
      ...config.ai,
      maxInputCharacters: Math.max(1000, config.ai.maxInputCharacters),
      maxOutputTokens: Math.max(100, config.ai.maxOutputTokens),
      timeoutMs: Math.max(1000, config.ai.timeoutMs)
    }
  };
}

function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) {
    return base;
  }

  if (Array.isArray(base)) {
    return (Array.isArray(override) && override.every((item) => typeof item === "string") ? override : base) as T;
  }

  if (isPlainObject(base)) {
    if (!isPlainObject(override)) {
      return base;
    }

    const output: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
      if (!(key in output)) {
        continue;
      }

      output[key] = deepMerge(output[key], value);
    }

    return output as T;
  }

  if (typeof base === "boolean") {
    return (typeof override === "boolean" ? override : base) as T;
  }

  if (typeof base === "number") {
    return (typeof override === "number" && Number.isFinite(override) ? override : base) as T;
  }

  if (typeof base === "string") {
    return (typeof override === "string" ? override : base) as T;
  }

  return override as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isKnownPostWhen(value: unknown): value is FirewallConfig["comment"]["postWhen"] {
  return value === "always" || value === "findings" || value === "never";
}
