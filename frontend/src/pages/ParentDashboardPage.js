import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart2, Heart, BookOpen, Shield, Clock, AlertCircle, Settings, Save, Brain, Palette, Target, Smile, Activity, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// TWINNEE Behavior Scores Component
const BehaviorScoresSection = () => {
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('storycraft_token');

  useEffect(() => {
    loadScores();
  }, []);

  const loadScores = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/behavior/scores`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setScores(data);
    } catch (err) {
      console.error('Failed to load behavior scores:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel rounded-3xl p-6 mb-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!scores) return null;

  const scoreCategories = [
    { key: 'learning', label: 'Learning', icon: Brain, color: '#6366F1', description: 'Tasks & Education' },
    { key: 'creativity', label: 'Creativity', icon: Palette, color: '#EC4899', description: 'Stories & Ideas' },
    { key: 'discipline', label: 'Discipline', icon: Target, color: '#F59E0B', description: 'Focus & Habits' },
    { key: 'emotional', label: 'Emotional', icon: Smile, color: '#10B981', description: 'Mood & Wellbeing' },
    { key: 'physical', label: 'Physical', icon: Activity, color: '#EF4444', description: 'Activity Level' },
    { key: 'social', label: 'Social', icon: UsersIcon, color: '#8B5CF6', description: 'Interactions' },
  ];

  const getScoreColor = (score) => {
    if (score >= 75) return '#10B981'; // Green
    if (score >= 50) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getScoreLabel = (score) => {
    if (score >= 75) return 'Great!';
    if (score >= 50) return 'Good';
    return 'Needs Support';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-3xl p-6 mb-8"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading font-bold text-lg flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
            <span className="text-2xl">🎯</span> TWINNEE Behavior Insights
          </h2>
          <p className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
            AI-powered understanding of your child's patterns (last 7 days)
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Overall Score</p>
          <p className="font-heading font-extrabold text-3xl" style={{ color: getScoreColor(scores.scores.overall) }}>
            {Math.round(scores.scores.overall)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        {scoreCategories.map((cat, i) => {
          const score = scores.scores[cat.key] || 0;
          return (
            <motion.div
              key={cat.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4 border"
              style={{
                background: `${cat.color}10`,
                borderColor: `${cat.color}30`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: cat.color + '20' }}>
                  <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'hsl(var(--foreground))' }}>
                    {cat.label}
                  </p>
                  <p className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {cat.description}
                  </p>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'hsl(var(--muted))' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.8 }}
                  className="h-full rounded-full"
                  style={{ background: cat.color }}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: cat.color }}>
                  {Math.round(score)}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: getScoreColor(score) + '20', color: getScoreColor(score) }}>
                  {getScoreLabel(score)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: 'hsl(var(--muted))/50' }}>
        <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--primary))' }} />
        <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <strong>Note:</strong> TWINNEE uses gentle AI analysis to understand patterns. Scores guide supportive conversations, not judgments. Screen time this week: {Math.round(scores.screen_time_week || 0)} minutes.
        </p>
      </div>
    </motion.div>
  );
};

const CONCERN_LABELS = {
  low_confidence: 'Low Confidence',
  social_isolation: 'Social Isolation',
  anxiety: 'Anxiety',
  sadness: 'Sadness',
  aggression: 'Aggression',
  none: 'Healthy',
};

const CONCERN_COLORS = {
  low_confidence: '#F59E0B',
  social_isolation: '#8B5CF6',
  anxiety: '#EC4899',
  sadness: '#6366F1',
  aggression: '#EF4444',
};

const MOOD_EMOJI = (score) => {
  if (!score) return '⬜';
  if (score >= 8) return '😄';
  if (score >= 6) return '🙂';
  if (score >= 4) return '😐';
  return '😟';
};

const MOOD_COLOR = (score) => {
  if (!score) return '#CBD5E1';
  if (score >= 8) return '#10B981';
  if (score >= 6) return '#F59E0B';
  if (score >= 4) return '#6366F1';
  return '#EF4444';
};

const MoodBar = ({ score }) => {
  const pct = score ? (score / 10) * 100 : 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-base">{MOOD_EMOJI(score)}</span>
      <div className="w-6 rounded-full overflow-hidden" style={{ height: 60, background: 'hsl(var(--muted))' }}>
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${pct}%` }}
          transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
          className="w-full rounded-full mt-auto"
          style={{ background: MOOD_COLOR(score), marginTop: `${100 - pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold" style={{ color: MOOD_COLOR(score) }}>
        {score || '—'}
      </span>
    </div>
  );
};

export default function ParentDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [capMinutes, setCapMinutes] = useState(25);
  const [capEnabled, setCapEnabled] = useState(true);
  const [parentEmail, setParentEmail] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const parentToken = localStorage.getItem('storycraft_parent_token');

  useEffect(() => {
    if (!parentToken) { navigate('/dashboard'); return; }
    loadDashboard();
  }, []); // eslint-disable-line

  const loadDashboard = async () => {
    try {
      const { data: d } = await axios.get(`${API_URL}/api/parent/dashboard`, {
        headers: { Authorization: `Bearer ${parentToken}` }
      });
      setData(d);
      setCapMinutes(d.settings?.session_cap_minutes || 25);
      setCapEnabled(d.settings?.session_cap_enabled ?? true);
      setParentEmail(d.settings?.parent_email || '');
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        localStorage.removeItem('storycraft_parent_token');
        navigate('/dashboard');
      }
      toast.error('Could not load parent dashboard');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    const token = localStorage.getItem('storycraft_token');
    try {
      await axios.put(`${API_URL}/api/wellbeing/settings`, {
        session_cap_minutes: capMinutes,
        session_cap_enabled: capEnabled,
        parent_email: parentEmail || undefined,
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Settings saved');
      setSettingsOpen(false);
    } catch {
      toast.error('Could not save settings');
    }
    setSavingSettings(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-20">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-3xl p-6 animate-pulse" style={{ background: 'hsl(var(--card))' }}>
              <div className="h-4 rounded w-1/3 mb-2" style={{ background: 'hsl(var(--muted))' }} />
              <div className="h-8 rounded w-1/4" style={{ background: 'hsl(var(--muted))' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { summary, mood_trend, detected_concerns, recent_reflections, recent_sessions } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-24" data-testid="parent-dashboard">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <button onClick={() => navigate('/dashboard')} data-testid="parent-back-btn"
              className="flex items-center gap-1.5 text-sm mb-2 transition-colors"
              style={{ color: 'hsl(var(--muted-foreground))' }}
              onMouseEnter={e => e.currentTarget.style.color = 'hsl(var(--primary))'}
              onMouseLeave={e => e.currentTarget.style.color = 'hsl(var(--muted-foreground))'}>
              <ArrowLeft className="w-4 h-4" /> Child View
            </button>
            <h1 className="font-heading font-extrabold text-3xl" style={{ color: 'hsl(var(--foreground))' }}>
              Parent <span className="gradient-text">Dashboard</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {data.user?.name}'s wellbeing & activity overview
            </p>
          </div>
          <Button onClick={() => setSettingsOpen(v => !v)} variant="outline" size="sm"
            data-testid="parent-settings-btn"
            className="rounded-full flex items-center gap-2"
            style={{ borderColor: 'var(--glass-border)', color: 'hsl(var(--foreground))' }}>
            <Settings className="w-4 h-4" /> Settings
          </Button>
        </div>

        {/* Settings panel */}
        {settingsOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-3xl p-6 mb-6" data-testid="parent-settings-panel">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
              <Clock className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} /> Session Timer Settings
            </h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--foreground))' }}>Enable session cap</span>
                <button onClick={() => setCapEnabled(v => !v)} data-testid="cap-enabled-toggle"
                  className="w-11 h-6 rounded-full transition-all flex items-center px-0.5"
                  style={{ background: capEnabled ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}>
                  <motion.div animate={{ x: capEnabled ? 20 : 2 }}
                    className="w-5 h-5 rounded-full bg-white shadow" />
                </button>
              </label>
              <div>
                <label className="text-sm mb-2 block" style={{ color: 'hsl(var(--foreground))' }}>
                  Session cap: <span className="font-bold" style={{ color: 'hsl(var(--primary))' }}>{capMinutes} minutes</span>
                </label>
                <input type="range" min={10} max={60} step={5} value={capMinutes}
                  onChange={e => setCapMinutes(Number(e.target.value))}
                  data-testid="cap-minutes-slider"
                  className="w-full h-2 rounded-full cursor-pointer"
                  style={{ accentColor: 'hsl(var(--primary))' }} />
                <div className="flex justify-between text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <span>10 min</span><span>35 min</span><span>60 min</span>
                </div>
              </div>
              <div>
                <label className="text-sm mb-2 block" style={{ color: 'hsl(var(--foreground))' }}>
                  Parent email for notifications
                </label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={e => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  data-testid="parent-email-input"
                  className="w-full px-3 py-2 rounded-xl text-sm border"
                  style={{
                    background: 'hsl(var(--background))',
                    borderColor: 'var(--glass-border)',
                    color: 'hsl(var(--foreground))',
                    outline: 'none'
                  }}
                />
                <p className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  You'll receive an email here when videos finish generating
                </p>
              </div>
              <Button onClick={saveSettings} disabled={savingSettings} data-testid="save-settings-btn"
                className="rounded-xl flex items-center gap-2 h-9"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <Save className="w-3.5 h-3.5" /> {savingSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Check-ins (week)', value: summary.checkins_this_week, icon: Heart, color: '#EC4899' },
            { label: 'Avg Mood', value: summary.avg_mood_score ? `${summary.avg_mood_score}/10` : '—', icon: BarChart2, color: '#6366F1' },
            { label: 'Stories Total', value: summary.stories_total, icon: BookOpen, color: '#10B981' },
            { label: 'Stories (week)', value: summary.stories_this_week, icon: Shield, color: '#F59E0B' },
          ].map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="glass-panel rounded-3xl p-5 shadow-sm" data-testid={`parent-stat-${i}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: c.color + '20' }}>
                  <c.icon className="w-4 h-4" style={{ color: c.color }} />
                </div>
                <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{c.label}</span>
              </div>
              <p className="font-heading font-extrabold text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
                {c.value}
              </p>
            </motion.div>
          ))}
        </div>

        {/* TWINNEE Behavior Scores */}
        <BehaviorScoresSection />

        {/* Mood trend */}
        <div className="glass-panel rounded-3xl p-6 mb-6" data-testid="mood-trend-chart">
          <h3 className="font-bold text-base mb-5 flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
            <BarChart2 className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} /> 7-Day Mood Trend
          </h3>
          <div className="flex items-end justify-between gap-3">
            {mood_trend.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <MoodBar score={day.mood_score} />
                <span className="text-[10px] font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs mt-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Bars based on daily check-in mood scores (1–10). Grey = no check-in that day.
          </p>
        </div>

        {/* Detected concerns */}
        {Object.keys(detected_concerns).length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel rounded-3xl p-6 mb-6 border"
            style={{ borderColor: 'rgba(239,68,68,0.15)' }}
            data-testid="concern-alerts">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
              <AlertCircle className="w-4 h-4 text-amber-500" /> Gentle Observations (Last 7 Days)
            </h3>
            <p className="text-xs mb-4 leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
              These patterns were gently detected in your child's check-in conversations. They are soft signals, not diagnoses.
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(detected_concerns).map(([concern, count]) => (
                <span key={concern} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white"
                  style={{ background: CONCERN_COLORS[concern] || '#6366F1' }}>
                  {CONCERN_LABELS[concern] || concern} × {count}
                </span>
              ))}
            </div>
            <p className="text-xs mt-3 italic" style={{ color: 'hsl(var(--muted-foreground))' }}>
              If you notice persistent patterns, consider a gentle conversation or speaking with a school counselor.
            </p>
          </motion.div>
        )}

        {/* Recent reflections */}
        {recent_reflections.length > 0 && (
          <div className="glass-panel rounded-3xl p-6 mb-6" data-testid="recent-reflections">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
              <Heart className="w-4 h-4" style={{ color: '#EC4899' }} /> Recent Story Reflections
            </h3>
            <div className="space-y-3">
              {recent_reflections.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-2xl"
                  style={{ background: 'hsl(var(--muted))' }}>
                  <span className="text-2xl flex-shrink-0">{
                    { happy: '😄', amazed: '🤩', calm: '😌', thoughtful: '🤔', sad: '😢', sleepy: '😴' }[r.mood_emoji] || '🙂'
                  }</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--foreground))' }}>
                      {r.story_title}
                    </p>
                    {r.what_i_liked && (
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Liked: {r.what_i_liked}
                      </p>
                    )}
                    {r.what_i_learned && (
                      <p className="text-xs line-clamp-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Learned: {r.what_i_learned}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Recent check-in sessions */}
        {recent_sessions.length > 0 && (
          <div className="glass-panel rounded-3xl p-6" data-testid="recent-sessions">
            <h3 className="font-bold text-base mb-4" style={{ color: 'hsl(var(--foreground))' }}>
              Recent Check-in Sessions
            </h3>
            <div className="space-y-2">
              {recent_sessions.slice(0, 7).map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: 'hsl(var(--muted))' }}>
                  <span className="text-lg">{MOOD_EMOJI(s.mood_score)}</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                      {new Date(s.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                    {s.summary && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{s.summary}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                    {s.mood_tags.slice(0, 2).map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full capitalize"
                        style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
