import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, X, Send, Users, Loader2, ChevronLeft, 
  Search, Plus, Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';

export const FriendChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'chat'
  const [friends, setFriends] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadFriends();
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    if (activeChat) {
      loadMessages();
      const interval = setInterval(loadMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadCurrentUser = async () => {
    try {
      const token = localStorage.getItem('storycraft_token');
      if (!token) return;
      const { data } = await api.get('/auth/me');
      setCurrentUser(data.user || data);
    } catch (err) {
      console.error('Failed to load user');
    }
  };

  const loadFriends = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/friends/list');
      setFriends(data.friends || []);
    } catch (err) {
      console.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!activeChat) return;
    try {
      const { data } = await api.get(`/chat/direct/${activeChat.id}`);
      setMessages(data.messages || []);
    } catch (err) {
      // Chat might not exist yet, that's ok
    }
  };

  const startChat = async (friend) => {
    setActiveChat(friend);
    setView('chat');
    
    // Create or get direct chat
    try {
      const { data } = await api.post('/chat/direct/start', {
        friend_id: friend.id
      });
      setActiveChat({ ...friend, chatId: data.chat_id });
      loadMessages();
    } catch (err) {
      console.error('Failed to start chat');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat || sending) return;

    setSending(true);
    try {
      await api.post('/chat/direct/send', {
        friend_id: activeChat.id,
        message: newMessage
      });
      setNewMessage('');
      loadMessages();
    } catch (err) {
      console.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const goBack = () => {
    setView('list');
    setActiveChat(null);
    setMessages([]);
  };

  if (!currentUser) return null;

  return (
    <>
      {/* Chat Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center"
        style={{ 
          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
          boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        data-testid="friend-chat-toggle"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <>
            <Users className="w-6 h-6 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-44 right-6 z-40 w-80 sm:w-96 rounded-3xl shadow-2xl overflow-hidden"
            style={{ 
              background: 'white',
              maxHeight: '500px',
              border: '1px solid #e5e7eb'
            }}
            data-testid="friend-chat-panel"
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
              {view === 'chat' && (
                <button onClick={goBack} className="p-1 rounded-full hover:bg-white/20">
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
              )}
              <Users className="w-5 h-5 text-white" />
              <div className="flex-1">
                <h3 className="font-bold text-white text-sm">
                  {view === 'list' ? 'Friends Chat' : activeChat?.name}
                </h3>
                <p className="text-xs text-white/80">
                  {view === 'list' ? `${friends.length} friends` : 'Online'}
                </p>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-white/20">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {view === 'list' ? (
              /* Friends List */
              <div className="h-80 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4">
                    <Users className="w-12 h-12 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500 text-center">
                      No friends yet. Add friends from the Friends page!
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {friends.map(friend => (
                      <button
                        key={friend.id}
                        onClick={() => startChat(friend)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                        data-testid={`chat-friend-${friend.id}`}
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ background: '#d1fae5' }}>
                          <span className="text-emerald-600 font-bold">
                            {(friend.name || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-800 text-sm">{friend.name}</p>
                          <p className="text-xs text-gray-500">{friend.email}</p>
                        </div>
                        <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Chat View */
              <>
                <div className="h-64 overflow-y-auto p-3 space-y-2" style={{ background: '#f9fafb' }}>
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <MessageCircle className="w-10 h-10 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">Start a conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div
                        key={msg.id || idx}
                        className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className="max-w-[80%] rounded-2xl px-3 py-2"
                          style={{
                            background: msg.sender_id === currentUser?.id 
                              ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
                              : 'white',
                            color: msg.sender_id === currentUser?.id ? 'white' : '#1f2937',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}
                        >
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-3 border-t flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-full text-sm"
                    data-testid="friend-chat-input"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="rounded-full w-10 h-10 p-0"
                    style={{ background: '#10B981' }}
                    data-testid="friend-chat-send"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Send className="w-4 h-4 text-white" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FriendChatWidget;
