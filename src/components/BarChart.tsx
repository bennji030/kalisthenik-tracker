interface Bar {
  label: string;
  value: number | null;
}

/** Säulen ab 0 mit Wert darüber und Label darunter; null lässt den Platz leer. `goal` zieht eine gestrichelte Linie. */
export function BarChart({ bars, fmt, goal, tone = 'accent', label }: { bars: Bar[]; fmt: (v: number) => string; goal?: number; tone?: 'accent' | 'cardio'; label: string }) {
  const W = 340, H = 160, P = { l: 14, r: goal != null ? 40 : 14, t: 22, b: 22 };
  const max = Math.max(1, goal ?? 0, ...bars.map((b) => b.value ?? 0));
  const sy = (v: number) => H - P.b - (v / max) * (H - P.t - P.b);
  const slot = (W - P.l - P.r) / bars.length;
  const bw = Math.min(28, slot * 0.6);
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
            {b.value != null && (
              <>
                <rect x={cx - bw / 2} y={sy(b.value)} width={bw} height={H - P.b - sy(b.value)} rx={3} className={`chart-bar chart-bar-${tone}`} />
                <text x={cx} y={sy(b.value) - 5} textAnchor="middle" className="chart-value">{fmt(b.value)}</text>
              </>
            )}
            <text x={cx} y={H - 4} textAnchor="middle" className="chart-tick">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
