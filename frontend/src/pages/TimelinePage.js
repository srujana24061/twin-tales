import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Heart, MessageCircle, Share2, Image as ImageIcon, 
  Send, Loader2, MoreHorizontal, UserPlus, Users, Sparkles,
  X, Camera, Smile
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/lib/api';

export const TimelinePage = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadCurrentUser();
    loadPosts();
    loadSuggestedUsers();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setCurrentUser(data.user || data);
    } catch (err) {
      navigate('/login');
    }
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/timeline/posts');
      setPosts(data.posts || []);
    } catch (err) {
      toast.error('Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedUsers = async () => {
    try {
      const { data } = await api.get('/timeline/suggested-users');
      setSuggestedUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load suggestions');
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPostImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const createPost = async () => {
    if (!newPostText.trim() && !newPostImage) return;

    setPosting(true);
    try {
      const postData = {
        content: newPostText,
        image: newPostImage ? newPostImage.split(',')[1] : null
      };

      await api.post('/timeline/posts', postData);
      toast.success('Post created!');
      setNewPostText('');
      setNewPostImage(null);
      setShowCreatePost(false);
      loadPosts();
    } catch (err) {
      toast.error('Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const likePost = async (postId) => {
    try {
      await api.post(`/timeline/posts/${postId}/like`);
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, liked: !p.liked, likes_count: p.liked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      ));
    } catch (err) {
      toast.error('Failed to like post');
    }
  };

  const connectWithUser = async (userId) => {
    try {
      await api.post('/friends/request', { to_user_id: userId });
      toast.success('Connection request sent!');
      setSuggestedUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      toast.error('Failed to send request');
    }
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen" style={{ background: '#f0f2f5' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 border-b"
        style={{ background: 'white', borderColor: '#e4e6eb' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Home className="w-6 h-6" style={{ color: '#8B5CF6' }} />
            <h1 className="font-bold text-xl" style={{ color: '#1c1e21' }}>Timeline</h1>
          </div>
          <Button
            onClick={() => setShowCreatePost(true)}
            className="rounded-full"
            style={{ background: '#8B5CF6' }}
            data-testid="create-post-btn"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Create Post
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Feed */}
          <div className="lg:col-span-2 space-y-4">
            {/* Quick Post Box */}
            <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: '1px solid #e4e6eb' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: '#e4e6eb' }}>
                  <span className="font-bold text-gray-600">
                    {(currentUser?.name || 'U')[0].toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="flex-1 text-left px-4 py-2 rounded-full text-sm"
                  style={{ background: '#f0f2f5', color: '#65676b' }}
                >
                  What's on your mind, {currentUser?.name?.split(' ')[0]}?
                </button>
              </div>
              <div className="flex items-center justify-around mt-3 pt-3 border-t" style={{ borderColor: '#e4e6eb' }}>
                <button 
                  onClick={() => { setShowCreatePost(true); fileInputRef.current?.click(); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ImageIcon className="w-5 h-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-600">Photo</span>
                </button>
                <button 
                  onClick={() => setShowCreatePost(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Smile className="w-5 h-5 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-600">Feeling</span>
                </button>
              </div>
            </div>

            {/* Posts */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#8B5CF6' }} />
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">No posts yet. Be the first to share!</p>
              </div>
            ) : (
              posts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl shadow-sm overflow-hidden"
                  style={{ border: '1px solid #e4e6eb' }}
                  data-testid={`post-${post.id}`}
                >
                  {/* Post Header */}
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)' }}>
                      <span className="font-bold text-white">
                        {(post.author_name || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: '#050505' }}>
                        {post.author_name}
                      </p>
                      <p className="text-xs" style={{ color: '#65676b' }}>
                        {formatTimeAgo(post.created_at)}
                      </p>
                    </div>
                    <button className="p-2 rounded-full hover:bg-gray-100">
                      <MoreHorizontal className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Post Content */}
                  <div className="px-4 pb-3">
                    <p className="text-sm leading-relaxed" style={{ color: '#050505' }}>
                      {post.content}
                    </p>
                  </div>

                  {/* Post Image */}
                  {post.image_url && (
                    <img 
                      src={post.image_url} 
                      alt="Post" 
                      className="w-full object-cover"
                      style={{ maxHeight: '500px' }}
                    />
                  )}

                  {/* Likes & Comments Count */}
                  <div className="px-4 py-2 flex items-center justify-between text-xs"
                    style={{ color: '#65676b' }}>
                    <div className="flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                        <Heart className="w-3 h-3 text-white fill-white" />
                      </span>
                      <span>{post.likes_count || 0}</span>
                    </div>
                    <span>{post.comments_count || 0} comments</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="px-4 py-1 border-t flex items-center" style={{ borderColor: '#e4e6eb' }}>
                    <button
                      onClick={() => likePost(post.id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-gray-100 transition-colors ${
                        post.liked ? 'text-red-500' : 'text-gray-600'
                      }`}
                      data-testid={`like-post-${post.id}`}
                    >
                      <Heart className={`w-5 h-5 ${post.liked ? 'fill-current' : ''}`} />
                      <span className="text-sm font-medium">Like</span>
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Comment</span>
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-600">
                      <Share2 className="w-5 h-5" />
                      <span className="text-sm font-medium">Share</span>
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Sidebar - Suggested Connections */}
          <div className="hidden lg:block">
            <div className="bg-white rounded-xl p-4 shadow-sm sticky top-20" style={{ border: '1px solid #e4e6eb' }}>
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5" style={{ color: '#8B5CF6' }} />
                People You May Know
              </h3>
              <div className="space-y-3">
                {suggestedUsers.length === 0 ? (
                  <p className="text-sm text-gray-500">No suggestions right now</p>
                ) : (
                  suggestedUsers.map(user => (
                    <div key={user.id} className="flex items-center gap-3 py-1">
                      <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ background: '#e4e6eb' }}>
                        <span className="font-bold text-gray-600 text-sm">
                          {(user.name || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => connectWithUser(user.id)}
                        className="rounded-full text-xs flex-shrink-0 px-3 h-7"
                        style={{ background: '#8B5CF6' }}
                        data-testid={`connect-${user.id}`}
                      >
                        Connect
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreatePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
            onClick={(e) => e.target === e.currentTarget && setShowCreatePost(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-xl w-full max-w-lg shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-xl">Create Post</h3>
                <button
                  onClick={() => setShowCreatePost(false)}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)' }}>
                    <span className="font-bold text-white">
                      {(currentUser?.name || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <p className="font-semibold">{currentUser?.name}</p>
                </div>

                <Textarea
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder={`What's on your mind, ${currentUser?.name?.split(' ')[0]}?`}
                  className="min-h-[120px] border-none text-lg resize-none focus:ring-0"
                  style={{ background: 'transparent' }}
                  data-testid="new-post-textarea"
                />

                {/* Image Preview */}
                {newPostImage && (
                  <div className="relative mt-3">
                    <img src={newPostImage} alt="Preview" className="rounded-lg max-h-64 w-full object-cover" />
                    <button
                      onClick={() => setNewPostImage(null)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Add to Post */}
                <div className="mt-4 p-3 border rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Add to your post</span>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-full hover:bg-gray-100"
                    >
                      <Camera className="w-6 h-6 text-green-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t">
                <Button
                  onClick={createPost}
                  disabled={posting || (!newPostText.trim() && !newPostImage)}
                  className="w-full rounded-lg py-3"
                  style={{ background: '#8B5CF6' }}
                  data-testid="submit-post-btn"
                >
                  {posting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Post'
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimelinePage;
