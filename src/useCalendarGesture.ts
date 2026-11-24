import { useEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { gestureAxis, settle, startAllowed, verticalAllowed } from './calendarGesture';

export interface CalendarGestureActions {
  expanded: boolean;
  /** Monat für den Zug von der Woche aus ein-/ausblenden (ohne den Zustand umzuschalten). */
  peek: (on: boolean) => void;
  open: () => void;
  close: () => void;
  /** n = 1 nächste, -1 vorherige Woche (eingeklappt) bzw. Monat (aufgeklappt). */
  step: (n: number) => void;
}

const SETTLE_MS = 200;
const VELOCITY_WINDOW_MS = 100;

interface Sample { t: number; x: number; y: number }

type Touch = {
  x0: number; y0: number;
  axis: 'x' | 'y' | 'none' | null;
  samples: Sample[];
  v?: VerticalDrag;
};

interface VerticalDrag {
  startP: number;
  weekH: number;
  range: number;
  offset: number;
  rows: HTMLElement;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function velocity(samples: Sample[], endT: number): { vx: number; vy: number } {
  const last = samples[samples.length - 1];
  if (!last || endT - last.t > VELOCITY_WINDOW_MS) return { vx: 0, vy: 0 };
  const first = samples.find((s) => last.t - s.t <= VELOCITY_WINDOW_MS) ?? last;
  const dt = last.t - first.t;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

/** Wischgesten auf dem Kalender: runter/hoch = Monat auf/zu, links/rechts = nächste/vorherige Woche bzw. Monat. */
export function useCalendarGesture(
  calRef: RefObject<HTMLDivElement | null>,
  bodyRef: RefObject<HTMLDivElement | null>,
  actions: CalendarGestureActions,
  active: boolean,
) {
  const act = useRef(actions);
  act.current = actions;

  useEffect(() => {
    const cal = calRef.current;
    const body = bodyRef.current;
    if (!active || !cal || !body) return;

    let touch: Touch | null = null;
    let target: EventTarget | null = null;
    let settling = false;
    let suppressClick = false;

    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const content = () => body.firstElementChild as HTMLElement | null;

    // Nach der Animation (bei reduzierter Bewegung sofort) Endzustand setzen und Inline-Stile löschen.
    const finish = (apply: () => void, cleanup: () => void) => {
      const done = () => {
        apply();
        body.classList.remove('cal-settle');
        body.removeAttribute('data-drag');
        cleanup();
        settling = false;
      };
      if (reduced()) done();
      else setTimeout(done, SETTLE_MS);
    };

    const setVertical = (v: VerticalDrag, p: number) => {
      body.style.height = `${v.weekH + p * v.range}px`;
      v.rows.style.transform = `translateY(${-v.offset * (1 - p)}px)`;
    };

    const claimVertical = (expanded: boolean): VerticalDrag | null => {
      if (!expanded) flushSync(() => act.current.peek(true));
      const rows = body.querySelector<HTMLElement>('.cal-rows');
      const head = body.querySelector<HTMLElement>('.cal-head');
      const first = rows?.firstElementChild as HTMLElement | null;
      if (!rows || !head || !first) return null;
      const pad = body.offsetHeight - (body.firstElementChild as HTMLElement).offsetHeight;
      const weekH = pad + head.offsetHeight + first.offsetHeight;
      const selRow = body.querySelector('.day-sel')?.parentElement as HTMLElement | null | undefined;
      const offset = selRow && selRow.parentElement === rows ? selRow.offsetTop : 0;
      return { startP: expanded ? 1 : 0, weekH, range: body.offsetHeight - weekH, offset, rows };
    };

    // Touch-Events gehen immer an das Start-Element, auch wenn React es währenddessen ersetzt (Woche -> Monat).
    const unlisten = () => {
      target?.removeEventListener('touchmove', onMove as EventListener);
      target?.removeEventListener('touchend', release as EventListener);
      target?.removeEventListener('touchcancel', cancel);
      target = null;
    };

    const onStart = (e: TouchEvent) => {
      unlisten();
      touch = null;
      if (settling || e.touches.length !== 1 || !startAllowed(e.touches[0].clientX)) return;
      const t = e.touches[0];
      touch = { x0: t.clientX, y0: t.clientY, axis: null, samples: [{ t: e.timeStamp, x: t.clientX, y: t.clientY }] };
      const tgt = e.target as EventTarget;
      target = tgt;
      tgt.addEventListener('touchmove', onMove as EventListener, { passive: false });
      tgt.addEventListener('touchend', release as EventListener);
      tgt.addEventListener('touchcancel', cancel);
    };

    const onMove = (e: TouchEvent) => {
      if (!touch) return;
      if (e.touches.length !== 1) { cancel(); return; }
      const t = e.touches[0];
      const dx = t.clientX - touch.x0;
      const dy = t.clientY - touch.y0;
      touch.samples.push({ t: e.timeStamp, x: t.clientX, y: t.clientY });
      touch.samples = touch.samples.filter((s) => e.timeStamp - s.t <= VELOCITY_WINDOW_MS);

      if (touch.axis === null) {
        const axis = gestureAxis(dx, dy);
        if (axis === null) return;
        touch.axis = axis;
        if (axis === 'y') {
          if (!verticalAllowed(act.current.expanded, dy, window.scrollY)) touch.axis = 'none';
          else {
            touch.v = claimVertical(act.current.expanded) ?? undefined;
            if (!touch.v) touch.axis = 'none';
          }
        }
        if (touch.axis !== 'none') {
          suppressClick = true;
          body.setAttribute('data-drag', '');
        }
      }
      if (touch.axis === 'none') return;
      e.preventDefault();
      if (touch.axis === 'x') {
        const el = content();
        if (el) el.style.transform = `translateX(${dx}px)`;
      } else if (touch.v) {
        setVertical(touch.v, clamp(touch.v.startP + dy / touch.v.range, 0, 1));
      }
    };

    const release = (e: TouchEvent | null) => {
      const tc = touch;
      touch = null;
      unlisten();
      if (!tc || (tc.axis !== 'x' && tc.axis !== 'y')) return;
      if (suppressClick) setTimeout(() => { suppressClick = false; }, 350);
      const t = e?.changedTouches[0];
      const dx = t ? t.clientX - tc.x0 : 0;
      const dy = t ? t.clientY - tc.y0 : 0;
      const { vx, vy } = e ? velocity(tc.samples, e.timeStamp) : { vx: 0, vy: 0 };
      settling = true;
      body.classList.add('cal-settle');

      if (tc.axis === 'x') {
        const el = content();
        const width = body.offsetWidth;
        const s = e ? settle(dx, vx, width) : 0;
        if (el) el.style.transform = `translateX(${s * width}px)`;
        finish(
          () => { if (s !== 0) flushSync(() => act.current.step(s < 0 ? 1 : -1)); },
          () => { if (el) el.style.transform = ''; },
        );
      } else if (tc.v) {
        const v = tc.v;
        const expanded = v.startP === 1;
        const s = e ? settle(dy, vy, v.range) : 0;
        const commit = expanded ? s === -1 : s === 1;
        setVertical(v, commit ? 1 - v.startP : v.startP);
        finish(
          () => {
            flushSync(() => {
              if (commit) (expanded ? act.current.close : act.current.open)();
              else if (!expanded) act.current.peek(false);
            });
          },
          () => { body.style.height = ''; v.rows.style.transform = ''; },
        );
      }
    };
    const cancel = () => release(null);

    const onClick = (e: MouseEvent) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    };

    cal.addEventListener('touchstart', onStart, { passive: true });
    cal.addEventListener('click', onClick, true);
    return () => {
      cal.removeEventListener('touchstart', onStart);
      unlisten();
      cal.removeEventListener('click', onClick, true);
    };
  }, [calRef, bodyRef, active]);
}
