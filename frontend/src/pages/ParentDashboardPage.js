import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, BarChart2, Heart, BookOpen, Shield, Clock,
  AlertCircle, Settings, Save, Brain, Palette, Target,
  Smile, Activity, Users as UsersIcon, ChevronRight,
  Bell, Send, RefreshCw, AlertTriangle, CheckCircle,
  MessageSquare, TrendingUp, Phone, Mail, Star, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// ─── Helpers ────────────────────────────────────────────────────────────────

const api = (token) => axios.create({
  baseURL: `${API_URL}/api`,
  headers: { Authorization: `Bearer ${token}` }
});

const SEVERITY_CONFIG = {
  CRITICAL: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', emoji: '🚨', label: 'Critical' },
  HIGH:     { color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', emoji: '⚠️', label: 'High' },
  MEDIUM:   { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', emoji: '⚡', label: 'Medium' },
  LOW:      { color: '#65A30D', bg: '#F7FEE7', border: '#D9F99D', emoji: '💛', label: 'Low' },
};

const STATUS_CONFIG = {
  'Thriving':       { color: '#059669', bg: '#ECFDF5', emoji: '🌟' },
  'Happy':          { color: '#10B981', bg: '#ECFDF5', emoji: '😊' },
  'Neutral':        { color: '#6366F1', bg: '#EEF2FF', emoji: '😐' },
  'Struggling':     { color: '#F59E0B', bg: '#FFFBEB', emoji: '😟' },
  'Needs Attention':{ color: '#EA580C', bg: '#FFF7ED', emoji: '⚠️' },
  'At Risk':        { color: '#DC2626', bg: '#FEF2F2', emoji: '🚨' },
};

const PRIORITY_CONFIG = {
  high:   { color: '#DC2626', bg: '#FEF2F2', label: 'Urgent' },
  medium: { color: '#D97706', bg: '#FFFBEB', label: 'This Week' },
  low:    { color: '#6366F1', bg: '#EEF2FF', label: 'Soon' },
};

const scoreCategories = [
  { key: 'learning',    label: 'Learning',    icon: Brain,      color: '#6366F1' },
  { key: 'creativity',  label: 'Creativity',  icon: Palette,    color: '#EC4899' },
  { key: 'discipline',  label: 'Discipline',  icon: Target,     color: '#F59E0B' },
  { key: 'emotional',   label: 'Emotional',   icon: Smile,      color: '#10B981' },
  { key: 'physical',    label: 'Physical',    icon: Activity,   color: '#EF4444' },
  { key: 'social',      label: 'Social',      icon: UsersIcon,  color: '#8B5CF6' },
];

const getScoreColor = (s) => s >= 75 ? '#10B981' : s >= 50 ? '#F59E0B' : '#EF4444';

// ─── Sub-components ──────────────────────────────────────────────────────────

const RedFlagBanner = ({ flags, onClose }) => {
  const critical = flags.filter(f => f.severity === 'CRITICAL');
  const high     = flags.filter(f => f.severity === 'HIGH');
  const topFlag  = critical[0] || high[0];
  if (!topFlag) return null;
  const cfg = SEVERITY_CONFIG[topFlag.severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl p-5 mb-6 border-2"
      style={{ background: cfg.bg, borderColor: cfg.color }}
      data-testid="red-flag-banner"
    >
      <div className="flex items-start gap-3">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-3xl flex-shrink-0"
        >
          {cfg.emoji}
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base" style={{ color: cfg.color }}>
            {topFlag.severity === 'CRITICAL' ? 'Immediate Attention Required' : 'Parent Alert Detected'}
          </p>
          <p className="text-sm mt-1" style={{ color: '#374151' }}>
            {topFlag.summary}
          </p>
          {topFlag.child_message && (
            <p className="text-xs mt-2 italic px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.05)', color: '#4B5563' }}>
              "{topFlag.child_message}"
            </p>
          )}
          <p className="text-xs mt-2 font-medium" style={{ color: cfg.color }}>
            {critical.length + high.length} high-priority concern(s) this week — see action steps below
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const ChildStatusCard = ({ analysis, loading }) => {
  if (loading) return (
    <div className="glass-panel rounded-3xl p-6 mb-6 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-16 bg-gray-100 rounded-2xl" />
    </div>
  );
  if (!analysis) return null;

  const status = analysis.emotional_status || 'Neutral';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['Neutral'];
  const themes = analysis.key_themes || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-3xl p-6 mb-6"
      data-testid="child-status-card"
    >
      <h2 className="font-heading font-bold text-base mb-4 flex items-center gap-2"
        style={{ color: 'hsl(var(--foreground))' }}>
        <Smile className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
        Current Status
      </h2>

      <div className="flex items-center gap-4 mb-4">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: cfg.bg }}
        >
          {cfg.emoji}
        </motion.div>
        <div>
          <span className="inline-block px-3 py-1 rounded-full text-sm font-bold mb-1"
            style={{ background: cfg.bg, color: cfg.color }}>
            {status}
          </span>
          <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {analysis.emotional_summary}
          </p>
        </div>
      </div>

      {themes.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
            This week's themes:
          </span>
          {themes.map((t, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium capitalize"
              style={{ background: 'hsl(var(--primary)/0.1)', color: 'hsl(var(--primary))' }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {analysis.conversation_highlights && (
        <div className="mt-4 p-3 rounded-2xl text-sm leading-relaxed"
          style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
          <MessageSquare className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
          {analysis.conversation_highlights}
        </div>
      )}
    </motion.div>
  );
};

const NextStepsGuide = ({ analysis, loading }) => {
  if (loading) return (
    <div className="glass-panel rounded-3xl p-6 mb-6 animate-pulse space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl" />)}
    </div>
  );
  if (!analysis?.next_steps?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-3xl p-6 mb-6"
      data-testid="next-steps-guide"
    >
      <h2 className="font-heading font-bold text-base mb-2 flex items-center gap-2"
        style={{ color: 'hsl(var(--foreground))' }}>
        <TrendingUp className="w-4 h-4" style={{ color: '#10B981' }} />
        Your Action Guide This Week
      </h2>
      <p className="text-xs mb-5" style={{ color: 'hsl(var(--muted-foreground))' }}>
        TWINNEE's AI mediator has analysed your child's patterns and suggests these specific steps.
      </p>
      <div className="space-y-3">
        {analysis.next_steps.map((step, i) => {
          const pcfg = PRIORITY_CONFIG[step.priority] || PRIORITY_CONFIG.medium;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex gap-3 p-4 rounded-2xl border"
              style={{ background: pcfg.bg, borderColor: pcfg.color + '40' }}
              data-testid={`next-step-${i}`}
            >
              <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                style={{ background: pcfg.color }}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>
                    {step.action}
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: pcfg.color + '20', color: pcfg.color }}>
                    {step.timeframe || pcfg.label}
                  </span>
                </div>
                <p className="text-xs" style={{ color: '#6B7280' }}>{step.reason}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {analysis.weekly_focus && (
        <div className="mt-4 flex items-center gap-2.5 p-3 rounded-2xl"
          style={{ background: 'linear-gradient(135deg,#667eea15,#764ba215)' }}>
          <Star className="w-4 h-4 flex-shrink-0" style={{ color: '#667eea' }} />
          <p className="text-sm font-medium" style={{ color: '#667eea' }}>
            <strong>Weekly focus:</strong> {analysis.weekly_focus}
          </p>
        </div>
      )}

      {analysis.recommended_activities?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
            Recommended activities:
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.recommended_activities.map((a, i) => (
              <span key={i} className="text-xs px-3 py-1 rounded-full border font-medium"
                style={{ borderColor: '#667eea40', color: '#667eea', background: '#667eea08' }}>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const RedFlagsLog = ({ flags }) => {
  const [expanded, setExpanded] = useState(false);
  if (!flags?.length) return null;
  const shown = expanded ? flags : flags.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-3xl p-6 mb-6"
      data-testid="red-flags-log"
    >
      <h2 className="font-heading font-bold text-base mb-1 flex items-center gap-2"
        style={{ color: 'hsl(var(--foreground))' }}>
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        Safety Incidents ({flags.length})
      </h2>
      <p className="text-xs mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
        TWINNEE's Responsible AI flagged these messages. Your child has already received a warm, supportive response.
      </p>
      <div className="space-y-2">
        {shown.map((f, i) => {
          const cfg = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.MEDIUM;
          return (
            <div key={i} className="flex items-start gap-3 p-3 rounded-2xl border"
              style={{ background: cfg.bg, borderColor: cfg.border }}>
              <span className="text-lg flex-shrink-0">{cfg.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: cfg.color, color: '#fff' }}>
                    {cfg.label}
                  </span>
                  <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                    {f.timestamp ? new Date(f.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  {f.parent_alerted && (
                    <span className="text-[10px] flex items-center gap-0.5 text-green-600">
                      <CheckCircle className="w-3 h-3" /> Notified
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium" style={{ color: '#374151' }}>{f.summary}</p>
                {f.child_message && (
                  <p className="text-[11px] italic mt-1" style={{ color: '#6B7280' }}>
                    "{f.child_message}"
                  </p>
                )}
                {f.categories?.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {f.categories.map((c, ci) => (
                      <span key={ci} className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                        style={{ background: cfg.color + '20', color: cfg.color }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {flags.length > 3 && (
        <button onClick={() => setExpanded(v => !v)}
          className="mt-3 text-xs font-medium flex items-center gap-1"
          style={{ color: 'hsl(var(--primary))' }}>
          {expanded ? 'Show less' : `Show ${flags.length - 3} more`}
          <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      )}
    </motion.div>
  );
};

const BehaviorScoresSection = ({ token }) => {
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(token).get('/behavior/scores')
      .then(r => setScores(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="glass-panel rounded-3xl p-6 mb-6 animate-pulse">
      <div className="h-5 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
      </div>
    </div>
  );
  if (!scores) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-3xl p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-heading font-bold text-base flex items-center gap-2"
            style={{ color: 'hsl(var(--foreground))' }}>
            <Zap className="w-4 h-4 text-amber-500" /> Behavior Scores
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
            AI-powered analysis (last 7 days)
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs mb-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Overall</p>
          <p className="font-extrabold text-3xl font-heading"
            style={{ color: getScoreColor(scores.scores?.overall || 0) }}>
            {Math.round(scores.scores?.overall || 0)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {scoreCategories.map((cat, i) => {
          const score = scores.scores?.[cat.key] || 0;
          return (
            <motion.div key={cat.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl p-3.5 border"
              style={{ background: cat.color + '10', borderColor: cat.color + '30' }}>
              <div className="flex items-center gap-2 mb-2">
                <cat.icon className="w-4 h-4 flex-shrink-0" style={{ color: cat.color }} />
                <p className="text-xs font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{cat.label}</p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'hsl(var(--muted))' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score}%` }}
                  transition={{ delay: 0.2 + i * 0.04, duration: 0.7 }}
                  className="h-full rounded-full"
                  style={{ background: cat.color }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold" style={{ color: cat.color }}>{Math.round(score)}</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: getScoreColor(score) + '20', color: getScoreColor(score) }}>
                  {score >= 75 ? 'Great' : score >= 50 ? 'OK' : 'Support'}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────

const CONCERN_LABELS = {
  low_confidence: 'Low Confidence', social_isolation: 'Social Isolation',
  anxiety: 'Anxiety', sadness: 'Sadness', aggression: 'Aggression', none: 'Healthy',
};
const CONCERN_COLORS = {
  low_confidence: '#F59E0B', social_isolation: '#8B5CF6',
  anxiety: '#EC4899', sadness: '#6366F1', aggression: '#EF4444',
};
const MOOD_EMOJI = (s) => !s ? '⬜' : s >= 8 ? '😄' : s >= 6 ? '🙂' : s >= 4 ? '😐' : '😟';
const MOOD_COLOR = (s) => !s ? '#CBD5E1' : s >= 8 ? '#10B981' : s >= 6 ? '#F59E0B' : s >= 4 ? '#6366F1' : '#EF4444';

const MoodBar = ({ score }) => {
  const pct = score ? (score / 10) * 100 : 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-base">{MOOD_EMOJI(score)}</span>
      <div className="w-5 rounded-full overflow-hidden" style={{ height: 48, background: 'hsl(var(--muted))' }}>
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: `${pct}%` }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="w-full rounded-full"
          style={{ background: MOOD_COLOR(score), marginTop: `${100 - pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold" style={{ color: MOOD_COLOR(score) }}>{score || '—'}</span>
    </div>
  );
};

export default function ParentDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [redFlags, setRedFlags] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [capMinutes, setCapMinutes] = useState(25);
  const [capEnabled, setCapEnabled] = useState(true);
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const parentToken = localStorage.getItem('storycraft_parent_token');
  const childToken  = localStorage.getItem('storycraft_token');

  const loadAll = useCallback(async () => {
    if (!parentToken) { navigate('/dashboard'); return; }
    try {
      const { data: d } = await axios.get(`${API_URL}/api/parent/dashboard`, {
        headers: { Authorization: `Bearer ${parentToken}` }
      });
      setData(d);
      setCapMinutes(d.settings?.session_cap_minutes || 25);
      setCapEnabled(d.settings?.session_cap_enabled ?? true);
      setParentEmail(d.settings?.parent_email || '');
      setParentPhone(d.settings?.parent_phone || '');
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 401) {
        localStorage.removeItem('storycraft_parent_token');
        navigate('/dashboard');
      }
      toast.error('Could not load dashboard');
    } finally {
      setLoading(false);
    }

    if (!childToken) return;
    setAnalysisLoading(true);
    try {
      const [analysisRes, flagsRes] = await Promise.all([
        axios.get(`${API_URL}/api/parent/child-analysis`, { headers: { Authorization: `Bearer ${childToken}` } }),
        axios.get(`${API_URL}/api/parent/red-flags`,       { headers: { Authorization: `Bearer ${childToken}` } }),
      ]);
      setAnalysis(analysisRes.data.analysis);
      setRedFlags(analysisRes.data.red_flags || []);
    } catch (e) {
      console.error('Analysis load error', e);
    } finally {
      setAnalysisLoading(false);
    }
  }, [parentToken, childToken, navigate]);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.put(`${API_URL}/api/wellbeing/settings`, {
        session_cap_minutes: capMinutes,
        session_cap_enabled: capEnabled,
        parent_email: parentEmail || undefined,
        parent_phone: parentPhone || undefined,
      }, { headers: { Authorization: `Bearer ${childToken}` } });
      toast.success('Settings saved');
      setSettingsOpen(false);
    } catch {
      toast.error('Could not save settings');
    }
    setSavingSettings(false);
  };

  const sendWeeklyReport = async () => {
    if (!parentEmail && !parentPhone) {
      toast.error('Add your email or WhatsApp number in Settings first');
      setSettingsOpen(true);
      return;
    }
    setSendingReport(true);
    try {
      const { data: r } = await axios.post(`${API_URL}/api/parent/send-weekly-report`, { force: true }, {
        headers: { Authorization: `Bearer ${childToken}` }
      });
      toast.success('Weekly report sent via email & WhatsApp!');
    } catch (e) {
      const msg = e.response?.data?.detail || 'Could not send report';
      toast.error(msg);
    }
    setSendingReport(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-20">
        <div className="space-y-4">
          {[1,2,3].map(i => (
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
  const hasCritical = redFlags.some(f => f.severity === 'CRITICAL');
  const hasHigh     = redFlags.some(f => f.severity === 'HIGH');
  const urgentFlags = redFlags.filter(f => ['CRITICAL','HIGH'].includes(f.severity));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-24" data-testid="parent-dashboard">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => navigate('/dashboard')} data-testid="parent-back-btn"
              className="flex items-center gap-1.5 text-sm mb-2 transition-colors"
              style={{ color: 'hsl(var(--muted-foreground))' }}
              onMouseEnter={e => e.currentTarget.style.color = 'hsl(var(--primary))'}
              onMouseLeave={e => e.currentTarget.style.color = 'hsl(var(--muted-foreground))'}>
              <ArrowLeft className="w-4 h-4" /> Child View
            </button>
            <h1 className="font-heading font-extrabold text-3xl" style={{ color: 'hsl(var(--foreground))' }}>
              Parent <span className="gradient-text">Intelligence</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {data.user?.name}'s wellbeing, activity & AI-mediated insights
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={sendWeeklyReport} disabled={sendingReport} size="sm"
              data-testid="send-report-btn"
              className="rounded-full flex items-center gap-2 text-xs"
              style={{ background: '#10B981', color: '#fff' }}>
              <Send className="w-3.5 h-3.5" />
              {sendingReport ? 'Sending...' : 'Send Report'}
            </Button>
            <Button onClick={() => setSettingsOpen(v => !v)} variant="outline" size="sm"
              data-testid="parent-settings-btn"
              className="rounded-full flex items-center gap-2"
              style={{ borderColor: 'var(--glass-border)', color: 'hsl(var(--foreground))' }}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {settingsOpen && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="glass-panel rounded-3xl p-6 mb-6" data-testid="parent-settings-panel">
              <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
                <Settings className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} /> Notification & Session Settings
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm mb-2 block font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                    <Mail className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Parent email for alerts
                  </label>
                  <input type="email" value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                    placeholder="parent@example.com" data-testid="parent-email-input"
                    className="w-full px-3 py-2 rounded-xl text-sm border"
                    style={{ background: 'hsl(var(--background))', borderColor: 'var(--glass-border)', color: 'hsl(var(--foreground))' }} />
                </div>
                <div>
                  <label className="text-sm mb-2 block font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                    <Phone className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />WhatsApp number (with country code)
                  </label>
                  <input type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                    placeholder="+91XXXXXXXXXX" data-testid="parent-phone-input"
                    className="w-full px-3 py-2 rounded-xl text-sm border"
                    style={{ background: 'hsl(var(--background))', borderColor: 'var(--glass-border)', color: 'hsl(var(--foreground))' }} />
                  <p className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Used for red flag alerts &amp; weekly reports
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'hsl(var(--foreground))' }}>Enable session cap</span>
                  <button onClick={() => setCapEnabled(v => !v)} data-testid="cap-enabled-toggle"
                    className="w-11 h-6 rounded-full transition-all flex items-center px-0.5"
                    style={{ background: capEnabled ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}>
                    <motion.div animate={{ x: capEnabled ? 20 : 2 }} className="w-5 h-5 rounded-full bg-white shadow" />
                  </button>
                </label>
                <div>
                  <label className="text-sm mb-1.5 block" style={{ color: 'hsl(var(--foreground))' }}>
                    Session cap: <span className="font-bold" style={{ color: 'hsl(var(--primary))' }}>{capMinutes} min</span>
                  </label>
                  <input type="range" min={10} max={60} step={5} value={capMinutes}
                    onChange={e => setCapMinutes(Number(e.target.value))}
                    data-testid="cap-minutes-slider" className="w-full h-2 rounded-full cursor-pointer"
                    style={{ accentColor: 'hsl(var(--primary))' }} />
                </div>
              </div>
              <Button onClick={saveSettings} disabled={savingSettings} data-testid="save-settings-btn"
                className="mt-4 rounded-xl flex items-center gap-2 h-9"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <Save className="w-3.5 h-3.5" /> {savingSettings ? 'Saving...' : 'Save Settings'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Red flag urgent banner */}
        {urgentFlags.length > 0 && (
          <RedFlagBanner flags={urgentFlags} onClose={() => {}} />
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Check-ins', value: summary.checkins_this_week, icon: Heart, color: '#EC4899' },
            { label: 'Avg Mood', value: summary.avg_mood_score ? `${summary.avg_mood_score}/10` : '—', icon: BarChart2, color: '#6366F1' },
            { label: 'Stories', value: summary.stories_total, icon: BookOpen, color: '#10B981' },
            { label: 'Alerts', value: redFlags.length, icon: Bell, color: redFlags.length > 0 ? '#EF4444' : '#F59E0B' },
          ].map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass-panel rounded-3xl p-4 shadow-sm" data-testid={`parent-stat-${i}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: c.color + '20' }}>
                  <c.icon className="w-3.5 h-3.5" style={{ color: c.color }} />
                </div>
                <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{c.label}</span>
              </div>
              <p className="font-heading font-extrabold text-2xl" style={{ color: 'hsl(var(--foreground))' }}>
                {c.value}
              </p>
            </motion.div>
          ))}
        </div>

        {/* AI Child Status */}
        <ChildStatusCard analysis={analysis} loading={analysisLoading} />

        {/* Next Steps Guide */}
        <NextStepsGuide analysis={analysis} loading={analysisLoading} />

        {/* Behavior Scores */}
        <BehaviorScoresSection token={childToken} />

        {/* Red Flags Log */}
        <RedFlagsLog flags={redFlags} />

        {/* Mood Trend */}
        <div className="glass-panel rounded-3xl p-6 mb-6" data-testid="mood-trend-chart">
          <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
            <BarChart2 className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} /> 7-Day Mood Trend
          </h3>
          <div className="flex items-end justify-between gap-2">
            {mood_trend.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <MoodBar score={day.mood_score} />
                <span className="text-[10px] font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detected Concerns */}
        {Object.keys(detected_concerns).length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="glass-panel rounded-3xl p-6 mb-6 border"
            style={{ borderColor: 'rgba(239,68,68,0.15)' }}
            data-testid="concern-alerts">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
              <AlertCircle className="w-4 h-4 text-amber-500" /> Gentle Observations (Last 7 Days)
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(detected_concerns).map(([concern, count]) => (
                <span key={concern} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white"
                  style={{ background: CONCERN_COLORS[concern] || '#6366F1' }}>
                  {CONCERN_LABELS[concern] || concern} × {count}
                </span>
              ))}
            </div>
            <p className="text-xs mt-3 italic" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Soft signals, not diagnoses. If patterns persist, consider a gentle conversation or counselor.
            </p>
          </motion.div>
        )}

        {/* Recent Reflections */}
        {recent_reflections.length > 0 && (
          <div className="glass-panel rounded-3xl p-6 mb-6" data-testid="recent-reflections">
            <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
              <Heart className="w-4 h-4" style={{ color: '#EC4899' }} /> Recent Story Reflections
            </h3>
            <div className="space-y-2">
              {recent_reflections.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 p-3 rounded-2xl"
                  style={{ background: 'hsl(var(--muted))' }}>
                  <span className="text-xl flex-shrink-0">{
                    { happy:'😄',amazed:'🤩',calm:'😌',thoughtful:'🤔',sad:'😢',sleepy:'😴' }[r.mood_emoji] || '🙂'
                  }</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--foreground))' }}>{r.story_title}</p>
                    {r.what_i_liked && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Liked: {r.what_i_liked}</p>}
                  </div>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Sessions */}
        {recent_sessions.length > 0 && (
          <div className="glass-panel rounded-3xl p-6" data-testid="recent-sessions">
            <h3 className="font-bold text-base mb-4" style={{ color: 'hsl(var(--foreground))' }}>Recent Check-in Sessions</h3>
            <div className="space-y-2">
              {recent_sessions.slice(0,5).map((s, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: 'hsl(var(--muted))' }}>
                  <span className="text-lg">{MOOD_EMOJI(s.mood_score)}</span>
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                      {new Date(s.session_date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    </p>
                    {s.summary && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{s.summary}</p>}
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end max-w-[100px]">
                    {s.mood_tags.slice(0,2).map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded-full capitalize"
                        style={{ background: 'hsl(var(--primary)/0.12)', color: 'hsl(var(--primary))' }}>{t}</span>
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
