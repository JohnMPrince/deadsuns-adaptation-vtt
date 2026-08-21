import type { ContentKey } from "./model.ts";

const CONTENT_KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export function contentKey(value: string): ContentKey {
  if (!CONTENT_KEY_PATTERN.test(value)) {
    throw new Error(
      `Invalid content key "${value}". Use lowercase segments separated by dots or hyphens.`,
    );
  }

  return value as ContentKey;
}
