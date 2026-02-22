import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export function TwinteeChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadChatHistory();
    }
  }, [isOpen]);

  const loadChatHistory = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get('/chat/history?limit=20');
      
      const formattedMessages = [];
      data.conversations.forEach(conv => {
        formattedMessages.push({
          type: 'user',
          text: conv.user_message,
          timestamp: conv.timestamp
        });
        formattedMessages.push({
          type: 'bot',
          text: conv.bot_response,
          timestamp: conv.timestamp
        });
      });
      
      setMessages(formattedMessages);
      
      // Welcome message if no history
      if (formattedMessages.length === 0) {
        setMessages([{
          type: 'bot',
          text: "Hey there! 👋 I'm TWINTEE, your friendly companion! What would you like to do today? We could create a story together, or just chat!",
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      // Show welcome message on error
      setMessages([{
        type: 'bot',
        text: "Hey there! 👋 I'm TWINTEE, your friendly companion! What would you like to do today?",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message to chat
    setMessages(prev => [...prev, {
      type: 'user',
      text: userMessage,
      timestamp: new Date().toISOString()
    }]);

    setIsSending(true);

    try {
      const { data } = await api.post('/chat/message', {
        message: userMessage
      });

      // Add bot response
      setMessages(prev => [...prev, {
        type: 'bot',
        text: data.message,
        timestamp: data.timestamp
      }]);
    } catch (err) {
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-50 rounded-full p-4 shadow-2xl transition-all hover:scale-110"
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            onClick={() => setIsOpen(true)}
            data-testid="open-chat-btn"
          >
            <MessageCircle className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-6 right-6 z-50 w-96 h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style={{ background: 'var(--bg-primary)', border: '2px solid var(--glass-border)' }}
            data-testid="chat-panel"
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b"
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderColor: 'var(--glass-border)'
              }}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-white" />
                <div>
                  <h3 className="font-bold text-white text-sm">TWINTEE</h3>
                  <p className="text-xs text-white/80">Your AI Companion</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
                data-testid="close-chat-btn"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: 'var(--bg-secondary)' }}>
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--primary)' }} />
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                        msg.type === 'user'
                          ? 'rounded-br-sm'
                          : 'rounded-bl-sm'
                      }`}
                      style={{
                        background: msg.type === 'user'
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : 'var(--bg-tertiary)',
                        color: msg.type === 'user' ? 'white' : 'var(--text-primary)',
                      }}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </motion.div>
                ))
              )}
              
              {isSending && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-2xl rounded-bl-sm"
                    style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t" style={{ background: 'var(--bg-primary)', borderColor: 'var(--glass-border)' }}>
              <div className="flex gap-2">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  rows={2}
                  className="flex-1 resize-none text-sm rounded-xl"
                  style={{
                    background: 'var(--bg-secondary)',
                    borderColor: 'var(--glass-border)',
                    color: 'var(--text-primary)'
                  }}
                  disabled={isSending}
                  data-testid="chat-input"
                />
                <Button
                  size="sm"
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isSending}
                  className="rounded-xl self-end"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}
                  data-testid="send-message-btn"
                >
                  {isSending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: 'var(--text-tertiary)' }}>
                TWINTEE is here to help and support you! 💜
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
