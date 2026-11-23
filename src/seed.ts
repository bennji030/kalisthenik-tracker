import { db, getMeta, setMeta, type Exercise, type Slot, type Template } from './db';
import { uid } from './util';

const EX: Record<string, Omit<Exercise, 'id'>> = {
  muSkill: { name: 'Muscle-up (Skill)', type: 'reps' },
  hsSkill: { name: 'Handstand (Skill)', type: 'hold' },
  wPull: { name: 'Pull-ups (Zusatzgewicht)', type: 'weighted' },
  wRow: { name: 'Australian Pull-ups (Zusatzgewicht)', type: 'weighted' },
  legRaise: { name: 'Hanging Leg Raises', type: 'reps' },
  wDips: { name: 'Dips (Zusatzgewicht)', type: 'weighted' },
  pike: { name: 'Pike Push-ups (erhöht)', type: 'reps' },
  pull: { name: 'Pull-ups', type: 'reps' },
  chin: { name: 'Chin-ups', type: 'reps' },
  row: { name: 'Australian Pull-ups', type: 'reps' },
  wPush: { name: 'Liegestütze (Zusatzgewicht)', type: 'weighted' },
  dips: { name: 'Dips', type: 'reps' },
};

type SlotDef = [key: keyof typeof EX, sets: number, repMin: number, repMax: number, restSec: number, progression?: boolean, startWeight?: number];

export async function seedIfEmpty() {
  if (await getMeta('seeded', false)) return;
  if ((await db.templates.count()) > 0) return;

  const ids: Record<string, string> = {};
  const exercises: Exercise[] = Object.entries(EX).map(([k, e]) => {
    ids[k] = uid();
    return { id: ids[k], ...e };
  });

  const slot = ([key, sets, repMin, repMax, restSec, progression = true, startWeight = 0]: SlotDef): Slot => ({
    id: uid(),
    exerciseId: ids[key],
    sets,
    repMin,
    repMax,
    increment: 2.5,
    startWeight,
    restSec,
    progression,
  });

  const templates: Template[] = [
    {
      id: uid(), name: 'Pull A · schwer', weekdays: [1], order: 0,
      slots: [
        slot(['muSkill', 3, 3, 5, 120, false]),
        slot(['wPull', 4, 3, 5, 180, true, 20]),
        slot(['wRow', 3, 6, 8, 120, true, 10]),
        slot(['legRaise', 3, 8, 12, 90]),
      ],
    },
    {
      id: uid(), name: 'Push A · schwer', weekdays: [2], order: 1,
      slots: [
        slot(['hsSkill', 4, 1, 1, 90, false]),
        slot(['wDips', 4, 4, 6, 180, true, 25]),
        slot(['pike', 3, 6, 10, 120]),
      ],
    },
    {
      id: uid(), name: 'Pull B · leicht', weekdays: [4], order: 2,
      slots: [
        slot(['muSkill', 4, 3, 5, 120, false]),
        slot(['pull', 3, 8, 12, 120]),
        slot(['chin', 2, 8, 15, 120]),
        slot(['row', 2, 10, 15, 90]),
      ],
    },
    {
      id: uid(), name: 'Push B · leicht', weekdays: [5], order: 3,
      slots: [
        slot(['hsSkill', 5, 1, 1, 90, false]),
        slot(['wPush', 3, 8, 12, 120, true, 10]),
        slot(['dips', 3, 8, 12, 120]),
      ],
    },
  ];

  await db.transaction('rw', db.exercises, db.templates, db.meta, async () => {
    await db.exercises.bulkAdd(exercises);
    await db.templates.bulkAdd(templates);
    await setMeta('seeded', true);
  });
}
