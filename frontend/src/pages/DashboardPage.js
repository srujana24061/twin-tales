import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Users, Clock, Sparkles, ArrowRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

const statusColors = {
  draft: 'bg-slate-100 text-slate-600',
  generating: 'bg-amber-100 text-amber-700',
  generated: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-600',
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const [stories, setStories] = useState([]);
  const [stats, setStats] = useState({ stories: 0, characters: 0, total_jobs: 0, completed_jobs: 0 });
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('storycraft_user') || '{}');

  useEffect(() => {
    loadData();
  }, []);

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
    { label: 'Stories', value: stats.stories, icon: BookOpen, color: '#6366F1' },
    { label: 'Characters', value: stats.characters, icon: Users, color: '#F59E0B' },
    { label: 'Tasks', value: stats.total_jobs, icon: Clock, color: '#10B981' },
    { label: 'Completed', value: stats.completed_jobs, icon: Sparkles, color: '#EC4899' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20" data-testid="dashboard-page">
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
            <p className="text-[#64748B] mt-1">Ready to create something magical today?</p>
          </div>
          <Button
            onClick={() => navigate('/stories/new')}
            data-testid="dashboard-new-story-btn"
            className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent px-6 py-5 shadow-lg shadow-[#6366F1]/25 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 mr-2" /> New Story
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
          {statCards.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-3xl p-6 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + '15' }}>
                  <s.icon className="w-5 h-5" style={{ color: s.color }} />
                </div>
                <span className="text-sm text-[#64748B] font-medium">{s.label}</span>
              </div>
              <p className="font-heading font-extrabold text-3xl text-[#1E293B]">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Stories List */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-heading font-bold text-xl text-[#1E293B]">Your Stories</h2>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 animate-pulse">
                <div className="h-5 bg-slate-200 rounded-lg w-3/4 mb-4" />
                <div className="h-4 bg-slate-100 rounded w-1/2 mb-2" />
                <div className="h-4 bg-slate-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : stories.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-panel rounded-3xl p-16 text-center"
          >
            <BookOpen className="w-16 h-16 text-[#6366F1]/30 mx-auto mb-4" />
            <h3 className="font-heading font-bold text-xl text-[#1E293B] mb-2">No stories yet</h3>
            <p className="text-[#64748B] mb-6">Create your first magical story in minutes</p>
            <Button
              onClick={() => navigate('/stories/new')}
              data-testid="dashboard-empty-new-story-btn"
              className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent px-8 shadow-lg shadow-[#6366F1]/25"
            >
              <Plus className="w-5 h-5 mr-2" /> Create Story
            </Button>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stories.map((story, i) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -5 }}
                className="bg-white rounded-3xl p-6 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100 hover:shadow-[0_20px_60px_-15px_rgba(99,102,241,0.12)] transition-shadow cursor-pointer group"
                data-testid={`story-card-${story.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <Badge className={`${statusColors[story.status] || statusColors.draft} font-medium rounded-full px-3 py-1 text-xs`}>
                    {story.status}
                  </Badge>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteStory(story.id); }}
                    data-testid={`delete-story-${story.id}`}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="font-heading font-bold text-lg text-[#1E293B] mb-2 line-clamp-1">{story.title}</h3>
                <div className="flex items-center gap-3 text-sm text-[#64748B] mb-4">
                  <span className="capitalize">{story.tone}</span>
                  <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
                  <span className="capitalize">{story.visual_style}</span>
                  <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
                  <span>{story.scene_count || 0} scenes</span>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => navigate(story.status === 'generated' ? `/stories/${story.id}/edit` : story.status === 'generating' ? `/stories/${story.id}/generate` : `/stories/${story.id}/edit`)}
                  data-testid={`open-story-${story.id}`}
                  className="w-full rounded-full text-[#6366F1] hover:bg-[#EEF2FF] font-medium"
                >
                  {story.status === 'generated' ? 'View Story' : story.status === 'generating' ? 'View Progress' : 'Open'} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};
