import { useEffect, useState, type ReactNode } from 'react';
import { seedIfEmpty } from './seed';
import { activeSession } from './sessions';
import { Home } from './screens/Home';
import { Workout } from './screens/Workout';
import { History } from './screens/History';
import { PlanScreen } from './screens/PlanEditor';
import { More } from './screens/More';

type Tab = 'home' | 'history' | 'plan' | 'more';

const ICONS: Record<Tab, ReactNode> = {
  home: <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  history: <path d="M4 19h16M5 15l4-5 4 3 6-7" />,
  plan: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  more: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />,
};

export function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      await seedIfEmpty();
      // Dauerhaften Speicher anfragen (iOS: vor allem relevant als Home-Bildschirm-App).
      try { await navigator.storage?.persist?.(); } catch { /* egal */ }
      const a = await activeSession();
      if (a) setWorkoutId(a.id);
      setReady(true);
    })();
  }, []);

  const toast = (m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), 2600);
  };

  if (!ready) return null;

  const go = (t: Tab) => { setWorkoutId(null); setTab(t); window.scrollTo(0, 0); };

  return (
    <>
      <main>
        {workoutId ? (
          <Workout sessionId={workoutId} onClose={(m) => { setWorkoutId(null); if (m) toast(m); window.scrollTo(0, 0); }} />
        ) : tab === 'home' ? (
          <Home onOpen={(id) => { setWorkoutId(id); window.scrollTo(0, 0); }} goBackup={() => go('more')} />
        ) : tab === 'history' ? (
          <History />
        ) : tab === 'plan' ? (
          <PlanScreen />
        ) : (
          <More toast={toast} />
        )}
      </main>
      {!workoutId && (
        <nav className="tabbar">
          {([['home', 'Training'], ['history', 'Verlauf'], ['plan', 'Plan'], ['more', 'Backup']] as const).map(([t, label]) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => go(t)}>
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
