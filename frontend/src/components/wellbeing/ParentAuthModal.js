import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';

export const ParentAuthModal = ({ onSuccess, onClose }) => {
  const [pin, setPin] = useState('');
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPinSet, setHasPinSet] = useState(null);

  useEffect(() => {
    checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    try {
      const { data } = await api.get('/wellbeing/settings');
      setHasPinSet(data.parent_pin_set || false);
    } catch (_) {
      setHasPinSet(false);
    }
  };

  const handleSetPin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/parent/set-pin', { pin: newPin });
      toast.success('Parent PIN set successfully!');
      setHasPinSet(true);
      setSettingPin(false);
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      toast.error('Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async () => {
    if (pin.length !== 4) {
      toast.error('Enter your 4-digit PIN');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/parent/verify-pin', { pin });
      localStorage.setItem('storycraft_parent_token', data.parent_token);
      toast.success('Access granted!');
      onSuccess(data.parent_token);
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error('Incorrect PIN');
      } else {
        toast.error('Verification failed');
      }
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  if (hasPinSet === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
        <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center animate-pulse"
            style={{ background: 'hsl(var(--primary) / 0.15)' }}>
            <Shield className="w-6 h-6" style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
      data-testid="parent-auth-modal">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-panel rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'hsl(var(--primary) / 0.15)' }}>
              <Shield className="w-6 h-6" style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl" style={{ color: 'hsl(var(--foreground))' }}>
                Parent Access
              </h2>
              <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {settingPin ? 'Create your PIN' : hasPinSet ? 'Enter your PIN' : 'Set up parent controls'}
              </p>
            </div>
          </div>
          <button onClick={onClose} data-testid="parent-auth-close-btn"
            className="p-1 rounded-full transition-colors hover:bg-red-100"
            style={{ color: 'hsl(var(--muted-foreground))' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {!hasPinSet && !settingPin ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl" style={{ background: 'hsl(var(--muted))' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--foreground))' }}>
                Set up a 4-digit PIN to access the parent dashboard and manage your child's settings.
              </p>
            </div>
            <Button onClick={() => setSettingPin(true)} data-testid="setup-pin-btn"
              className="w-full rounded-xl h-11 flex items-center gap-2"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
              <Lock className="w-4 h-4" /> Set Up PIN
            </Button>
          </div>
        ) : settingPin ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: 'hsl(var(--foreground))' }}>
                Create PIN (4 digits)
              </label>
              <Input type="password" maxLength={4} value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                data-testid="new-pin-input"
                placeholder="Enter 4 digits"
                className="rounded-xl text-center text-lg tracking-widest"
                style={{ background: 'hsl(var(--muted))', borderColor: 'var(--glass-border)' }}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: 'hsl(var(--foreground))' }}>
                Confirm PIN
              </label>
              <Input type="password" maxLength={4} value={confirmPin}
                onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') handleSetPin(); }}
                data-testid="confirm-pin-input"
                placeholder="Confirm 4 digits"
                className="rounded-xl text-center text-lg tracking-widest"
                style={{ background: 'hsl(var(--muted))', borderColor: 'var(--glass-border)' }}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setSettingPin(false); setNewPin(''); setConfirmPin(''); }}
                data-testid="cancel-pin-btn"
                className="flex-1 rounded-xl" style={{ borderColor: 'var(--glass-border)' }}>
                Cancel
              </Button>
              <Button onClick={handleSetPin} disabled={loading || newPin.length !== 4 || confirmPin.length !== 4}
                data-testid="save-pin-btn"
                className="flex-1 rounded-xl"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                {loading ? 'Saving...' : 'Save PIN'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block" style={{ color: 'hsl(var(--foreground))' }}>
                Enter your PIN
              </label>
              <Input type="password" maxLength={4} value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') handleVerifyPin(); }}
                data-testid="verify-pin-input"
                placeholder="4-digit PIN"
                autoFocus
                className="rounded-xl text-center text-2xl tracking-widest font-bold"
                style={{ background: 'hsl(var(--muted))', borderColor: 'var(--glass-border)' }}
              />
            </div>
            <Button onClick={handleVerifyPin} disabled={loading || pin.length !== 4}
              data-testid="verify-pin-btn"
              className="w-full rounded-xl h-11"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
              {loading ? 'Verifying...' : 'Access Dashboard'}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};