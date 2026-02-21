import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, Loader2, ArrowRight, FileText, Image, BookOpen, Sparkles, Film, Volume2, Music2, Download, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';

const typeIcons = { story: Sparkles, pdf: FileText, image_regen: Image, video: Film, audio: Volume2, music: Music2, export: Download, ad: Megaphone };
const typeLabels = { story: 'Story Generation', pdf: 'PDF Export', image_regen: 'Image Regeneration', video: 'Video Generation', audio: 'Audio Narration', music: 'Background Music', export: 'Video Export', ad: 'Ad Generation' };

const statusConfig = {
  pending: { icon: Clock, color: '#94A3B8', bg: 'bg-slate-100', label: 'Pending' },
  running: { icon: Loader2, color: '#6366F1', bg: 'bg-[#EEF2FF]', label: 'Running', animate: true },
  completed: { icon: CheckCircle, color: '#10B981', bg: 'bg-[#ECFDF5]', label: 'Completed' },
  failed: { icon: XCircle, color: '#FF6B6B', bg: 'bg-red-50', label: 'Failed' },
};

export const TaskHistoryPage = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const { data } = await api.get('/jobs');
      setJobs(data);
    } catch (err) {
      if (loading) toast.error('Failed to load tasks');
    } finally { setLoading(false); }
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20" data-testid="task-history-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-10">
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">
            <span className="gradient-text">Task</span> History
          </h1>
          <p className="text-[#64748B] mt-1">Track all your generation jobs</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-2xl" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-slate-100 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="glass-panel rounded-3xl p-16 text-center">
            <Clock className="w-16 h-16 text-[#6366F1]/30 mx-auto mb-4" />
            <h3 className="font-heading font-bold text-xl text-[#1E293B] mb-2">No tasks yet</h3>
            <p className="text-[#64748B] mb-6">Generate a story to see your tasks here</p>
            <Button
              onClick={() => navigate('/stories/new')}
              data-testid="tasks-empty-new-story-btn"
              className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent px-8 shadow-lg shadow-[#6366F1]/25"
            >
              Create Story
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job, i) => {
              const sc = statusConfig[job.status] || statusConfig.pending;
              const TypeIcon = typeIcons[job.job_type] || Sparkles;

              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-white rounded-3xl p-6 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_15px_50px_-12px_rgba(99,102,241,0.1)] transition-shadow"
                  data-testid={`task-card-${job.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${sc.bg}`}>
                      <TypeIcon className="w-6 h-6" style={{ color: sc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-heading font-bold text-sm text-[#1E293B]">
                          {typeLabels[job.job_type] || job.job_type}
                        </p>
                        <Badge className={`${sc.bg} rounded-full px-2 py-0.5 text-xs font-medium`} style={{ color: sc.color }}>
                          {sc.animate && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
                          {sc.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#94A3B8]">{formatDate(job.created_at)}</p>
                      {job.error_message && (
                        <p className="text-xs text-[#FF6B6B] mt-1 truncate">{job.error_message}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {job.status === 'running' && (
                        <span className="text-sm font-bold text-[#6366F1]">{job.progress}%</span>
                      )}
                      {job.story_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/stories/${job.story_id}/edit`)}
                          data-testid={`task-view-story-${job.id}`}
                          className="text-[#6366F1] hover:bg-[#EEF2FF] rounded-full"
                        >
                          View <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};
