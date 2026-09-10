import type { AdaptationConfig, ContainerDefinition } from "./model.ts";
import type { ValidationIssue } from "./validate-config.ts";

export interface ResolvedContainer extends ContainerDefinition {
  /** Stable IDs from root through this container. */
  readonly ancestry: readonly string[];
  /** Display segments; names need not be unique. */
  readonly path: readonly string[];
}

export function validateContainers(
  config: AdaptationConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const containers = config.containers ?? [];
  const byId = new Map<string, ContainerDefinition>();
  for (const [index, container] of containers.entries()) {
    const path = `containers[${String(index)}]`;
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(container.id)) {
      issues.push({
        path: `${path}.id`,
        message:
          "Container IDs must be lowercase kebab-case starting with a letter.",
      });
    }
    if (byId.has(container.id)) {
      issues.push({
        path: `${path}.id`,
        message: `Duplicate container ID "${container.id}".`,
      });
    } else {
      byId.set(container.id, container);
    }
    if (!container.name.trim()) {
      issues.push({
        path: `${path}.name`,
        message: "Container names must not be blank.",
      });
    }
  }
  for (const [index, container] of containers.entries()) {
    const path = `containers[${String(index)}].parentId`;
    if (container.parentId !== undefined && !byId.has(container.parentId)) {
      issues.push({
        path,
        message: `Unknown parent container "${container.parentId}".`,
      });
      continue;
    }
    const seen = new Set<string>();
    let current: ContainerDefinition | undefined = container;
    while (current) {
      if (seen.has(current.id)) {
        issues.push({
          path,
          message: `Container "${container.id}" belongs to a cyclic hierarchy.`,
        });
        break;
      }
      seen.add(current.id);
      current =
        current.parentId === undefined ? undefined : byId.get(current.parentId);
    }
  }
  for (const [index, artifact] of config.artifacts.entries()) {
    if (artifact.containerId === undefined) continue;
    const path = `artifacts[${String(index)}].containerId`;
    if (!byId.has(artifact.containerId)) {
      issues.push({
        path,
        message: `Unknown container "${artifact.containerId}".`,
      });
    }
    if (artifact.kind === "journalPage" || artifact.kind === "playlistSound") {
      issues.push({
        path,
        message:
          "Embedded artifacts inherit placement from their parent and cannot specify containerId.",
      });
    }
    if (artifact.metadata?.containerPath !== undefined) {
      issues.push({
        path,
        message:
          "Specify containerId or legacy metadata.containerPath, not both.",
      });
    }
  }
  return issues;
}

/** Resolve an explicit forest in deterministic parent-first order without mutation. */
export function resolveContainerHierarchy(
  config: AdaptationConfig,
): readonly ResolvedContainer[] {
  const issues = validateContainers(config);
  if (issues.length) {
    throw new Error(
      issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"),
    );
  }
  const pending = new Map(
    (config.containers ?? []).map((container) => [container.id, container]),
  );
  const resolved = new Map<string, ResolvedContainer>();
  for (const container of pending.values()) {
    const chain: ContainerDefinition[] = [];
    let current: ContainerDefinition | undefined = container;
    while (current && !resolved.has(current.id)) {
      chain.push(current);
      current =
        current.parentId === undefined
          ? undefined
          : pending.get(current.parentId);
    }
    for (const entry of chain.reverse()) {
      const parent =
        entry.parentId === undefined ? undefined : resolved.get(entry.parentId);
      resolved.set(entry.id, {
        ...entry,
        ancestry: [...(parent?.ancestry ?? []), entry.id],
        path: [...(parent?.path ?? []), entry.name],
      });
    }
  }
  return [...resolved.values()];
}
