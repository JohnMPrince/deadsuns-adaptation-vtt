import { describe, expect, test } from "vitest";

import {
  contentKey,
  validateConfig,
  type AdaptationConfig,
} from "../src/domain/index.ts";

describe("domain configuration", () => {
  test("accepts a valid configuration with typed references", () => {
    const config: AdaptationConfig = {
      id: "dead-suns",
      title: "Dead Suns Adaptation",
      content: [
        {
          kind: "actor",
          key: contentKey("dead-suns.ch01.security-robot"),
          name: "Security Robot",
        },
        {
          kind: "scene",
          key: contentKey("dead-suns.ch01.docking-bay-94"),
          name: "Docking Bay 94",
        },
        {
          kind: "encounter",
          key: contentKey("dead-suns.ch01.docking-bay-94.encounter"),
          name: "Docking Bay Ambush",
          scene: {
            kind: "scene",
            key: contentKey("dead-suns.ch01.docking-bay-94"),
          },
          actors: [
            { kind: "actor", key: contentKey("dead-suns.ch01.security-robot") },
          ],
        },
      ],
    };

    expect(validateConfig(config)).toEqual([]);
  });

  test("reports duplicate keys and invalid references together", () => {
    const duplicatedKey = contentKey("dead-suns.ch01.duplicate");
    const config: AdaptationConfig = {
      id: "dead-suns",
      title: "Dead Suns Adaptation",
      content: [
        { kind: "actor", key: duplicatedKey, name: "First" },
        { kind: "scene", key: duplicatedKey, name: "Second" },
        {
          kind: "encounter",
          key: contentKey("dead-suns.ch01.broken-encounter"),
          name: "Broken Encounter",
          scene: {
            kind: "scene",
            key: contentKey("dead-suns.ch01.missing-scene"),
          },
          actors: [{ kind: "actor", key: duplicatedKey }],
        },
      ],
    };

    expect(validateConfig(config)).toEqual([
      {
        path: "content[1].key",
        message: `Duplicate content key "${duplicatedKey}" (already used by actor).`,
      },
      {
        path: "content[2].scene",
        message: 'Unknown scene reference "dead-suns.ch01.missing-scene".',
      },
    ]);
  });

  test("rejects keys that are not stable slugs", () => {
    expect(() => contentKey("Dead Suns/Chapter 1")).toThrow(
      /Invalid content key/,
    );
  });
});
