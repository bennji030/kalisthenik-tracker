import { monthGrid, type DayStatus } from '../calendar';
import { WEEKDAYS } from '../util';
import { dayTs } from '../weight';

const HEAD = [1, 2, 3, 4, 5, 6, 0].map((d) => WEEKDAYS[d]);
const LABEL: Record<DayStatus, string> = {
  done: ', erledigt', open: ', geplant', missed: ', verpasst', none: '',
  cardio: ', Cardio erledigt', 'cardio-open': ', Cardio geplant',
};

export function DayCell({ dayKey, status, today, selected, onSelect }: {
  dayKey: string;
  status: DayStatus;
  today: boolean;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const d = new Date(dayTs(dayKey));
  const label = `${WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${LABEL[status]}`;
  return (
    <button
      className={`day day-${status}${today ? ' day-today' : ''}${selected ? ' day-sel' : ''}`}
      aria-label={label}
      aria-pressed={selected}
      onClick={() => onSelect(dayKey)}
    >
      {d.getDate()}
    </button>
  );
}

export function DayHeader() {
  return <div className="cal-row cal-head">{HEAD.map((w) => <span key={w}>{w}</span>)}</div>;
}

export function MonthGrid({ year, month, todayKey, selectedKey, statusOf, onSelect }: {
  year: number;
  month: number;
  todayKey: string;
  selectedKey: string;
  statusOf: (key: string) => DayStatus;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="cal-month">
      <DayHeader />
      <div className="cal-rows">
        {monthGrid(year, month).map((week, i) => (
          <div className="cal-row" key={i}>
            {week.map((k, j) => k
              ? <DayCell key={k} dayKey={k} status={statusOf(k)} today={k === todayKey} selected={k === selectedKey} onSelect={onSelect} />
              : <span key={`e${j}`} className="day-empty" />)}
          </div>
        ))}
      </div>
    </div>
  );
}
