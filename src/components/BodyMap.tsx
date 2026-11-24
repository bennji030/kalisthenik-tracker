import { MUSCLES, type Muscle } from '../muscles';
import { muscleOfRegion } from '../bodyRegions';
import { FRONT_MUSCLES } from '../vendor/bodyMuscles/muscles.front';
import { BACK_MUSCLES } from '../vendor/bodyMuscles/muscles.back';

type Load = Partial<Record<Muscle, number>>;

const REGIONS = [...FRONT_MUSCLES, ...BACK_MUSCLES];

// Drei Stufen: nicht trainiert, etwas, viel (ab der Hälfte des meisttrainierten Muskels).
const level = (v: number | undefined) => (!v ? 'body-off' : v >= 0.5 ? 'body-hi' : 'body-mid');

/** Vorder- und Rückansicht nebeneinander; trainierte Muskeln in Akzentfarbe, je mehr Sätze desto kräftiger. */
export function BodyMap({ load }: { load: Load }) {
  const trained = MUSCLES.filter((m) => load[m.id]).map((m) => m.label);
  return (
    <svg className="body-map" viewBox="0 0 69 93" role="img" aria-label={`Trainierte Muskeln: ${trained.join(', ')}`}>
      {REGIONS.map((r) => {
        const m = muscleOfRegion(r.id);
        return <path key={r.id} className={m ? level(load[m]) : 'body-base'} d={r.path} />;
      })}
    </svg>
  );
}
