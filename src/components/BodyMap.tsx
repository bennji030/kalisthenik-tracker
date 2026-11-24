import type { CSSProperties } from 'react';
import { MUSCLES, type Muscle } from '../muscles';

type Load = Partial<Record<Muscle, number>>;
// Rechteck mit runden Ecken [x, y, Breite, Höhe] oder Ellipse [cx, cy, rx, ry, 'e'].
type Box = [number, number, number, number] | [number, number, number, number, 'e'];

// Eine Figur ist 50 breit und 116 hoch; die meisten Formen gibt es links und gespiegelt rechts.
const W = 50;
const mirror = (b: Box): Box => (b.length === 5 ? [W - b[0], b[1], b[2], b[3], 'e'] : [W - b[0] - b[2], b[1], b[2], b[3]]);
const both = (b: Box): Box[] => [b, mirror(b)];

function shape(b: Box, key: string, className: string, style?: CSSProperties) {
  if (b.length === 5) return <ellipse key={key} className={className} style={style} cx={b[0]} cy={b[1]} rx={b[2]} ry={b[3]} />;
  const [x, y, w, h] = b;
  return <rect key={key} className={className} style={style} x={x} y={y} width={w} height={h} rx={Math.min(w, h) / 2} />;
}

const TORSO = 'M14 20 Q25 17 36 20 Q38 21 37.5 26 L35.5 46 Q35 56 35 62 L15 62 Q15 56 14.5 46 L12.5 26 Q12 21 14 20 Z';
const LIMBS: Box[] = [
  [25, 9, 6.5, 7.5, 'e'], // Kopf
  [22, 13, 6, 8],
  ...[
    [11.5, 24.5, 5, 5, 'e'],
    [6, 23, 7.5, 20],
    [5.5, 41, 6.5, 21],
    [8.75, 64, 3, 3.2, 'e'],
    [15.5, 58, 9.5, 30],
    [16.5, 85, 7.5, 27],
  ].flatMap((b) => both(b as Box)),
];

const FRONT: [Muscle, Box[]][] = [
  ['chest', both([15.5, 23.5, 9, 7.5])],
  ['sideDelts', both([8.8, 25, 2.4, 3.6, 'e'])],
  ['frontDelts', both([13, 25.5, 2.4, 3.8, 'e'])],
  ['biceps', both([7.25, 31, 5, 10])],
  ['forearms', both([6.5, 44, 4.5, 14])],
  ['abs', [[19.5, 34, 11, 21]]],
  ['thighs', both([17, 64, 7, 20])],
];

const BACK: [Muscle, Box[]][] = [
  ['sideDelts', both([8.8, 25, 2.4, 3.6, 'e'])],
  ['rearDelts', both([13, 25.5, 2.4, 3.8, 'e'])],
  ['lats', both([16, 23, 8.5, 18])],
  ['triceps', both([7.25, 29, 5, 12])],
  ['forearms', both([6.5, 44, 4.5, 14])],
  ['lowerBack', [[19, 44, 12, 8.5]]],
  ['glutes', both([16, 57, 8.5, 10])],
  ['thighs', both([17, 69, 7, 15])],
  ['calves', both([17.75, 88, 5, 14])],
];

function Figure({ regions, load, dx }: { regions: [Muscle, Box[]][]; load: Load; dx: number }) {
  return (
    <g transform={`translate(${dx} 0)`}>
      <path className="body-base" d={TORSO} />
      {LIMBS.map((b, i) => shape(b, `l${i}`, 'body-base'))}
      {regions.flatMap(([m, boxes]) => {
        const v = load[m];
        return boxes.map((b, i) =>
          v ? shape(b, `${m}${i}`, 'body-on', { fillOpacity: 0.35 + 0.65 * v }) : shape(b, `${m}${i}`, 'body-off'),
        );
      })}
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
