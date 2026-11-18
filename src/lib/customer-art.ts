// Rendered customer stills (film-style character art), picked up from the assets folder.
//
// Drop files into src/assets/customers/ named `<scenarioId>-<mood>.webp`, where mood is
// angry, softening or calm, and optionally `<scenarioId>-<mood>-talk.webp` for the same
// frame with the mouth open. A scenario with all three moods is shown as a cinematic
// stage; any scenario without them falls back to the live 3D customer.

import { SCENARIO_IDS, type Mood, type ScenarioId } from "./roleplay-rules";

export type CustomerArt = {
  /** One still per mood, all with the same framing. */
  frames: Record<Mood, string>;
  /** The mouth-open twin of a still, swapped in while the customer speaks. */
  talk: Partial<Record<Mood, string>>;
};

const MOODS: Mood[] = ["angry", "softening", "calm"];

const files = import.meta.glob<string>("../assets/customers/*.{webp,jpg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});

function build(): Partial<Record<ScenarioId, CustomerArt>> {
  const byName = new Map<string, string>();
  for (const [path, url] of Object.entries(files)) {
    const name = path
      .split("/")
      .pop()
      ?.replace(/\.(webp|jpg|png)$/, "");
    if (name) byName.set(name, url);
  }

  const art: Partial<Record<ScenarioId, CustomerArt>> = {};
  for (const id of SCENARIO_IDS) {
    const angry = byName.get(`${id}-angry`);
    const softening = byName.get(`${id}-softening`);
    const calm = byName.get(`${id}-calm`);
    if (!angry || !softening || !calm) continue;
    const talk: Partial<Record<Mood, string>> = {};
    for (const mood of MOODS) {
      const url = byName.get(`${id}-${mood}-talk`);
      if (url) talk[mood] = url;
    }
    art[id] = { frames: { angry, softening, calm }, talk };
  }
  return art;
}

export const CUSTOMER_ART = build();

export function getCustomerArt(id: ScenarioId): CustomerArt | null {
  return CUSTOMER_ART[id] ?? null;
}
