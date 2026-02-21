import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';

export const ParentAuthModal = ({ onSuccess, onClose }) => {
  const [mode, setMode] = useState('verify'); // verify | setup
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const pinRefs = [null, null, null, null];

  const pinString = pin.join('');
  const confirmString = confirmPin.join('');

  const handleDigit = (idx, val, arr, setArr, nextRefs) => {
    if (!/^\d?$/.test(val)) return;
    const updated = [...arr];
    updated[idx] = val;
    setArr(updated);
    if (val && idx < 3) nextRefs[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e, arr, setArr, refs) => {
    if (e.key === 'Backspace' && !arr[idx] && idx > 0) {
      refs[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    if (pinString.length !== 4) return;
    setLoading(true);
    try {
      const { data } = await api.post('/parent/verify-pin', { pin: pinString });
      localStorage.setItem('storycraft_parent_token', data.parent_token);
      toast.success('Welcome, Parent!');
      onSuccess(data.parent_token);
    } catch (err) {
      if (err.response?.status === 400) {
        setMode('setup');
        toast.info('No PIN set yet. Create one to access Parent View.');
      } else {
        toast.error('Incorrect PIN. Please try again.');
        setPin(['', '', '', '']);
      }
    }
    setLoading(false);
  };

  const handleSetup = async () => {
    if (pinString.length !== 4 || confirmString.length !== 4) return;
    if (pinString !== confirmString) {
      toast.error('PINs do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/parent/set-pin', { pin: pinString });
      toast.success('Parent PIN created!');
      // Auto-verify
      const { data } = await api.post('/parent/verify-pin', { pin: pinString });
      localStorage.setItem('storycraft_parent_token', data.parent_token);
      onSuccess(data.parent_token);
    } catch (err) {
      toast.error('Could not set PIN');
    }
    setLoading(false);
  };

  const PinInput = ({ arr, setArr, label, refs }) => (
    <div>
      {label && <p className="text-xs font-semibold mb-2 text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>{label}</p>}
      <div className="flex gap-3 justify-center">
        {arr.map((digit, idx) => (
          <input
            key={idx}
            ref={el => { refs[idx] = el; }}
            type={showPin ? 'text' : 'password'}
            maxLength={1}
            value={digit}
            inputMode="numeric"
            onChange={e => handleDigit(idx, e.target.value, arr, setArr, refs)}
            onKeyDown={e => handleKeyDown(idx, e, arr, setArr, refs)}
            data-testid={`pin-input-${idx}`}
            className="w-12 h-14 text-center text-2xl font-bold rounded-2xl border-2 outline-none transition-all focus:scale-105"
            style={{
              background: 'hsl(var(--muted))',
              borderColor: digit ? 'hsl(var(--primary))' : 'var(--glass-border)',
              color: 'hsl(var(--foreground))',
            }}
          />
        ))}
      </div>
    </div>
  );

  const verifyRefs = [null, null, null, null];
  const confirmRefs = [null, null, null, null];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="w-full max-w-xs glass-panel rounded-3xl overflow-hidden shadow-2xl"
          data-testid="parent-auth-modal"
        >
          <div className="px-6 pt-6 pb-2 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'hsl(var(--primary) / 0.12)' }}>
                <Lock className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <div>
                <p className="font-bold text-base" style={{ color: 'hsl(var(--foreground))' }}>
                  {mode === 'setup' ? 'Create Parent PIN' : 'Parent View'}
                </p>
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {mode === 'setup' ? 'Set a 4-digit PIN' : 'Enter your 4-digit PIN'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/10"
              style={{ color: 'hsl(var(--muted-foreground))' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 pb-6 pt-4 space-y-5">
            {mode === 'verify' ? (
              <PinInput arr={pin} setArr={setPin} refs={verifyRefs} />
            ) : (
              <>
                <PinInput arr={pin} setArr={setPin} label="New PIN" refs={verifyRefs} />
                <PinInput arr={confirmPin} setArr={setConfirmPin} label="Confirm PIN" refs={confirmRefs} />
              </>
            )}

            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setShowPin(v => !v)}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: 'hsl(var(--muted-foreground))' }}>
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPin ? 'Hide' : 'Show'} digits
              </button>
            </div>

            <Button
              onClick={mode === 'verify' ? handleVerify : handleSetup}
              disabled={loading || (mode === 'verify' ? pinString.length !== 4 : pinString.length !== 4 || confirmString.length !== 4)}
              data-testid="parent-pin-submit-btn"
              className="w-full rounded-2xl font-semibold h-12"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              {loading ? 'Checking...' : mode === 'verify' ? 'Enter Parent View' : 'Create PIN & Enter'}
            </Button>

            {mode === 'verify' && (
              <button onClick={() => setMode('setup')} data-testid="parent-setup-pin-link"
                className="w-full text-center text-xs"
                style={{ color: 'hsl(var(--primary))' }}>
                First time? Create a PIN
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
