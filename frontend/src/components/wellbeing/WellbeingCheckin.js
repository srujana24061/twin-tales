import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/lib/api';

export const WellbeingCheckin = ({ onComplete, onSkip }) => {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(true);
  const [exchangeCount, setExchangeCount] = useState(0);

  useEffect(() => {
    startCheckin();
  }, []);

  const startCheckin = async () => {
    setStarting(true);
    try {
      const { data } = await api.post('/wellbeing/checkin/start');
      if (data.already_completed) {
        toast.success('You already did your check-in today!');
        onComplete(data);
        return;
      }
      setSessionId(data.session_id);
      setMessages(data.messages || []);
      setExchangeCount(data.exchange_count || 0);
    } catch (err) {
      toast.error('Could not start check-in');
      onSkip();
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || loading) return;
    const userMsg = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'child', content: userMsg }]);
    setLoading(true);
    try {
      const { data } = await api.post('/wellbeing/checkin/respond', {
        session_id: sessionId,
        message: userMsg
      });
      if (data.completed) {
        setMessages(prev => [...prev, { role: 'luna', content: 'Thank you for sharing with me today! I found some stories just for you.' }]);
        setTimeout(() => onComplete(data), 1500);
      } else {
        setMessages(prev => data.messages || [...prev, { role: 'luna', content: data.luna_message }]);
        setExchangeCount(data.exchange_count || exchangeCount + 1);
      }
    } catch (err) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (starting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
        <div className="glass-panel rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center animate-pulse"
            style={{ background: 'hsl(var(--primary) / 0.15)' }}>
            <Sparkles className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <p className="text-base" style={{ color: 'hsl(var(--foreground))' }}>Starting your check-in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
      data-testid="wellbeing-checkin-modal">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-panel rounded-3xl p-6 max-w-xl w-full shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h2 className="font-heading font-bold text-xl" style={{ color: 'hsl(var(--foreground))' }}>Check-in with Luna</h2>
          </div>
          <button onClick={onSkip} data-testid="checkin-skip-btn"
            className="p-1 rounded-full transition-colors hover:bg-red-100"
            style={{ color: 'hsl(var(--muted-foreground))' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm mb-5 leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Let's talk for a moment! Luna wants to know how you're feeling today.
        </p>

        <div className="space-y-3 mb-5 max-h-80 overflow-y-auto" data-testid="checkin-messages">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`p-3 rounded-2xl ${msg.role === 'luna' ? 'mr-8' : 'ml-8'}`}
                style={{
                  background: msg.role === 'luna' ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                  color: 'hsl(var(--foreground))'
                }}>
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="p-3 rounded-2xl mr-8" style={{ background: 'hsl(var(--primary) / 0.08)' }}>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div key={i}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'hsl(var(--primary))' }} />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Type your answer..."
            data-testid="checkin-input"
            disabled={loading}
            rows={2}
            className="flex-1 resize-none rounded-xl text-sm"
            style={{ background: 'hsl(var(--muted))', borderColor: 'var(--glass-border)', color: 'hsl(var(--foreground))' }}
          />
          <Button onClick={sendMessage} disabled={loading || !inputMessage.trim()}
            data-testid="checkin-send-btn"
            className="rounded-xl h-auto px-4"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs mt-3 text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {exchangeCount}/3 questions answered
        </p>
      </motion.div>
    </div>
  );
};