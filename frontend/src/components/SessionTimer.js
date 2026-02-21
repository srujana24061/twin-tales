import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

const SESSION_START_KEY = 'storycraft_session_start';
const WARNING_SHOWN_KEY = 'storycraft_warning_shown';

export const SessionTimer = () => {
  const [warningLevel, setWarningLevel] = useState(null); // null | 'soon' | 'over'
  const [remainingMin, setRemainingMin] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef(null);

  const getCapMinutes = useCallback(async () => {
    try {
      const { data } = await api.get('/wellbeing/settings');
      if (!data.session_cap_enabled) return null;
      return data.session_cap_minutes || 25;
    } catch {
      return 25;
    }
  }, []);

  useEffect(() => {
    // Mark session start
    const startTime = localStorage.getItem(SESSION_START_KEY);
    const today = new Date().toDateString();
    if (!startTime || !startTime.startsWith(today)) {
      localStorage.setItem(SESSION_START_KEY, `${today}:${Date.now()}`);
      localStorage.removeItem(WARNING_SHOWN_KEY);
    }

    let capMinutes = null;

    const checkTime = async () => {
      if (!capMinutes) capMinutes = await getCapMinutes();
      if (!capMinutes) return;

      const stored = localStorage.getItem(SESSION_START_KEY);
      if (!stored) return;

      const startMs = parseInt(stored.split(':')[1]);
      const elapsed = (Date.now() - startMs) / 1000 / 60; // minutes
      const remaining = capMinutes - elapsed;

      setRemainingMin(Math.ceil(remaining));

      if (remaining <= 0 && warningLevel !== 'over') {
        setWarningLevel('over');
        setDismissed(false);
      } else if (remaining <= 5 && remaining > 0 && warningLevel !== 'soon') {
        setWarningLevel('soon');
        setDismissed(false);
      }
    };

    checkTime();
    intervalRef.current = setInterval(checkTime, 60000); // check every minute

    return () => clearInterval(intervalRef.current);
  }, []); // eslint-disable-line

  if (!warningLevel || dismissed) return null;

  const isSoon = warningLevel === 'soon';
  const isOver = warningLevel === 'over';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] w-full max-w-sm px-4"
        data-testid="session-timer-banner"
      >
        <div
          className="glass-panel rounded-2xl px-5 py-3.5 shadow-2xl flex items-center gap-3"
          style={{
            background: isOver
              ? 'rgba(245, 158, 11, 0.18)'
              : 'rgba(99, 102, 241, 0.14)',
            borderColor: isOver
              ? 'rgba(245, 158, 11, 0.35)'
              : 'rgba(99, 102, 241, 0.25)',
          }}
        >
          <span className="text-2xl flex-shrink-0">
            {isOver ? '🌙' : '⏰'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight" style={{ color: 'hsl(var(--foreground))' }}>
              {isOver
                ? 'Great creative session!'
                : `${remainingMin} min${remainingMin === 1 ? '' : 's'} left`}
            </p>
            <p className="text-xs mt-0.5 leading-tight" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {isOver
                ? 'Time to take a break and dream up new stories!'
                : 'Almost time to wrap up for today'}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            data-testid="session-timer-dismiss"
            className="text-xs font-medium px-3 py-1.5 rounded-full flex-shrink-0 transition-all hover:scale-105"
            style={{
              background: isOver ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.15)',
              color: 'hsl(var(--foreground))',
            }}
          >
            {isOver ? 'Take a break' : 'OK!'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
