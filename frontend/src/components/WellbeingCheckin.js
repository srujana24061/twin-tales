import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';

const MOOD_EMOJIS = [
  { label: 'Amazing', emoji: '😄', value: 'amazing' },
  { label: 'Happy', emoji: '🙂', value: 'happy' },
  { label: 'Okay', emoji: '😐', value: 'okay' },
  { label: 'Tired', emoji: '😴', value: 'tired' },
  { label: 'Worried', emoji: '😟', value: 'worried' },
  { label: 'Sad', emoji: '😢', value: 'sad' },
];

const TONE_COLORS = {
  funny: 'from-yellow-400 to-orange-400',
  adventure: 'from-blue-500 to-indigo-500',
  bedtime: 'from-indigo-700 to-violet-900',
  educational: 'from-green-400 to-teal-500',
};

export const WellbeingCheckin = ({ onComplete, onSkip }) => {
  const [phase, setPhase] = useState('loading'); // loading|chat|done|skipped
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [sending, setSending] = useState(false);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [result, setResult] = useState(null);
  const [selectedMoodShortcut, setSelectedMoodShortcut] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => { scrollToBottom(); }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    initCheckin();
  }, []); // eslint-disable-line

  const initCheckin = async () => {
    try {
      const { data } = await api.post('/wellbeing/checkin/start');
      if (data.already_completed) {
        onComplete && onComplete({
          mood_score: data.mood_score,
          story_suggestions: data.story_suggestions,
          summary: data.summary,
        });
        return;
      }
      setSessionId(data.session_id);
      setMessages(data.messages || []);
      setExchangeCount(data.exchange_count || 0);
      setPhase('chat');
    } catch (err) {
      setPhase('chat');
      setMessages([{ role: 'luna', content: "Hi there! How are you feeling today? 🌟" }]);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || sending) return;
    setSending(true);
    const userMsg = { role: 'child', content: text };
    setMessages(prev => [...prev, userMsg, { role: 'luna', content: '...' }]);
    setInputText('');
    setSelectedMoodShortcut(null);

    try {
      const { data } = await api.post('/wellbeing/checkin/respond', {
        session_id: sessionId,
        message: text,
      });

      if (data.completed) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'luna', content: "Thank you for sharing! I found some stories just for you ✨" };
          return updated;
        });
        setTimeout(() => {
          setResult(data);
          setPhase('done');
        }, 1200);
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'luna', content: data.luna_message };
          return updated;
        });
        setExchangeCount(data.exchange_count || 0);
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'luna', content: "What's something fun you'd like to do today? 🎨" };
        return updated;
      });
    }
    setSending(false);
  };

  const handleMoodShortcut = (mood) => {
    setSelectedMoodShortcut(mood.value);
    sendMessage(`I'm feeling ${mood.label.toLowerCase()} ${mood.emoji}`);
  };

  const handleDone = () => {
    onComplete && onComplete(result || {});
  };

  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}>
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <Sparkles className="w-12 h-12" style={{ color: 'hsl(var(--primary))' }} />
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          className="w-full max-w-md glass-panel rounded-3xl overflow-hidden shadow-2xl"
          style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
          data-testid="wellbeing-checkin-modal"
        >
          {/* Header */}
          <div className="px-6 py-4 flex items-center gap-3 border-b" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'hsl(var(--primary) / 0.15)' }}>
              🌟
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm" style={{ color: 'hsl(var(--foreground))' }}>Luna</p>
              <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Your friendly companion</p>
            </div>
            <button onClick={onSkip} data-testid="checkin-skip-btn"
              className="p-2 rounded-full transition-colors hover:bg-black/10"
              style={{ color: 'hsl(var(--muted-foreground))' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {phase === 'chat' && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ minHeight: 0 }}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex ${msg.role === 'child' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'luna' && (
                      <span className="text-lg mr-2 self-end mb-1">🌙</span>
                    )}
                    <div
                      className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={{
                        background: msg.role === 'child'
                          ? 'hsl(var(--primary))'
                          : 'hsl(var(--muted))',
                        color: msg.role === 'child'
                          ? 'hsl(var(--primary-foreground))'
                          : 'hsl(var(--foreground))',
                        borderRadius: msg.role === 'child' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      }}
                    >
                      {msg.content === '...' ? (
                        <span className="flex gap-1 py-1">
                          {[0, 0.2, 0.4].map((d, idx) => (
                            <motion.span key={idx} className="w-1.5 h-1.5 rounded-full inline-block"
                              style={{ background: 'hsl(var(--muted-foreground))' }}
                              animate={{ y: [0, -4, 0] }}
                              transition={{ repeat: Infinity, duration: 0.8, delay: d }} />
                          ))}
                        </span>
                      ) : msg.content}
                    </div>
                  </motion.div>
                ))}

                {/* Quick mood buttons after first Luna message */}
                {messages.length === 1 && !sending && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="flex flex-wrap gap-2 justify-center pt-2">
                    {MOOD_EMOJIS.map(mood => (
                      <button
                        key={mood.value}
                        onClick={() => handleMoodShortcut(mood)}
                        disabled={sending}
                        data-testid={`mood-btn-${mood.value}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:scale-105 active:scale-95"
                        style={{
                          background: selectedMoodShortcut === mood.value ? 'hsl(var(--primary))' : 'hsl(var(--card))',
                          color: selectedMoodShortcut === mood.value ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                          borderColor: 'var(--glass-border)',
                        }}
                      >
                        <span>{mood.emoji}</span>
                        <span>{mood.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 pb-4 pt-2 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage(inputText)}
                    placeholder="Type your answer..."
                    disabled={sending}
                    data-testid="checkin-input"
                    className="flex-1 px-4 py-2.5 rounded-2xl text-sm outline-none border transition-all"
                    style={{
                      background: 'hsl(var(--muted))',
                      color: 'hsl(var(--foreground))',
                      borderColor: 'var(--glass-border)',
                    }}
                  />
                  <button
                    onClick={() => sendMessage(inputText)}
                    disabled={!inputText.trim() || sending}
                    data-testid="checkin-send-btn"
                    className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
                    style={{ background: 'hsl(var(--primary))' }}
                  >
                    <Send className="w-4 h-4" style={{ color: 'hsl(var(--primary-foreground))' }} />
                  </button>
                </div>
              </div>
            </>
          )}

          {phase === 'done' && result && (
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Mood summary */}
              <div className="text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}
                  className="text-5xl mb-3">
                  {result.mood_score >= 8 ? '😄' : result.mood_score >= 6 ? '🙂' : result.mood_score >= 4 ? '😐' : '😟'}
                </motion.div>
                <p className="font-bold text-base mb-1" style={{ color: 'hsl(var(--foreground))' }}>
                  {result.summary || 'Ready to create something wonderful!'}
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                  {(result.mood_tags || []).map(tag => (
                    <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium capitalize"
                      style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Story suggestions */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                  style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Stories picked just for you
                </p>
                <div className="space-y-2">
                  {(result.story_suggestions || []).map((s, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`rounded-2xl p-3.5 bg-gradient-to-r ${TONE_COLORS[s.tone] || 'from-indigo-500 to-purple-500'} text-white`}
                    >
                      <p className="font-semibold text-sm mb-0.5">{s.theme}</p>
                      <p className="text-xs opacity-80">{s.reason}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <Button onClick={handleDone} data-testid="checkin-done-btn"
                className="w-full rounded-2xl font-semibold h-12"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                Start Creating <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
