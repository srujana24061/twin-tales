import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Users, Clock, Sparkles, ArrowRight, Trash2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';
import { WellbeingCheckin } from '@/components/wellbeing/WellbeingCheckin';
import { ParentAuthModal } from '@/components/wellbeing/ParentAuthModal';
import { TwinteeChatWidget } from '@/components/TwinteeChatWidget';

const CHECKIN_SEEN_KEY = 'storycraft_checkin_date';

const statusColors = {
  draft: 'bg-slate-100 text-slate-600',
  generating: 'bg-amber-100 text-amber-700',
  generated: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-600',
};

const TONE_COLORS = {
  funny: 'from-yellow-400 to-orange-400',
  adventure: 'from-blue-500 to-indigo-500',
  bedtime: 'from-indigo-700 to-violet-900',
  educational: 'from-green-400 to-teal-500',
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [stats, setStats] = useState({ stories: 0, characters: 0, total_jobs: 0, completed_jobs: 0 });
  const [loading, setLoading] = useState(true);
  const [showCheckin, setShowCheckin] = useState(false);
  const [showParentAuth, setShowParentAuth] = useState(false);
  const [storySuggestions, setStorySuggestions] = useState([]);
  const [moodSummary, setMoodSummary] = useState(null);
  const user = JSON.parse(localStorage.getItem('storycraft_user') || '{}');

  useEffect(() => {
    loadData();
    checkCheckin();
  }, []); // eslint-disable-line

  const checkCheckin = async () => {
    const today = new Date().toDateString();
    const lastSeen = localStorage.getItem(CHECKIN_SEEN_KEY);
    if (lastSeen === today) {
      // Already done or skipped today — just fetch today's suggestions
      try {
        const { data } = await api.get('/wellbeing/checkin/today');
        if (data.has_checkin && data.story_suggestions) {
          setStorySuggestions(data.story_suggestions);
          setMoodSummary(data.summary);
        }
      } catch (_) {}
      return;
    }
    // Show check-in
    setTimeout(() => setShowCheckin(true), 800);
  };

  const loadData = async () => {
    try {
      const [storiesRes, statsRes] = await Promise.all([
        api.get('/stories'),
        api.get('/dashboard/stats'),
      ]);
      setStories(storiesRes.data);
      setStats(statsRes.data);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckinComplete = (result) => {
    localStorage.setItem(CHECKIN_SEEN_KEY, new Date().toDateString());
    setShowCheckin(false);
    if (result?.story_suggestions) {
      setStorySuggestions(result.story_suggestions);
      setMoodSummary(result.summary);
    }
  };

  const handleCheckinSkip = () => {
    localStorage.setItem(CHECKIN_SEEN_KEY, new Date().toDateString());
    setShowCheckin(false);
  };

  const handleParentAuth = (token) => {
    setShowParentAuth(false);
    navigate('/parent-dashboard');
  };

  const deleteStory = async (id) => {
    try {
      await api.delete(`/stories/${id}`);
      setStories(stories.filter(s => s.id !== id));
      toast.success('Story deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const statCards = [
    { label: 'Stories', value: stats.stories, icon: BookOpen, color: 'hsl(var(--primary))' },
    { label: 'Characters', value: stats.characters, icon: Users, color: '#F59E0B' },
    { label: 'Tasks', value: stats.total_jobs, icon: Clock, color: '#10B981' },
    { label: 'Completed', value: stats.completed_jobs, icon: Sparkles, color: '#EC4899' },
  ];

  return (
    <>
      {showCheckin && (
        <WellbeingCheckin onComplete={handleCheckinComplete} onSkip={handleCheckinSkip} />
      )}
      {showParentAuth && (
        <ParentAuthModal onSuccess={handleParentAuth} onClose={() => setShowParentAuth(false)} />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20" data-testid="dashboard-page">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
            <div>
              <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight" data-testid="dashboard-greeting">
                Hello, <span className="gradient-text">{user.name || 'Storyteller'}</span>
              </h1>
              {moodSummary ? (
                <p className="mt-1 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {moodSummary}
                </p>
              ) : (
                <p className="mt-1 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Ready to create something magical today?
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowParentAuth(true)}
                data-testid="parent-view-btn"
                className="rounded-full flex items-center gap-2"
                style={{ borderColor: 'var(--glass-border)', color: 'hsl(var(--foreground))' }}>
                <Shield className="w-4 h-4" /> Parent View
              </Button>
              <Button
                onClick={() => navigate('/stories/new')}
                data-testid="dashboard-new-story-btn"
                className="rounded-full font-accent px-6 py-5 hover:scale-105 active:scale-95 transition-all"
                style={{ background: 'var(--btn-primary-bg)', color: 'white', boxShadow: '0 8px 24px var(--btn-primary-shadow)' }}>
                <Plus className="w-5 h-5 mr-2" /> New Story
              </Button>
            </div>
          </div>

          {/* AI Story Suggestions (if check-in complete) */}
          {storySuggestions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="mb-8 glass-panel rounded-3xl p-6" data-testid="story-suggestions">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">✨</span>
                <h2 className="font-heading font-bold text-lg" style={{ color: 'hsl(var(--foreground))' }}>
                  Stories picked for you today
                </h2>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {storySuggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    onClick={() => navigate('/stories/new', { state: { suggestion: s } })}
                    whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}
                    data-testid={`suggestion-card-${i}`}
                    className={`text-left p-4 rounded-2xl bg-gradient-to-br ${TONE_COLORS[s.tone] || 'from-indigo-500 to-purple-500'} text-white shadow-md`}
                  >
                    <p className="font-semibold text-sm mb-1">{s.theme}</p>
                    <p className="text-xs opacity-80 leading-relaxed">{s.reason}</p>
                    <div className="mt-2 flex items-center gap-1 text-xs font-medium opacity-90">
                      <Sparkles className="w-3 h-3" /> {s.moral}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
            {statCards.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="glass-panel rounded-3xl p-6 shadow-sm story-card-glow"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + '20' }}>
                    <s.icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{s.label}</span>
                </div>
                <p className="font-heading font-extrabold text-3xl" style={{ color: 'hsl(var(--foreground))' }}>{s.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Stories List */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-heading font-bold text-xl" style={{ color: 'hsl(var(--foreground))' }}>Your Stories</h2>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-panel rounded-3xl p-6 animate-pulse">
                  <div className="h-5 rounded-lg w-3/4 mb-4" style={{ background: 'hsl(var(--muted))' }} />
                  <div className="h-4 rounded w-1/2 mb-2" style={{ background: 'hsl(var(--muted))' }} />
                  <div className="h-4 rounded w-1/3" style={{ background: 'hsl(var(--muted))' }} />
                </div>
              ))}
            </div>
          ) : stories.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass-panel rounded-3xl p-16 text-center">
              <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'hsl(var(--primary))' }} />
              <h3 className="font-heading font-bold text-xl mb-2" style={{ color: 'hsl(var(--foreground))' }}>
                No stories yet
              </h3>
              <p className="mb-6 text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Create your first magical story in minutes
              </p>
              <Button onClick={() => navigate('/stories/new')} data-testid="dashboard-empty-new-story-btn"
                className="rounded-full font-accent px-8"
                style={{ background: 'var(--btn-primary-bg)', color: 'white' }}>
                <Plus className="w-5 h-5 mr-2" /> Create Story
              </Button>
            </motion.div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stories.map((story, i) => (
                <motion.div key={story.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-panel rounded-3xl p-6 story-card-glow cursor-pointer group"
                  data-testid={`story-card-${story.id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <Badge className={`${statusColors[story.status] || statusColors.draft} font-medium rounded-full px-3 py-1 text-xs`}>
                      {story.status}
                    </Badge>
                    <button onClick={(e) => { e.stopPropagation(); deleteStory(story.id); }}
                      data-testid={`delete-story-${story.id}`}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all p-1"
                      style={{ color: 'hsl(var(--muted-foreground))' }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-heading font-bold text-lg mb-2 line-clamp-1" style={{ color: 'hsl(var(--foreground))' }}>
                    {story.title}
                  </h3>
                  <div className="flex items-center gap-3 text-sm mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <span className="capitalize">{story.tone}</span>
                    <span className="w-1 h-1 rounded-full" style={{ background: 'hsl(var(--border))' }} />
                    <span className="capitalize">{story.visual_style}</span>
                    <span className="w-1 h-1 rounded-full" style={{ background: 'hsl(var(--border))' }} />
                    <span>{story.scene_count || 0} scenes</span>
                  </div>
                  <Button variant="ghost"
                    onClick={() => navigate(story.status === 'generated' ? `/stories/${story.id}/edit` : story.status === 'generating' ? `/stories/${story.id}/generate` : `/stories/${story.id}/edit`)}
                    data-testid={`open-story-${story.id}`}
                    className="w-full rounded-full font-medium"
                    style={{ color: 'hsl(var(--primary))' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--muted))'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {story.status === 'generated' ? 'View Story' : story.status === 'generating' ? 'View Progress' : 'Open'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
      <TwinteeChatWidget />
    </>
  );
};
