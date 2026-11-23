import { db, setMeta } from './db';
import { isWeightList } from './weight';

const APP = 'kalisthenik-tracker';

export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const data = {
    app: APP,
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises: await db.exercises.toArray(),
    templates: await db.templates.toArray(),
    sessions: await db.sessions.toArray(),
    meta: (await db.meta.toArray()).filter((m) => m.key !== 'lastBackup'),
    weights: await db.weights.toArray(),
  };
  const json = JSON.stringify(data, null, 1);
  const name = `kalisthenik-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      await setMeta('lastBackup', Date.now());
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  await setMeta('lastBackup', Date.now());
  return 'downloaded';
}

export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text());
  if (data?.app !== APP || !Array.isArray(data.sessions) || !Array.isArray(data.exercises) || !Array.isArray(data.templates))
    throw new Error('Das ist keine Kalisthenik-Backup-Datei.');
  // Alte Backups ohne "weights" lassen die vorhandenen Gewichte stehen.
  const hasWeights = 'weights' in data;
  if (hasWeights && !isWeightList(data.weights)) throw new Error('Die Gewichtsdaten im Backup sind ungültig.');
  await db.transaction('rw', [db.exercises, db.templates, db.sessions, db.meta, db.weights], async () => {
    await Promise.all([db.exercises.clear(), db.templates.clear(), db.sessions.clear(), db.meta.clear()]);
    await db.exercises.bulkAdd(data.exercises);
    await db.templates.bulkAdd(data.templates);
    await db.sessions.bulkAdd(data.sessions);
    await db.meta.bulkAdd(data.meta ?? []);
    if (hasWeights) {
      await db.weights.clear();
      await db.weights.bulkAdd(data.weights);
    }
    await setMeta('seeded', true);
    await setMeta('lastBackup', Date.now());
  });
  return data.sessions.length;
}
