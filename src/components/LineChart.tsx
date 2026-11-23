interface Point {
  x: number;
  y: number;
  label: string;
}

/** Ohne `line` ist `points` Linie und Punkte; mit `line` sind `points` nur Punkte und `line` die Linie. */
export function LineChart({ points, unit, line, emptyText }: { points: Point[]; unit: string; line?: Point[]; emptyText?: string }) {
  if (points.length < 2) return <p className="muted small">{emptyText ?? 'Ab zwei Trainings gibt es hier eine Kurve.'}</p>;
  const path = line ?? points;
  const all = line ? [...points, ...line] : points;
  const W = 340, H = 160, P = { l: 36, r: 10, t: 12, b: 22 };
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.1; y0 -= pad; y1 += pad;
  const sx = (x: number) => P.l + ((x - x0) / (x1 - x0 || 1)) * (W - P.l - P.r);
  const sy = (y: number) => H - P.b - ((y - y0) / (y1 - y0)) * (H - P.t - P.b);
  const d = path.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const ticks = [y0 + pad, (y0 + y1) / 2, y1 - pad];
  const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString('de-DE');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Verlauf in ${unit}`}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} className="chart-grid" />
          <text x={P.l - 6} y={sy(t) + 4} textAnchor="end" className="chart-tick">{fmt(t)}</text>
        </g>
      ))}
      <path d={d} className="chart-line" />
      {points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.5} className="chart-dot" />)}
      <text x={P.l} y={H - 4} className="chart-tick">{points[0].label}</text>
      <text x={W - P.r} y={H - 4} textAnchor="end" className="chart-tick">{points[points.length - 1].label}</text>
    </svg>
  );
}
