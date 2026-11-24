import type { ReactNode } from 'react';
import { MUSCLES, type Muscle } from '../muscles';

type Load = Partial<Record<Muscle, number>>;

// Eine Figur ist 50 breit und 116 hoch, Mitte bei x = 25. Gezeichnet wird die linke Hälfte, die rechte ist gespiegelt.
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const box = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;

const BODY = [
  ell(25, 8.5, 5.5, 6.5),
  box(22, 12, 6, 7, 2),
  // Nacken, Trapez, Schulter, Lat bis zur Taille, Hüfte
  'M25 16L22.5 16Q19 19.5 13 20.5Q7.5 21.5 7.5 27Q9 30.5 12 31Q12.8 42 15.8 50Q14.3 55 14.8 60L25 62Z',
  // Oberarm und Unterarm, zum Ellbogen und Handgelenk schmaler
  'M8.5 23Q6 30 6.2 36Q6.3 41 7 44L10.8 44Q11.6 39 12 33Q12.2 28 11.5 25Z',
  'M7 43Q5 47 5 52Q5.2 57 5.7 61L8 61Q9.3 55 10.4 49Q11 46 10.8 43Z',
  ell(6.8, 63.8, 2, 2.9),
  // Oberschenkel, Wade, Fuß
  'M15 56Q13.8 70 16.5 87L23 87Q24 75 24.5 62L25 56Z',
  'M16.6 86Q15.3 93 16.4 102L17.3 111L21.7 111Q22.3 104 23 96Q23.4 90 23 86Z',
  ell(19.4, 112.3, 3.3, 1.8),
];

// Schulterkappe in zwei Hälften: außen seitlich, innen vorne bzw. hinten.
const CAP_OUT = 'M9.6 22A3.6 4.2 0 0 0 9.6 30.4Z';
const CAP_IN = 'M10.4 22A3.6 4.2 0 0 1 10.4 30.4Z';
const FOREARM = 'M6 46Q5.6 51 6.1 57L7.9 57Q9.4 51 9.8 46.5Q8 45 6 46Z';

const FRONT: [Muscle, string[]][] = [
  ['chest', ['M24.3 21.5L24.3 31Q20 34.5 15 32Q12.8 30 13.2 26Q14 22.5 18 21.8Z']],
  ['sideDelts', [CAP_OUT]],
  ['frontDelts', [CAP_IN]],
  ['biceps', ['M7.2 31Q6.8 36 7.6 41L10.4 41Q11.2 36 11 31.5Q9 29.5 7.2 31Z']],
  ['forearms', [FOREARM]],
  ['abs', [box(20.6, 35.5, 3.8, 5.4, 1.4), box(20.6, 42, 3.8, 5.4, 1.4), box(20.8, 48.5, 3.6, 6, 1.4)]],
  ['thighs', ['M16 62Q15.2 72 17.3 84L22.4 84Q23.4 74 23.6 64Q20 60.5 16 62Z']],
];

const BACK: [Muscle, string[]][] = [
  // Trapez und Lat gehören zu "Oberer Rücken/Lat".
  ['lats', [
    'M24.4 16.5L22.6 17Q19.5 19.8 14.5 21.2Q19.5 24 24.4 29Z',
    'M13 28Q12.8 37 16.3 47.5Q20.5 43.5 23.8 38L23.8 31.5Q18 29.5 13 28Z',
  ]],
  ['sideDelts', [CAP_OUT]],
  ['rearDelts', [CAP_IN]],
  ['triceps', ['M7 30Q6.4 36 7.4 41.5L10.6 41.5Q11.5 36 11.4 30.5Q9.2 28.8 7 30Z']],
  ['forearms', [FOREARM]],
  ['lowerBack', ['M20.5 45Q19 50 19.5 54.5L24.3 54.5L24.3 43Q22.4 43.5 20.5 45Z']],
  ['glutes', ['M15.5 57.5Q15 63.5 19 66Q22.5 67 24.4 65L24.4 57Q20 55.5 15.5 57.5Z']],
  ['thighs', ['M16.2 69Q15.8 77 17.6 85L22.4 85Q23.4 77 23.5 69.5Q20 67.8 16.2 69Z']],
  ['calves', ['M16.9 89Q15.9 95 17.4 101L21.6 101Q23 95 22.6 89.5Q19.8 87.5 16.9 89Z']],
];

// Drei Stufen: nicht trainiert, etwas, viel (ab der Hälfte des meisttrainierten Muskels).
const level = (v: number | undefined) => (!v ? 'body-off' : v >= 0.5 ? 'body-hi' : 'body-mid');

/** Linke Hälfte und gespiegelte rechte Hälfte. */
function Both({ children }: { children: ReactNode }) {
  return <>{children}<g transform="matrix(-1 0 0 1 50 0)">{children}</g></>;
}

function Figure({ regions, load, dx }: { regions: [Muscle, string[]][]; load: Load; dx: number }) {
  // Erst alle Umrisse, dann alle Flächen darüber: so bleibt nur der Außenrand der Silhouette sichtbar.
  return (
    <g transform={`translate(${dx} 0)`}>
      <Both>{BODY.map((d, i) => <path key={i} className="body-edge" d={d} />)}</Both>
      <Both>{BODY.map((d, i) => <path key={i} className="body-base" d={d} />)}</Both>
      <Both>{regions.flatMap(([m, ds]) => ds.map((d, i) => <path key={`${m}${i}`} className={level(load[m])} d={d} />))}</Both>
    </g>
  );
}

/** Zwei kleine Figuren (vorne, hinten); trainierte Muskeln in Akzentfarbe, je mehr Sätze desto kräftiger. */
export function BodyMap({ load }: { load: Load }) {
  const trained = MUSCLES.filter((m) => load[m.id]).map((m) => m.label);
  return (
    <svg className="body-map" viewBox="0 0 110 116" role="img" aria-label={`Trainierte Muskeln: ${trained.join(', ')}`}>
      <Figure regions={FRONT} load={load} dx={0} />
      <Figure regions={BACK} load={load} dx={60} />
    </svg>
  );
}
