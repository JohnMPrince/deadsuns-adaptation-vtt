import type { ContainerDefinition } from "../domain/model.ts";

/** Initial DAC-19 hierarchy; extend through adaptation configuration. */
export const deadSunsContainers = [
  { id: "dead-suns-adaptation", name: "Dead Suns Adaptation" },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    parentId: "dead-suns-adaptation",
  },
  { id: "locations", name: "Locations", parentId: "dead-suns-adaptation" },
  { id: "elements", name: "Elements", parentId: "dead-suns-adaptation" },
  { id: "chapter-1", name: "Chapter 1", parentId: "dead-suns-adaptation" },
] as const satisfies readonly ContainerDefinition[];
