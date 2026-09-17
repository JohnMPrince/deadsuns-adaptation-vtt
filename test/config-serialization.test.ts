import { describe, expect, test } from "vitest";

import { parseAdaptationConfigJson } from "../src/domain/index.ts";

describe("serialized adaptation configuration", () => {
  test("parses and validates valid JSON configuration", () => {
    const result = parseAdaptationConfigJson(
      JSON.stringify({
        campaign: "DS",
        title: "Dead Suns Adaptation",
        artifacts: [
          {
            kind: "actor",
            taxonomyId: "DS-NPC-01.01.01.00",
            name: "Example actor",
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      success: true,
      config: { campaign: "DS", title: "Dead Suns Adaptation" },
    });
  });

  test("reports malformed JSON as a controlled syntax failure", () => {
    const result = parseAdaptationConfigJson('{"campaign":"DS"');

    expect(result).toEqual({
      success: false,
      stage: "syntax",
      issues: [
        { path: "configuration", message: "Configuration is not valid JSON." },
      ],
    });
    expect(result).not.toHaveProperty("config");
  });

  test("reports a missing required property as a structural failure", () => {
    const result = parseAdaptationConfigJson(
      JSON.stringify({ title: "Missing campaign", artifacts: [] }),
    );

    expect(result).toMatchObject({
      success: false,
      stage: "structure",
      issues: [{ path: "campaign", message: "Expected a nonblank string." }],
    });
    expect(result).not.toHaveProperty("config");
  });

  test("reports an incorrect primitive type as a structural failure", () => {
    const result = parseAdaptationConfigJson(
      JSON.stringify({ campaign: 42, title: "Example", artifacts: [] }),
    );

    expect(result).toMatchObject({
      success: false,
      stage: "structure",
      issues: [{ path: "campaign" }],
    });
  });

  test("reports an invalid nested collection as a structural failure", () => {
    const result = parseAdaptationConfigJson(
      JSON.stringify({
        campaign: "DS",
        title: "Example",
        artifacts: [
          {
            kind: "scene",
            taxonomyId: "DS-BAT-01.01.01.00",
            name: "Scene",
            actors: { taxonomyId: "DS-NPC-01.01.01.00" },
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      success: false,
      stage: "structure",
      issues: [{ path: "artifacts[0].actors" }],
    });
  });

  test("distinguishes semantic failures from syntax and structure", () => {
    const result = parseAdaptationConfigJson(
      JSON.stringify({
        campaign: "DS",
        title: "Example",
        artifacts: [
          {
            kind: "actor",
            taxonomyId: "not-a-taxonomy-id",
            name: "Actor",
          },
        ],
      }),
    );

    expect(result).toMatchObject({
      success: false,
      stage: "semantic",
      issues: [{ path: "artifacts[0].taxonomyId" }],
    });
    expect(result).not.toHaveProperty("config");
  });
});
