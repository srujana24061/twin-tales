import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Loader2, Mic, MicOff, Globe, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Languages ───────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en',    label: 'English',    flag: '🇺🇸', srLang: 'en-US' },
  { code: 'hi',    label: 'Hindi',      flag: '🇮🇳', srLang: 'hi-IN' },
  { code: 'es',    label: 'Español',    flag: '🇪🇸', srLang: 'es-ES' },
  { code: 'fr',    label: 'Français',   flag: '🇫🇷', srLang: 'fr-FR' },
  { code: 'de',    label: 'Deutsch',    flag: '🇩🇪', srLang: 'de-DE' },
  { code: 'ar',    label: 'العربية',    flag: '🇸🇦', srLang: 'ar-SA' },
  { code: 'zh',    label: '中文',        flag: '🇨🇳', srLang: 'zh-CN' },
  { code: 'pt',    label: 'Português',  flag: '🇧🇷', srLang: 'pt-BR' },
  { code: 'ja',    label: '日本語',      flag: '🇯🇵', srLang: 'ja-JP' },
  { code: 'ko',    label: '한국어',      flag: '🇰🇷', srLang: 'ko-KR' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getSpeechRecognition = () =>
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

// ─── Component ───────────────────────────────────────────────────────────────
export function TwinneeChatWidget() {
  const [isOpen, setIsOpen]         = useState(false);
  const [messages, setMessages]     = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending]   = useState(false);
  const [isLoading, setIsLoading]   = useState(false);

  // voice
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported]              = useState(() => !!getSpeechRecognition());
  const recognitionRef                = useRef(null);

  // language
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [langOpen, setLangOpen]         = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) loadChatHistory();
  }, [isOpen]); // eslint-disable-line

  // ── Load history ───────────────────────────────────────────────────────────
  const loadChatHistory = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get('/chat/history?limit=20');
      const formatted = [];
      data.conversations.forEach(c => {
        formatted.push({ type: 'user', text: c.user_message, timestamp: c.timestamp });
        formatted.push({ type: 'bot',  text: c.bot_response,  timestamp: c.timestamp });
      });
      setMessages(formatted.length ? formatted : [{
        type: 'bot',
        text: `Hey there! 👋 I'm Twinnee, your friendly companion! I can chat in ${selectedLang.label} — what would you like to do today?`,
        timestamp: new Date().toISOString()
      }]);
    } catch {
      setMessages([{
        type: 'bot',
        text: "Hey there! 👋 I'm Twinnee, your friendly companion! What would you like to do today?",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const msg = (text || inputMessage).trim();
    if (!msg || isSending) return;
    setInputMessage('');
    setMessages(prev => [...prev, { type: 'user', text: msg, timestamp: new Date().toISOString() }]);
    setIsSending(true);
    try {
      const { data } = await api.post('/chat/message', {
        message: msg,
        language: selectedLang.code,
        language_name: selectedLang.label,
      });
      setMessages(prev => [...prev, { type: 'bot', text: data.message, timestamp: data.timestamp }]);
    } catch {
      toast.error('Oops! Something went wrong. Try again?');
      setMessages(prev => [...prev, {
        type: 'bot',
        text: "Oops! I'm having a little trouble right now. Can you try again? 😊",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) { toast.error('Voice not supported in this browser'); return; }

    const recognition = new SR();
    recognition.lang          = selectedLang.srLang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      setInputMessage(transcript);
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') toast.error('Voice error: ' + e.error);
      setIsRecording(false);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [selectedLang.srLang]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const toggleRecording = () => isRecording ? stopRecording() : startRecording();

  // ── Language switch ────────────────────────────────────────────────────────
  const switchLanguage = (lang) => {
    setSelectedLang(lang);
    setLangOpen(false);
    // Add a bot message announcing the language change
    setMessages(prev => [...prev, {
      type: 'bot',
      text: `Switched to ${lang.label} ${lang.flag}. I'll respond in ${lang.label} from now on!`,
      timestamp: new Date().toISOString()
    }]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="fixed bottom-6 right-6 z-50 rounded-full shadow-2xl hover:scale-110 transition-transform"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              width: '60px', height: '60px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
            }}
            onClick={() => setIsOpen(true)}
            data-testid="open-chat-btn"
          >
            <img src="/twinnee-logo.png" alt="Twinnee"
              style={{ width: '44px', height: '44px', objectFit: 'contain' }} />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-6 right-6 z-50 w-96 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{
              height: '600px',
              background: 'linear-gradient(135deg, #f8f9ff 0%, #fff5fc 100%)',
              border: '2px solid #667eea50',
              boxShadow: '0 0 60px rgba(102, 126, 234, 0.3)'
            }}
            data-testid="chat-panel"
          >
            {/* ── Header ── */}
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <div className="flex items-center gap-3">
                <motion.img
                  src="/twinnee-logo.png" alt="Twinnee"
                  style={{ width: '34px', height: '34px', objectFit: 'contain' }}
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                />
                <div>
                  <h3 className="font-bold text-white text-sm leading-tight">Twinnee</h3>
                  <p className="text-[10px] text-white/75">Your AI Companion</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Language selector */}
                <div className="relative">
                  <button
                    onClick={() => setLangOpen(v => !v)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-white/90 hover:bg-white/20 transition-colors text-xs"
                    data-testid="lang-selector-btn"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{selectedLang.flag}</span>
                    <span className="hidden sm:inline">{selectedLang.label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {langOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute right-0 top-full mt-1 rounded-xl shadow-xl overflow-hidden z-50"
                        style={{
                          background: '#1a1a2e',
                          border: '1px solid #667eea40',
                          width: '160px',
                          maxHeight: '260px',
                          overflowY: 'auto'
                        }}
                        data-testid="lang-dropdown"
                      >
                        {LANGUAGES.map(lang => (
                          <button
                            key={lang.code}
                            onClick={() => switchLanguage(lang)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/10 transition-colors"
                            style={{
                              color: selectedLang.code === lang.code ? '#a78bfa' : '#e5e7eb',
                              background: selectedLang.code === lang.code ? 'rgba(167,139,250,0.15)' : 'transparent',
                              fontSize: '13px'
                            }}
                            data-testid={`lang-option-${lang.code}`}
                          >
                            <span className="text-base">{lang.flag}</span>
                            <span>{lang.label}</span>
                            {selectedLang.code === lang.code && (
                              <span className="ml-auto text-[10px] text-purple-400">✓</span>
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Close */}
                <button onClick={() => setIsOpen(false)}
                  className="p-1 rounded-full hover:bg-white/20 transition-colors"
                  data-testid="close-chat-btn">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3"
              style={{ background: 'linear-gradient(135deg, #ffffff 0%, #fef9ff 100%)' }}>
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#667eea' }} />
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
                  >
                    {msg.type === 'bot' && (
                      <img src="/twinnee-logo.png" alt="Twinnee"
                        className="w-6 h-6 object-contain flex-shrink-0 mb-0.5" />
                    )}
                    <div
                      className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm ${
                        msg.type === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'
                      }`}
                      style={{
                        background: msg.type === 'user'
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : '#f3f4f6',
                        color: msg.type === 'user' ? 'white' : '#1f2937',
                        lineHeight: 1.5
                      }}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </motion.div>
                ))
              )}

              {isSending && (
                <div className="flex justify-start items-end gap-2">
                  <img src="/twinnee-logo.png" alt="Twinnee" className="w-6 h-6 object-contain flex-shrink-0" />
                  <div className="px-3 py-2.5 rounded-2xl rounded-bl-sm" style={{ background: '#f3f4f6' }}>
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
                          style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Input ── */}
            <div className="p-3 border-t"
              style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', borderColor: '#667eea50' }}>

              {/* Voice recording indicator */}
              <AnimatePresence>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      className="w-2.5 h-2.5 rounded-full bg-red-500"
                    />
                    <span className="text-red-400 text-xs font-medium">Listening in {selectedLang.label}… tap mic to stop</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-2 items-end">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={`Message in ${selectedLang.label}…`}
                  rows={2}
                  className="flex-1 resize-none text-sm rounded-xl px-3 py-2 outline-none"
                  style={{
                    background: '#0f1419',
                    border: '1px solid #667eea40',
                    color: '#ffffff',
                    lineHeight: 1.5
                  }}
                  disabled={isSending || isRecording}
                  data-testid="chat-input"
                />

                {/* Mic button */}
                {voiceSupported && (
                  <button
                    onClick={toggleRecording}
                    className="rounded-xl p-2.5 transition-all flex-shrink-0"
                    style={{
                      background: isRecording
                        ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                        : 'rgba(102,126,234,0.2)',
                      border: `1px solid ${isRecording ? '#EF444460' : '#667eea40'}`,
                      color: isRecording ? '#fff' : '#a78bfa'
                    }}
                    title={isRecording ? 'Stop recording' : `Record in ${selectedLang.label}`}
                    data-testid="voice-record-btn"
                  >
                    {isRecording
                      ? <MicOff className="w-4 h-4" />
                      : <Mic className="w-4 h-4" />
                    }
                  </button>
                )}

                {/* Send button */}
                <Button
                  size="sm"
                  onClick={() => sendMessage()}
                  disabled={!inputMessage.trim() || isSending || isRecording}
                  className="rounded-xl self-end flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '10px 12px'
                  }}
                  data-testid="send-message-btn"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>

              {/* Language hint */}
              <p className="text-[10px] mt-1.5 text-center" style={{ color: '#667eea80' }}>
                {selectedLang.flag} {selectedLang.label} · {voiceSupported ? 'Voice enabled' : 'Type to chat'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
