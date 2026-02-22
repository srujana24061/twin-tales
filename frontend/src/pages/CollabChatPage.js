import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Send, BookOpen, MessageCircle, Users, Sparkles, 
  Loader2, CheckCircle, PenLine, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';

export const CollabChatPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const messagesEndRef = useRef(null);
  
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [storyContent, setStoryContent] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [viewMode, setViewMode] = useState('chat'); // 'chat' | 'story'

  // For creating new session
  const { friendId, friendName, topic } = location.state || {};

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (sessionId && sessionId !== 'new') {
        loadSession();
        // Poll for new messages every 3 seconds
        const interval = setInterval(loadMessages, 3000);
        return () => clearInterval(interval);
      } else if (friendId && topic) {
        createNewSession();
      }
    }
  }, [sessionId, currentUser, friendId, topic]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, storyContent, viewMode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadCurrentUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setCurrentUser(data.user || data);
    } catch (err) {
      navigate('/login');
    }
  };

  const createNewSession = async () => {
    try {
      setLoading(true);
      const { data } = await api.post('/collab/create', {
        friend_id: friendId,
        topic: topic
      });
      
      if (data.session) {
        navigate(`/collab/chat/${data.session.id}`, { replace: true });
        setSession(data.session);
        toast.success('Story collaboration started!');
      }
    } catch (err) {
      toast.error('Failed to create collaboration');
      navigate('/friends');
    } finally {
      setLoading(false);
    }
  };

  const loadSession = async () => {
    try {
      const { data } = await api.get(`/collab/session/${sessionId}`);
      setSession(data.session);
      setIsMyTurn(data.session?.current_turn === currentUser?.id);
      loadMessages();
    } catch (err) {
      toast.error('Failed to load session');
      navigate('/friends');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!sessionId || sessionId === 'new') return;
    
    try {
      const { data } = await api.get(`/collab/chat/${sessionId}`);
      setMessages(data.messages || []);
      setStoryContent(data.story_content || []);
      setIsMyTurn(data.current_turn === currentUser?.id);
    } catch (err) {
      console.error('Failed to load messages');
    }
  };

  const sendMessage = async (isStoryContribution = false) => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { data } = await api.post('/collab/chat', {
        session_id: sessionId,
        message: newMessage,
        is_story_contribution: isStoryContribution
      });

      if (data.success) {
        setNewMessage('');
        loadMessages();
        if (isStoryContribution) {
          toast.success('Added to story!');
        }
      }
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getParticipantName = (participantId) => {
    if (participantId === 'twinnee') return 'TWINNEE';
    const participant = session?.participants_data?.find(p => p.id === participantId);
    return participant?.name || 'Friend';
  };

  const isOwnMessage = (senderId) => senderId === currentUser?.id;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading collaboration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="border-b sticky top-0 z-10" 
        style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate('/friends')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <BookOpen className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                  {session?.story?.topic || 'Story Collaboration'}
                </h1>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <Users className="w-3 h-3" />
                  {session?.participants_data?.map(p => p.name).join(' & ')}
                </div>
              </div>
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center gap-2 p-1 rounded-full"
              style={{ background: 'var(--bg-tertiary)' }}>
              <button
                onClick={() => setViewMode('chat')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  viewMode === 'chat' ? 'bg-white shadow-sm' : ''
                }`}
                style={{ color: viewMode === 'chat' ? 'var(--primary)' : 'var(--text-tertiary)' }}
                data-testid="chat-tab"
              >
                <MessageCircle className="w-4 h-4 inline mr-1" /> Chat
              </button>
              <button
                onClick={() => setViewMode('story')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  viewMode === 'story' ? 'bg-white shadow-sm' : ''
                }`}
                style={{ color: viewMode === 'story' ? 'var(--primary)' : 'var(--text-tertiary)' }}
                data-testid="story-tab"
              >
                <BookOpen className="w-4 h-4 inline mr-1" /> Story
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Turn Indicator */}
      <div className="max-w-4xl mx-auto w-full px-4 py-2">
        <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center justify-center gap-2 ${
          isMyTurn ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {isMyTurn ? (
            <>
              <PenLine className="w-4 h-4" />
              Your turn to add to the story!
            </>
          ) : (
            <>
              <Clock className="w-4 h-4" />
              Waiting for {getParticipantName(session?.current_turn)}'s turn...
            </>
          )}
        </div>
      </div>

      {/* Messages/Story Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <AnimatePresence mode="popLayout">
            {viewMode === 'chat' ? (
              // Chat Messages View
              messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <MessageCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-tertiary)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Start chatting with your friend about the story!
                  </p>
                </motion.div>
              ) : (
                messages.map((msg, idx) => (
                  <motion.div
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isOwnMessage(msg.sender_id) ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        msg.is_story_contribution ? 'border-2 border-dashed' : ''
                      }`}
                      style={{
                        background: isOwnMessage(msg.sender_id) 
                          ? 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)' 
                          : 'var(--bg-tertiary)',
                        color: isOwnMessage(msg.sender_id) ? 'white' : 'var(--text-primary)',
                        borderColor: msg.is_story_contribution ? '#8B5CF6' : 'transparent'
                      }}
                    >
                      {!isOwnMessage(msg.sender_id) && (
                        <p className="text-xs font-bold mb-1" style={{ color: 'var(--primary)' }}>
                          {msg.sender_name}
                        </p>
                      )}
                      <p className="text-sm">{msg.message}</p>
                      {msg.is_story_contribution && (
                        <div className="flex items-center gap-1 mt-2 text-xs opacity-80">
                          <BookOpen className="w-3 h-3" />
                          Added to story
                        </div>
                      )}
                      <p className="text-xs mt-1 opacity-60">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </motion.div>
                ))
              )
            ) : (
              // Story View
              <div className="bg-white rounded-3xl p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Sparkles className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                  "{session?.story?.topic}"
                </h3>
                <div className="space-y-4">
                  {storyContent.length === 0 ? (
                    <p className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                      No story content yet. Start contributing!
                    </p>
                  ) : (
                    storyContent.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`p-4 rounded-xl ${
                          item.contributor === 'twinnee' 
                            ? 'bg-purple-50 border-l-4 border-purple-400'
                            : item.contributor === currentUser?.id
                              ? 'bg-blue-50 border-l-4 border-blue-400'
                              : 'bg-green-50 border-l-4 border-green-400'
                        }`}
                      >
                        <p className="text-xs font-bold mb-2" style={{ 
                          color: item.contributor === 'twinnee' ? '#8B5CF6' : 'var(--text-tertiary)' 
                        }}>
                          {item.contributor === 'twinnee' 
                            ? '✨ TWINNEE' 
                            : item.contributor === currentUser?.id 
                              ? '📝 You'
                              : `👤 ${item.contributor_name || getParticipantName(item.contributor)}`
                          }
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                          {item.text}
                        </p>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t sticky bottom-0" 
        style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(false)}
                placeholder={viewMode === 'chat' ? "Type a message..." : "Add to the story..."}
                className="pr-24 rounded-full py-6"
                disabled={sending}
                data-testid="chat-input"
              />
            </div>
            
            {/* Chat Send Button */}
            <Button
              onClick={() => sendMessage(false)}
              disabled={sending || !newMessage.trim()}
              className="rounded-full px-6"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
              data-testid="send-chat-btn"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
            
            {/* Story Contribution Button */}
            <Button
              onClick={() => sendMessage(true)}
              disabled={sending || !newMessage.trim() || !isMyTurn}
              className="rounded-full px-6"
              style={{ 
                background: isMyTurn ? 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)' : 'var(--bg-tertiary)',
                color: isMyTurn ? 'white' : 'var(--text-tertiary)'
              }}
              title={isMyTurn ? "Add to story" : "Wait for your turn"}
              data-testid="add-to-story-btn"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Add to Story
            </Button>
          </div>
          
          {!isMyTurn && viewMode === 'story' && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-tertiary)' }}>
              Wait for your turn to add to the story. You can still chat!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollabChatPage;
