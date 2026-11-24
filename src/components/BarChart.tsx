interface Bar {
  label: string;
  value: number | null;
}

/**
 * Säulen ab 0 mit Wert darüber und Label darunter; null lässt den Platz leer. `goal` zieht eine gestrichelte Linie.
 * `line` ist eine zweite Reihe (ein Wert pro Säule) als Linie mit Punkten, ohne Zahlen.
 */
export function BarChart({ bars, fmt, goal, line, tone = 'accent', label }: {
  bars: Bar[]; fmt: (v: number) => string; goal?: number; line?: (number | null)[]; tone?: 'accent' | 'cardio'; label: string;
}) {
  const W = 340, H = 160, P = { l: 14, r: goal != null ? 40 : 14, t: 22, b: 22 };
  const max = Math.max(1, goal ?? 0, ...bars.map((b) => b.value ?? 0), ...(line ?? []).map((v) => v ?? 0));
  const sy = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const slot = (W - P.l - P.r) / bars.length;
  const bw = Math.min(28, slot * 0.6);
  const pts = (line ?? []).flatMap((v, i) => (v == null ? [] : [{ x: P.l + slot * (i + 0.5), y: sy(v) }]));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
      <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} className="chart-grid" />
      {goal != null && (
        <g>
          <line x1={P.l} x2={W - P.r + 4} y1={sy(goal)} y2={sy(goal)} className="chart-goal" />
          <text x={W - P.r + 7} y={sy(goal) + 3} className="chart-tick">{fmt(goal)}</text>
        </g>
      )}
      {bars.map((b, i) => {
        const cx = P.l + slot * (i + 0.5);
        return (
          <g key={i}>
            {b.value != null && <rect x={cx - bw / 2} y={sy(b.value)} width={bw} height={H - P.b - sy(b.value)} rx={3} className={`chart-bar chart-bar-${tone}`} />}
            <text x={cx} y={H - 4} textAnchor="middle" className="chart-tick">{b.label}</text>
          </g>
        );
      })}
      {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} className="chart-line2" />}
      {pts.map((p) => <circle key={p.x} cx={p.x} cy={p.y} r={3} className="chart-dot2" />)}
      {/* Zahlen zuletzt, damit die Linie sie nicht überdeckt. */}
      {bars.map((b, i) => b.value != null && (
        <text key={i} x={P.l + slot * (i + 0.5)} y={sy(b.value) - 5} textAnchor="middle" className="chart-value">{fmt(b.value)}</text>
      ))}
    </svg>
  );
}
