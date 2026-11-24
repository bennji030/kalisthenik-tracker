export interface TrainingPrefs {
  restSound: boolean;
}

/** Meta `training`: Ton bei Pausenende (an). Ein altes gespeichertes `lockScreen` wird ignoriert. */
export function parseTrainingPrefs(value: unknown): TrainingPrefs {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return { restSound: typeof v.restSound === 'boolean' ? v.restSound : true };
}
