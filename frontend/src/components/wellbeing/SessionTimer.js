import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

const SESSION_START_KEY = 'storycraft_session_start';

export const SessionTimer = () => {
  const [settings, setSettings] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    loadSettings();
    initSession();
    const interval = setInterval(() => {
      updateElapsed();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/wellbeing/settings');
      setSettings(data);
    } catch (_) {}
  };

  const initSession = () => {
    const start = localStorage.getItem(SESSION_START_KEY);
    if (!start) {
      localStorage.setItem(SESSION_START_KEY, Date.now().toString());
    }
  };

  const updateElapsed = () => {
    const start = localStorage.getItem(SESSION_START_KEY);
    if (!start) return;
    const elapsedMs = Date.now() - parseInt(start, 10);
    const elapsedMin = Math.floor(elapsedMs / 60000);
    setElapsed(elapsedMin);

    if (!settings || !settings.session_cap_enabled) return;
    const cap = settings.session_cap_minutes || 25;
    const remaining = cap - elapsedMin;

    if (remaining <= 5 && remaining > 0) {
      setVisible(true);
    }

    if (remaining === 3 && !sessionStorage.getItem('timer_warning_shown')) {
      toast.warning(`Only ${remaining} minutes left!`, { duration: 5000 });
      sessionStorage.setItem('timer_warning_shown', 'true');
    }

    if (remaining <= 0 && !sessionStorage.getItem('timer_limit_shown')) {
      toast.error('Session time is up! Time to take a break.', { duration: 10000 });
      sessionStorage.setItem('timer_limit_shown', 'true');
    }
  };

  if (!settings || !settings.session_cap_enabled || !visible) return null;

  const cap = settings.session_cap_minutes || 25;
  const remaining = Math.max(0, cap - elapsed);
  const isWarning = remaining <= 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        data-testid="session-timer"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
        style={{
          background: isWarning ? 'rgba(239,68,68,0.15)' : 'hsl(var(--muted))',
          color: isWarning ? '#EF4444' : 'hsl(var(--foreground))'
        }}>
        {isWarning ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
        <span data-testid="timer-text">{remaining} min left</span>
      </motion.div>
    </AnimatePresence>
  );
};