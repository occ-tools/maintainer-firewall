import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config.js";

type JsonObject = Record<string, unknown>;

interface DefaultLeaf {
  name: string;
  path: string[];
  expected: unknown;
}

const schema = JSON.parse(
  readFileSync("schema/maintainer-firewall.schema.json", "utf8")
) as JsonObject;

describe("configuration schema", () => {
  it("parses as JSON schema with root guidance", () => {
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.description).toEqual(expect.stringContaining("Partial configs"));
    expect(schema.additionalProperties).toBe(false);
  });

  it("documents every top-level section", () => {
    for (const [name, property] of Object.entries(getProperties(schema))) {
      expect(property.description, `${name} should have a description`).toEqual(expect.any(String));
      expect(String(property.description).length, `${name} description should be useful`).toBeGreaterThan(20);
    }
  });

  it.each(collectDefaultLeaves(defaultConfig))("exposes the runtime default for $name", ({ path, expected }) => {
    expect(getSchemaProperty(path).default).toEqual(expected);
  });

  it("describes every configurable leaf property", () => {
    for (const path of collectSchemaLeaves(schema)) {
      const property = getSchemaProperty(path);
      expect(property.description, `${path.join(".")} should have a description`).toEqual(expect.any(String));
      expect(String(property.description).length, `${path.join(".")} description should be useful`).toBeGreaterThan(20);
    }
  });
});

function collectDefaultLeaves(value: unknown, path: string[] = []): DefaultLeaf[] {
  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, nestedValue]) => collectDefaultLeaves(nestedValue, [...path, key]));
  }

  return [
    {
      name: path.join("."),
      path,
      expected: value
    }
  ];
}

function collectSchemaLeaves(node: JsonObject, path: string[] = []): string[][] {
  const properties = node.properties;
  if (isPlainObject(properties)) {
    return Object.entries(properties).flatMap(([key, nestedNode]) => collectSchemaLeaves(nestedNode as JsonObject, [...path, key]));
  }

  return [path];
}

function getSchemaProperty(path: string[]): JsonObject {
  let current = schema;
  for (const segment of path) {
    const property = getProperties(current)[segment];
    expect(property, `${path.join(".")} should exist in the schema`).toBeDefined();
    current = property;
  }

  return current;
}

function getProperties(node: JsonObject): Record<string, JsonObject> {
  expect(isPlainObject(node.properties), "schema node should define properties").toBe(true);
  return node.properties as Record<string, JsonObject>;
}

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
