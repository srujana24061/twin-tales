import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, Loader2, CheckCircle, Brain, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/lib/api';

export const CollaborationPage = () => {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [contribution, setContribution] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [pollInterval, setPollInterval] = useState(null);

  useEffect(() => {
    // Get current user ID from localStorage or API
    const token = localStorage.getItem('storycraft_token');
    if (token) {
      // Decode token to get user ID (simplified)
      const payload = JSON.parse(atob(token.split('.')[1]));
      setCurrentUserId(payload.user_id || payload.sub);
    }

    if (sessionId && sessionId !== 'new') {
      loadSession();
      // Poll for updates every 5 seconds
      const interval = setInterval(loadSession, 5000);
      setPollInterval(interval);
      return () => clearInterval(interval);
    } else if (location.state) {
      // Create new session
      createNewSession();
    }
  }, [sessionId]);

  const createNewSession = async () => {
    const { friendId, friendName, topic } = location.state;
    
    try {
      const { data } = await api.post('/collab/create', {
        friend_id: friendId,
        topic: topic
      });
      
      toast.success(`Started collaboration with ${friendName}!`);
      navigate(`/collab/${data.session.id}`, { replace: true });
    } catch (err) {
      toast.error('Failed to create collaboration');
      navigate('/friends');
    }
  };

  const loadSession = async () => {
    try {
      const { data } = await api.get(`/collab/session/${sessionId}`);
      setSession(data.session);
    } catch (err) {
      toast.error('Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const submitContribution = async () => {
    if (!contribution.trim()) {
      toast.error('Please write something!');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/collab/contribute', {
        session_id: sessionId,
        contribution: contribution.trim()
      });
      
      setContribution('');
      toast.success('Contribution added!');
      await loadSession();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add contribution');
    } finally {
      setSubmitting(false);
    }
  };

  const completeSession = async () => {
    if (!confirm('Complete this collaboration and generate reports?')) return;

    try {
      await api.post(`/collab/complete/${sessionId}`);
      toast.success('Session completed! Reports are being generated.');
      
      // Navigate to report
      setTimeout(() => {
        navigate(`/collab/report/${sessionId}`);
      }, 2000);
    } catch (err) {
      toast.error('Failed to complete session');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Session not found</p>
      </div>
    );
  }

  const isMyTurn = session.current_turn === currentUserId;
  const otherUser = session.participants_data?.find(p => p.id !== currentUserId);

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between"
        >
          <div>
            <Button variant="ghost" onClick={() => navigate('/friends')} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Friends
            </Button>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              <Sparkles className="inline w-6 h-6 mr-2" style={{ color: '#F59E0B' }} />
              {session.story.topic}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Collaborating with {otherUser?.name || 'Friend'}
            </p>
          </div>
          
          <div className="text-right">
            <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Turn {session.turn_count}</p>
            <div className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ 
                background: isMyTurn ? '#10B98120' : '#F59E0B20',
                color: isMyTurn ? '#10B981' : '#F59E0B'
              }}>
              {isMyTurn ? "Your Turn!" : `${otherUser?.name}'s Turn`}
            </div>
          </div>
        </motion.div>

        {/* Story Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-3xl p-6 mb-6 max-h-[500px] overflow-y-auto"
        >
          <div className="space-y-4">
            {session.story.content.map((item, idx) => {
              const isTwinnee = item.contributor === 'twinnee';
              const isCurrentUser = item.contributor === currentUserId;
              const contributor = isTwinnee 
                ? 'TWINNEE' 
                : isCurrentUser 
                  ? 'You' 
                  : otherUser?.name || 'Friend';

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex gap-3"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ 
                      background: isTwinnee 
                        ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                        : isCurrentUser
                          ? '#10B98120'
                          : '#F59E0B20'
                    }}>
                    {isTwinnee ? (
                      <Brain className="w-5 h-5 text-white" />
                    ) : (
                      <User className="w-5 h-5" style={{ color: isCurrentUser ? '#10B981' : '#F59E0B' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold"
                        style={{ 
                          color: isTwinnee ? '#667eea' : isCurrentUser ? '#10B981' : '#F59E0B'
                        }}>
                        {contributor}
                      </span>
                      {item.turn > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                          Turn {item.turn}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed p-3 rounded-2xl rounded-tl-sm"
                      style={{ 
                        background: isTwinnee 
                          ? '#667eea15' 
                          : 'var(--bg-tertiary)',
                        color: 'var(--text-primary)'
                      }}>
                      {item.text}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Input Area */}
        {session.status === 'active' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-6 mb-6"
          >
            {isMyTurn ? (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Your Turn - Add to the Story:
                </label>
                <Textarea
                  value={contribution}
                  onChange={(e) => setContribution(e.target.value)}
                  placeholder="Continue the story..."
                  rows={4}
                  className="mb-3"
                  disabled={submitting}
                />
                <div className="flex gap-3">
                  <Button
                    onClick={submitContribution}
                    disabled={submitting || !contribution.trim()}
                    className="flex-1"
                    style={{ background: 'var(--primary)', color: 'white' }}
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                    ) : (
                      <><Send className="w-4 h-4 mr-2" /> Submit Contribution</>
                    )}
                  </Button>
                  
                  {session.turn_count >= 6 && (
                    <Button variant="outline" onClick={completeSession}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete Story
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" style={{ color: 'var(--primary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Waiting for {otherUser?.name}'s turn...
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  Refreshing automatically
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Completed Session */}
        {session.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-3xl p-8 text-center"
          >
            <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#10B981' }} />
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Story Completed! 🎉
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Your collaboration report is ready!
            </p>
            <Button onClick={() => navigate(`/collab/report/${sessionId}`)}>
              View Report
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
