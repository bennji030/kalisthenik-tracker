import { useEffect, useState, type ReactNode } from 'react';
import { seedIfEmpty } from './seed';
import { activeSession } from './sessions';
import { Home } from './screens/Home';
import { Training } from './screens/Training';
import { Workout } from './screens/Workout';
import { History, type HistoryTab } from './screens/History';
import { PlanScreen } from './screens/PlanEditor';
import { Settings } from './screens/Settings';

type Tab = 'home' | 'training' | 'history' | 'plan';

const ICONS: Record<Tab, ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5M6 10v9h12v-9M10 19v-5h4v5" />,
  training: <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  history: <path d="M4 19h16M5 15l4-5 4 3 6-7" />,
  plan: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
};

export function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [historyTab, setHistoryTab] = useState<HistoryTab>('sessions');
  const [settings, setSettings] = useState(false);
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

  const go = (t: Tab) => { setWorkoutId(null); setSettings(false); setHistoryTab('sessions'); setTab(t); window.scrollTo(0, 0); };

  const openSettings = () => { setSettings(true); window.scrollTo(0, 0); };
  const goHistory = (t: HistoryTab) => { go('history'); setHistoryTab(t); };

  return (
    <>
      <main>
        {workoutId ? (
          <Workout sessionId={workoutId} onClose={(m) => { setWorkoutId(null); if (m) toast(m); window.scrollTo(0, 0); }} />
        ) : settings ? (
          <Settings toast={toast} onBack={() => go('home')} goHistory={goHistory} />
        ) : tab === 'home' ? (
          <Home goTraining={() => go('training')} goSettings={openSettings} goHistory={goHistory} />
        ) : tab === 'training' ? (
          <Training onOpen={(id) => { setWorkoutId(id); window.scrollTo(0, 0); }} />
        ) : tab === 'history' ? (
          <History initialTab={historyTab} />
        ) : tab === 'plan' ? (
          <PlanScreen />
        ) : null}
      </main>
      {!workoutId && (
        <nav className="tabbar">
          {([['home', 'Home'], ['training', 'Training'], ['history', 'Verlauf'], ['plan', 'Plan']] as const).map(([t, label]) => (
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
