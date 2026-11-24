import type { Muscle } from './muscles';

const both = (...names: string[]) => names.flatMap((n) => [`${n}-left`, `${n}-right`]);

/** Unsere 13 Gruppen auf die Regionen der Muskelkarte (src/vendor/bodyMuscles). Der Rest bleibt neutral. */
export const BODY_REGIONS: Record<Muscle, string[]> = {
  chest: both('chest-upper', 'chest-lower'),
  frontDelts: both('shoulder-front'),
  sideDelts: both('shoulder-side'),
  rearDelts: both('deltoid-rear'),
  biceps: both('biceps'),
  triceps: both('triceps-long', 'triceps-lateral'),
  forearms: both('forearm', 'forearm-flexors', 'forearm-extensors'),
  lats: both('lats-upper', 'lats-mid', 'lats-lower', 'traps-upper', 'traps-mid', 'traps-lower'),
  lowerBack: both('lower-back-erectors', 'lower-back-ql'),
  abs: both('abs-upper', 'abs-lower', 'obliques'),
  glutes: both('gluteus-maximus', 'gluteus-medius'),
  thighs: both('quads', 'adductors', 'hamstrings-medial', 'hamstrings-lateral'),
  calves: both('calves-gastroc-medial', 'calves-gastroc-lateral', 'calves-soleus'),
};

const OWNER = new Map<string, Muscle>(
  (Object.entries(BODY_REGIONS) as [Muscle, string[]][]).flatMap(([m, ids]) => ids.map((id) => [id, m] as const)),
);

/** Zu welcher Muskelgruppe gehört die Region? undefined = neutral (Kopf, Hände, Füße …). */
export const muscleOfRegion = (id: string): Muscle | undefined => OWNER.get(id);
