import type { AdaptationConfig } from "../domain/model.ts";
import { taxonomyId } from "../domain/taxonomy-id.ts";

const root = "Dead Suns Adaptation";
const chapter = `${root}/Chapter 1`;
const miscellaneous = `${root}/Miscellaneous`;

export const dac18SampleConfig: AdaptationConfig = {
  campaign: "DS",
  title: "Docking Bay 94 Sample",
  artifacts: [
    journal("DS-JRN-01.01.01.00", "Part I", chapter, "Chapter 1", "Part I"),
    journal(
      "DS-JRN-08.04.01.00",
      "NPC Profiles",
      miscellaneous,
      "Miscellaneous",
      "Non-Player Characters (NPCs)",
    ),
    journal(
      "DS-JRN-08.06.01.00",
      "Alien Archive",
      miscellaneous,
      "Miscellaneous",
      "Alien Archive",
    ),
    page(
      "DS-JPG-01.01.01.01",
      "Arrival at Docking Bay 94",
      "DS-JRN-01.01.01.00",
      "The crew arrives at Docking Bay 94 as a gang conflict erupts around them.",
      chapter,
    ),
    page(
      "DS-JPG-08.04.01.01",
      "Duravor Kreel",
      "DS-JRN-08.04.01.00",
      "Duravor Kreel is the crew's contact at Docking Bay 94.",
      miscellaneous,
    ),
    page(
      "DS-JPG-08.06.01.01",
      "Absalom Station Gang Member",
      "DS-JRN-08.06.01.00",
      "A combatant involved in the Docking Bay 94 gang conflict.",
      miscellaneous,
    ),
    page(
      "DS-JPG-08.04.01.02",
      "Detective Elias Mercer",
      "DS-JRN-08.04.01.00",
      "Detective Elias Mercer investigates the aftermath at Docking Bay 94.",
      miscellaneous,
    ),
    {
      kind: "scene",
      taxonomyId: taxonomyId("DS-BAT-01.01.02.00", "BAT"),
      name: "Docking Bay 94",
      background:
        "modules/deadsuns-adaptation-vtt/assets/scenes/docking-bay-94.webp",
      actors: [
        { taxonomyId: taxonomyId("DS-NPC-08.04.02.00", "NPC") },
        { taxonomyId: taxonomyId("DS-AA-08.06.02.00", "AA") },
      ],
      journals: [{ taxonomyId: taxonomyId("DS-JRN-01.01.01.00", "JRN") }],
      metadata: {
        containerPath: chapter,
        chapter: "Chapter 1",
        part: "Part I",
      },
    },
    actor("DS-NPC-08.04.02.00", "NPC", "Duravor Kreel", miscellaneous),
    actor(
      "DS-AA-08.06.02.00",
      "AA",
      "Absalom Station Gang Member",
      miscellaneous,
    ),
    actor("DS-NPC-08.04.03.00", "NPC", "Detective Elias Mercer", miscellaneous),
    {
      kind: "playlist",
      taxonomyId: taxonomyId("DS-PLY-01.01.03.00", "PLY"),
      name: "Gangwar",
      metadata: {
        containerPath: chapter,
        chapter: "Chapter 1",
        part: "Part I",
      },
    },
    sound("DS-AUD-01.01.03.01", "Docking Bay", "docking-bay.ogg"),
    sound(
      "DS-AUD-01.01.03.02",
      "Caught in the crossfire",
      "caught-in-the-crossfire.ogg",
    ),
    sound("DS-AUD-01.01.03.03", "Aftermath", "aftermath.ogg"),
    sound(
      "DS-AUD-01.01.03.04",
      "Turn off that alarm",
      "turn-off-that-alarm.ogg",
    ),
  ],
};

function journal(
  id: string,
  name: string,
  containerPath: string,
  chapterName: string,
  part: string,
) {
  return {
    kind: "journal" as const,
    taxonomyId: taxonomyId(id, "JRN"),
    name,
    metadata: { containerPath, chapter: chapterName, part },
  };
}

function page(
  id: string,
  name: string,
  parent: string,
  markdown: string,
  containerPath: string,
) {
  return {
    kind: "journalPage" as const,
    taxonomyId: taxonomyId(id, "JPG"),
    name,
    journal: { taxonomyId: taxonomyId(parent, "JRN") },
    markdown,
    metadata: { containerPath },
  };
}

function actor(
  id: string,
  code: "NPC" | "AA",
  name: string,
  containerPath: string,
) {
  return {
    kind: "actor" as const,
    taxonomyId: taxonomyId(id, code),
    name,
    metadata: { containerPath },
  };
}

function sound(id: string, name: string, filename: string) {
  return {
    kind: "playlistSound" as const,
    taxonomyId: taxonomyId(id, "AUD"),
    name,
    playlist: { taxonomyId: taxonomyId("DS-PLY-01.01.03.00", "PLY") },
    source: `modules/deadsuns-adaptation-vtt/assets/audio/${filename}`,
    metadata: { containerPath: chapter },
  };
}
