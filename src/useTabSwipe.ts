import { useEffect, useRef, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { startAllowed, touchAxis } from './calendarGesture';
import { rubberBand, swipeStep } from './tabSwipe';

const OUT_MS = 120;
const VELOCITY_WINDOW_MS = 100;
const NO_SWIPE = '.cal, .confirm, [data-no-swipe], input, textarea, select';

interface Sample { t: number; x: number }
type Touch = { x0: number; y0: number; axis: 'x' | 'y' | 'none' | null; samples: Sample[] };

function velocityX(samples: Sample[], endT: number): number {
  const last = samples[samples.length - 1];
  if (!last || endT - last.t > VELOCITY_WINDOW_MS) return 0;
  const first = samples.find((s) => last.t - s.t <= VELOCITY_WINDOW_MS) ?? last;
  const dt = last.t - first.t;
  return dt > 0 ? (last.x - first.x) / dt : 0;
}

function scrollsHorizontally(el: Element | null): boolean {
  for (; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth) continue;
    const ox = getComputedStyle(el).overflowX;
    if (ox === 'auto' || ox === 'scroll') return true;
  }
  return false;
}

function blocked(target: Element): boolean {
  if (target.closest(NO_SWIPE)) return true;
  const f = document.activeElement;
  if (f && f.matches('input, textarea, select')) return true;
  return scrollsHorizontally(target);
}

/** Wischen links/rechts auf der Seite wechselt zwischen den Tabs. step: 1 nächster, -1 vorheriger; hasNeighbour sagt, ob es ihn gibt. */
export function useTabSwipe(
  mainRef: RefObject<HTMLElement | null>,
  active: boolean,
  hasNeighbour: (dir: 1 | -1) => boolean,
  step: (dir: 1 | -1) => void,
) {
  const hasN = useRef(hasNeighbour);
  hasN.current = hasNeighbour;
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const main = mainRef.current;
    if (!active || !main) return;

    let touch: Touch | null = null;
    let target: EventTarget | null = null;
    let busy = false;
    let suppressClick = false;

    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const unlisten = () => {
      target?.removeEventListener('touchmove', onMove as EventListener);
      target?.removeEventListener('touchend', release as EventListener);
      target?.removeEventListener('touchcancel', cancel);
      target = null;
    };

    const reset = () => {
      main.classList.remove('tab-settle', 'tab-in-next', 'tab-in-prev');
      main.style.transform = '';
      main.style.opacity = '';
    };

    const onStart = (e: TouchEvent) => {
      unlisten();
      touch = null;
      if (busy || e.touches.length !== 1 || !startAllowed(e.touches[0].clientX) || blocked(e.target as Element)) return;
      const t = e.touches[0];
      touch = { x0: t.clientX, y0: t.clientY, axis: null, samples: [{ t: e.timeStamp, x: t.clientX }] };
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
      touch.samples.push({ t: e.timeStamp, x: t.clientX });
      touch.samples = touch.samples.filter((s) => e.timeStamp - s.t <= VELOCITY_WINDOW_MS);
      if (touch.axis === null) {
        const axis = touchAxis(dx, dy);
        if (axis === null) return;
        touch.axis = axis;
        if (axis === 'x') suppressClick = true;
      }
      if (touch.axis !== 'x') return;
      if (e.cancelable) e.preventDefault();
      const dir = dx < 0 ? 1 : -1;
      main.style.transform = `translateX(${hasN.current(dir) ? dx : rubberBand(dx, main.offsetWidth)}px)`;
    };

    const release = (e: TouchEvent | null) => {
      const tc = touch;
      touch = null;
      unlisten();
      if (!tc || tc.axis !== 'x') return;
      if (suppressClick) setTimeout(() => { suppressClick = false; }, 350);
      const dx = e ? e.changedTouches[0].clientX - tc.x0 : 0;
      const vx = e ? velocityX(tc.samples, e.timeStamp) : 0;
      const width = main.offsetWidth;
      const s = e ? swipeStep(dx, vx, width) : 0;
      const commit = s !== 0 && hasN.current(s);
      busy = true;
      if (!commit) {
        if (reduced()) { reset(); busy = false; return; }
        main.classList.add('tab-settle');
        main.style.transform = '';
        setTimeout(() => { reset(); busy = false; }, OUT_MS + 80);
        return;
      }
      const change = () => {
        reset();
        flushSync(() => stepRef.current(s));
        if (!reduced()) {
          main.classList.add(s === 1 ? 'tab-in-next' : 'tab-in-prev');
          setTimeout(() => { reset(); busy = false; }, 220);
        } else busy = false;
      };
      if (reduced()) { change(); return; }
      main.classList.add('tab-settle');
      main.style.transform = `translateX(${-s * width * 0.25}px)`;
      main.style.opacity = '0';
      setTimeout(change, OUT_MS);
    };
    const cancel = () => release(null);

    const onClick = (e: MouseEvent) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('touchstart', onStart);
      unlisten();
      document.removeEventListener('click', onClick, true);
      reset();
    };
  }, [mainRef, active]);
}
