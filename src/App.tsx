import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getMeta } from './db';
import { applyTheme, parseThemePref, resolveTheme } from './theme';
import { seedIfEmpty } from './seed';
import { ensureCardioDayInDb } from './cardio';
import { activeSession } from './sessions';
import { adjacentTab } from './tabSwipe';
import { useTabSwipe } from './useTabSwipe';
import { useHealthSync } from './useHealthSync';
import { Home } from './screens/Home';
import { Training } from './screens/Training';
import { Workout } from './screens/Workout';
import { History, type HistoryTab } from './screens/History';
import { PlanScreen } from './screens/PlanEditor';
import { HabitMonths, type HabitKind } from './screens/HabitMonths';
import { Settings } from './screens/Settings';
import { DayValues, type DayView } from './screens/DayValues';

type Tab = 'home' | 'training' | 'history' | 'plan';

const TABS: readonly (readonly [Tab, string])[] = [['home', 'Home'], ['training', 'Training'], ['history', 'Statistik'], ['plan', 'Plan']];
const ORDER = TABS.map(([t]) => t);

const ICONS: Record<Tab, ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5M6 10v9h12v-9M10 19v-5h4v5" />,
  training: <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  history: <path d="M4 19h16M5 15l4-5 4 3 6-7" />,
  plan: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
};

export function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('training');
  const [settings, setSettings] = useState(false);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [habitView, setHabitView] = useState<HabitKind | null>(null);
  const [dayView, setDayView] = useState<DayView | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    void (async () => {
      await seedIfEmpty();
      await ensureCardioDayInDb();
      // Dauerhaften Speicher anfragen (iOS: vor allem relevant als Home-Bildschirm-App).
      try { await navigator.storage?.persist?.(); } catch { /* egal */ }
      const a = await activeSession();
      if (a) setWorkoutId(a.id);
      setReady(true);
    })();
  }, []);

  useHealthSync(ready);

  const storedTheme = useLiveQuery(async () => ({ value: await getMeta<unknown>('theme', undefined) }), []);
  useEffect(() => {
    if (!storedTheme) return;
    const pref = parseThemePref(storedTheme.value);
    try { localStorage.setItem('theme', pref); } catch { /* egal */ }
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    applyTheme(resolveTheme(pref, mq.matches));
    if (pref !== 'system') return;
    const onChange = () => applyTheme(resolveTheme(pref, mq.matches));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [storedTheme]);

  const toast = (m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), 2600);
  };

  const swipeActive = ready && !workoutId && !settings && !habitView && !dayView;
  useTabSwipe(mainRef, swipeActive, (dir) => adjacentTab(ORDER, tab, dir) !== null, (dir) => {
    const next = adjacentTab(ORDER, tab, dir);
    if (next) go(next);
  });

  if (!ready) return null;

  const go = (t: Tab) => { setWorkoutId(null); setSettings(false); setHabitView(null); setDayView(null); setHistoryTab('training'); setTab(t); window.scrollTo(0, 0); };

  const openSettings = () => { setSettings(true); window.scrollTo(0, 0); };
  const goHistory = (t: HistoryTab) => { go('history'); setHistoryTab(t); };

  return (
    <>
      <main ref={mainRef}>
        {workoutId ? (
          <Workout sessionId={workoutId} onDone={() => go('home')} onClose={(m) => { setWorkoutId(null); if (m) toast(m); window.scrollTo(0, 0); }} />
        ) : settings ? (
          <Settings toast={toast} onBack={() => go('home')} goHistory={goHistory} />
        ) : tab === 'home' && habitView ? (
          <HabitMonths kind={habitView} onBack={() => { setHabitView(null); window.scrollTo(0, 0); }} goHistory={goHistory} />
        ) : tab === 'home' && dayView ? (
          <DayValues view={dayView} toast={toast} onBack={() => { setDayView(null); window.scrollTo(0, 0); }} />
        ) : tab === 'home' ? (
          <Home goTraining={() => go('training')} goSettings={openSettings} goHabit={(k) => { setHabitView(k); window.scrollTo(0, 0); }}
            goDay={(v) => { setDayView(v); window.scrollTo(0, 0); }}
            openWorkout={(id) => { setWorkoutId(id); window.scrollTo(0, 0); }} goWeight={() => goHistory('weight')} />
        ) : tab === 'training' ? (
          <Training onOpen={(id) => { setWorkoutId(id); window.scrollTo(0, 0); }} />
        ) : tab === 'history' && dayView ? (
          <DayValues view={dayView} toast={toast} onBack={() => { setDayView(null); window.scrollTo(0, 0); }} />
        ) : tab === 'history' ? (
          <History initialTab={historyTab} goDay={(v) => { setHistoryTab('nutrition'); setDayView(v); window.scrollTo(0, 0); }} />
        ) : tab === 'plan' ? (
          <PlanScreen />
        ) : null}
      </main>
      {!workoutId && (
        <nav className="tabbar">
          {TABS.map(([t, label]) => (
            <button key={t} className={tab === t ? ((t === 'home' && (settings || habitView || dayView)) || (t === 'history' && dayView) ? 'sub' : 'on') : ''} onClick={() => go(t)}>
              <svg className="tab-icon" viewBox="0 0 24 24" aria-hidden="true">{ICONS[t]}</svg>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}
