import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type StringRecord = Record<string, string>;

interface ActionField {
  description?: string;
  required?: boolean;
  default?: string;
}

interface ActionMetadata {
  name: string;
  description: string;
  inputs: Record<string, ActionField>;
  outputs: Record<string, ActionField>;
  runs: {
    using: string;
    main: string;
  };
  branding: StringRecord;
}

const metadata = parse(readFileSync("action.yml", "utf8")) as ActionMetadata;
const readme = readFileSync("README.md", "utf8");

const expectedInputs: Record<string, Pick<ActionField, "required" | "default">> = {
  "github-token": { required: true },
  "openai-api-key": { required: false },
  "config-path": { required: false, default: ".maintainer-firewall.yml" },
  "dry-run": { required: false, default: "false" },
  "fail-on-findings": { required: false, default: "false" },
  "emit-annotations": { required: false, default: "false" },
  "write-step-summary": { required: false, default: "true" },
  "report-json-path": { required: false }
};

const expectedOutputs = [
  "outcome",
  "score",
  "findings-count",
  "labels",
  "routing-hints",
  "skipped",
  "skip-reason",
  "report-json-path",
  "config-warnings-count",
  "config-warnings",
  "runtime-warnings-count",
  "runtime-warnings"
];

describe("action metadata", () => {
  it("declares the supported action runtime and entrypoint", () => {
    expect(metadata.name).toBe("Maintainer Firewall");
    expect(metadata.runs.using).toBe("node20");
    expect(metadata.runs.main).toBe("dist/index.js");
    expect(metadata.branding.icon).toBe("shield");
  });

  it("documents every supported input with the expected default", () => {
    expect(Object.keys(metadata.inputs).sort()).toEqual(Object.keys(expectedInputs).sort());

    for (const [name, expected] of Object.entries(expectedInputs)) {
      const input = metadata.inputs[name];
      expect(input, `${name} should be declared`).toBeDefined();
      expect(input.required ?? false, `${name} required flag`).toBe(expected.required);
      expect(input.default, `${name} default`).toBe(expected.default);
      expect(input.description, `${name} should have a useful description`).toEqual(expect.any(String));
      expect(String(input.description).length, `${name} description should be useful`).toBeGreaterThan(40);
    }
  });

  it("documents every output exposed by the action", () => {
    expect(Object.keys(metadata.outputs).sort()).toEqual(expectedOutputs.toSorted());

    for (const name of expectedOutputs) {
      const output = metadata.outputs[name];
      expect(output, `${name} should be declared`).toBeDefined();
      expect(output.description, `${name} should have a useful description`).toEqual(expect.any(String));
      expect(String(output.description).length, `${name} description should be useful`).toBeGreaterThan(30);
    }
  });

  it("keeps README input and output tables aligned with action.yml", () => {
    for (const name of Object.keys(expectedInputs)) {
      expect(readme).toContain(`| \`${name}\` |`);
    }

    for (const name of expectedOutputs) {
      expect(readme).toContain(`| \`${name}\` |`);
    }
  });
});
