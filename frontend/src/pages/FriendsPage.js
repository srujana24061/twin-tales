import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Users, UserPlus, Check, X, Loader2, BookOpen, Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';

export const FriendsPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState({ incoming: [], outgoing: [] });
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadFriendsData();
  }, []);

  const loadFriendsData = async () => {
    try {
      setLoading(true);
      const [friendsRes, requestsRes, sessionsRes] = await Promise.all([
        api.get('/friends/list'),
        api.get('/friends/requests'),
        api.get('/collab/my-sessions')
      ]);
      
      setFriends(friendsRes.data.friends || []);
      setPendingRequests(requestsRes.data);
      setActiveSessions(sessionsRes.data.sessions?.filter(s => s.status === 'active') || []);
    } catch (err) {
      toast.error('Failed to load friends data');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const { data } = await api.get(`/friends/search?query=${searchQuery}`);
      setSearchResults(data.users || []);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      const { data } = await api.post('/friends/request', { to_user_id: userId });
      
      if (data.status === 'sent') {
        toast.success('Friend request sent! Waiting for parent approval.');
        setSearchResults(prev => prev.filter(u => u.id !== userId));
        loadFriendsData();
      } else if (data.status === 'already_friends') {
        toast.info('Already friends!');
      } else if (data.status === 'request_pending') {
        toast.info('Request already sent!');
      }
    } catch (err) {
      toast.error('Failed to send request');
    }
  };

  const respondToRequest = async (requestId, action) => {
    try {
      await api.post('/friends/respond', { request_id: requestId, action });
      toast.success(action === 'accept' ? 'Friend request accepted!' : 'Request declined');
      loadFriendsData();
    } catch (err) {
      toast.error('Failed to respond to request');
    }
  };

  const startCollaboration = (friendId, friendName) => {
    const topic = prompt(`What story topic would you like to create with ${friendName}?`);
    if (topic) {
      navigate('/collab/new', { state: { friendId, friendName, topic } });
    }
  };

  const continueCollaboration = (sessionId) => {
    navigate(`/collab/chat/${sessionId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            <Users className="inline w-8 h-8 mr-2" style={{ color: 'var(--primary)' }} />
            Friends & Collaboration
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Connect with friends and create stories together!
          </p>
        </motion.div>

        {/* Active Collaborations */}
        {activeSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-6 mb-6"
            style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)' }}
          >
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <MessageCircle className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              Active Story Collaborations
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {activeSessions.map(session => (
                <div key={session.id} className="p-4 rounded-2xl bg-white border"
                  style={{ borderColor: 'var(--glass-border)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                        "{session.story?.topic}"
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        with {session.participants_data?.map(p => p.name).join(' & ')}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        Turn {session.turn_count || 0} • {session.story?.content?.length || 0} contributions
                      </p>
                    </div>
                    <BookOpen className="w-8 h-8" style={{ color: 'var(--primary)' }} />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => continueCollaboration(session.id)}
                    style={{ background: 'var(--primary)', color: 'white' }}
                    data-testid={`continue-collab-${session.id}`}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Continue Story
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Search Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-3xl p-6 mb-6"
        >
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Find Friends
          </h2>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--text-tertiary)' }} />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by name or email..."
                className="pl-10"
                data-testid="friend-search-input"
              />
            </div>
            <Button onClick={handleSearch} disabled={searching} data-testid="friend-search-btn">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--bg-tertiary)' }}>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {user.name || 'User'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {user.email}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => sendFriendRequest(user.id)} data-testid={`add-friend-${user.id}`}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Friend
                  </Button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Pending Requests */}
        {(pendingRequests.incoming?.length > 0 || pendingRequests.outgoing?.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-6 mb-6"
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Pending Requests
            </h2>

            {/* Incoming Requests */}
            {pendingRequests.incoming?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Incoming Requests:
                </p>
                <div className="space-y-2">
                  {pendingRequests.incoming.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: 'var(--bg-tertiary)' }}>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {req.from_user?.name || 'User'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          {req.from_user?.email}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => respondToRequest(req.id, 'accept')}
                          className="bg-green-500 hover:bg-green-600" data-testid={`accept-req-${req.id}`}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => respondToRequest(req.id, 'decline')}
                          data-testid={`decline-req-${req.id}`}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outgoing Requests */}
            {pendingRequests.outgoing?.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Sent Requests (Waiting):
                </p>
                <div className="space-y-2">
                  {pendingRequests.outgoing.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: 'var(--bg-tertiary)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Request to {req.to_user?.name || 'User'} (waiting)
                      </p>
                      <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Friends List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-3xl p-6"
        >
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            My Friends ({friends.length})
          </h2>

          {friends.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No friends yet. Search and add friends to start collaborating!
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {friends.map(friend => (
                <div key={friend.id} className="p-4 rounded-2xl border"
                  style={{ background: 'white', borderColor: 'var(--glass-border)' }}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold" style={{ color: '#1a1a2e' }}>
                        {friend.name || 'Friend'}
                      </p>
                      <p className="text-xs" style={{ color: '#64748B' }}>
                        {friend.email}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: '#f3f0ff' }}>
                      <Users className="w-5 h-5" style={{ color: '#8B5CF6' }} />
                    </div>
                  </div>
                  <Button
                    className="w-full rounded-xl"
                    onClick={() => startCollaboration(friend.id, friend.name)}
                    style={{ background: '#8B5CF6', color: 'white' }}
                    data-testid={`create-story-${friend.id}`}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Create Story Together
                  </Button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
