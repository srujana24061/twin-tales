import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Award, TrendingUp, Users, Zap, Sparkles, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';

export const CollaborationReportPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  const loadReport = async () => {
    try {
      const { data } = await api.get(`/collab/report/${sessionId}`);
      setReport(data.report);
    } catch (err) {
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 mx-auto mb-4"
          >
            <Sparkles className="w-16 h-16" style={{ color: 'var(--primary)' }} />
          </motion.div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Generating your collaboration report...
          </p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
            Report not found
          </p>
          <Button onClick={() => navigate('/friends')}>
            Back to Friends
          </Button>
        </div>
      </div>
    );
  }

  const traits = report.report?.traits || {};
  const highlights = report.report?.highlights || [];
  const suggestions = report.report?.suggestions || [];

  const traitIcons = {
    creativity: { icon: Sparkles, color: '#EC4899' },
    leadership: { icon: Award, color: '#F59E0B' },
    collaboration: { icon: Users, color: '#10B981' },
    engagement: { icon: Zap, color: '#667eea' }
  };

  return (
    <div className="min-h-screen py-20 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Button variant="ghost" onClick={() => navigate('/friends')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Friends
          </Button>
          
          <div className="glass-panel rounded-3xl p-8 text-center"
            style={{ background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              <Award className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Collaboration Report
            </h1>
            <p className="text-lg font-medium mb-1" style={{ color: 'var(--primary)' }}>
              {report.report?.user_name || 'You'}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Story: "{report.report?.session_topic}"
            </p>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid sm:grid-cols-3 gap-4 mb-8"
        >
          <div className="glass-panel rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold mb-1" style={{ color: 'var(--primary)' }}>
              {report.report?.total_contributions || 0}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Total Contributions
            </p>
          </div>
          
          <div className="glass-panel rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold mb-1" style={{ color: '#10B981' }}>
              {report.report?.contribution_percentage || 0}%
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Contribution Share
            </p>
          </div>
          
          <div className="glass-panel rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold mb-1" style={{ color: '#F59E0B' }}>
              {Math.round(report.report?.duration_minutes || 0)} min
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Session Duration
            </p>
          </div>
        </motion.div>

        {/* Behavioral Traits */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-panel rounded-3xl p-6 mb-8"
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Your Traits
          </h2>
          
          <div className="space-y-6">
            {Object.entries(traits).map(([trait, score], idx) => {
              const { icon: Icon, color } = traitIcons[trait] || { icon: TrendingUp, color: '#667eea' };
              
              return (
                <motion.div
                  key={trait}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}20` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
                          {trait}
                        </span>
                        <span className="text-sm font-bold" style={{ color }}>
                          {Math.round(score)}/100
                        </span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${score}%` }}
                          transition={{ delay: 0.5 + idx * 0.1, duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: color }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Highlights */}
        {highlights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-panel rounded-3xl p-6 mb-8"
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Sparkles className="w-5 h-5" style={{ color: '#F59E0B' }} />
              Highlights
            </h2>
            
            <div className="space-y-2">
              {highlights.map((highlight, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + idx * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: '#10B98110' }}
                >
                  <CheckCircle className="w-5 h-5 shrink-0" style={{ color: '#10B981' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {highlight}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="glass-panel rounded-3xl p-6 mb-8"
          >
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <TrendingUp className="w-5 h-5" style={{ color: '#667eea' }} />
              Suggestions for Next Time
            </h2>
            
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + idx * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: '#667eea10' }}
                >
                  <TrendingUp className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#667eea' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {suggestion}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex gap-4"
        >
          <Button
            className="flex-1"
            onClick={() => navigate('/friends')}
            style={{ background: 'var(--primary)', color: 'white' }}
          >
            Back to Friends
          </Button>
          <Button
            variant="outline"
            onClick={() => window.print()}
          >
            Print Report
          </Button>
        </motion.div>
      </div>
    </div>
  );
};
