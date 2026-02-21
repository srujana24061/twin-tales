import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Film, ArrowLeft, Download, Play, ChevronUp, ChevronDown, GripVertical,
  Volume2, Music, Image, Clock, Loader2, Sparkles, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const VideoEditorPage = () => {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [reordering, setReordering] = useState(false);

  const loadStory = useCallback(async () => {
    try {
      const { data } = await api.get(`/stories/${storyId}`);
      setStory(data);
      setScenes((data.scenes || []).map(s => ({
        ...s,
        include_in_video: s.include_in_video !== false,
        duration_seconds: s.duration_seconds || 5,
        trim_start_seconds: s.trim_start_seconds ?? 0,
        trim_end_seconds: s.trim_end_seconds ?? '',
        transition_type: s.transition_type || 'cut',
      })));
    } catch (err) {
      toast.error('Failed to load story');
      navigate('/dashboard');
    } finally { setLoading(false); }
  }, [storyId, navigate]);

  useEffect(() => { loadStory(); }, [loadStory]);

  const moveScene = async (index, direction) => {
    const newScenes = [...scenes];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newScenes.length) return;
    [newScenes[index], newScenes[targetIdx]] = [newScenes[targetIdx], newScenes[index]];
    setScenes(newScenes);

    setReordering(true);
    try {
      await api.put(`/stories/${storyId}/reorder-scenes`, {
        scene_ids: newScenes.map(s => s.id)
      });
    } catch (err) { toast.error('Reorder failed'); }
    finally { setReordering(false); }
  };

  const saveSceneSettings = async (sceneId, updates) => {
    try {
      await api.put(`/stories/${storyId}/scenes/${sceneId}`, updates);
    } catch (err) {
      toast.error('Failed to update scene settings');
    }
  };

  const updateDuration = (sceneId, value) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, duration_seconds: value } : s));
  };

  const commitDuration = async (sceneId, value) => {
    await saveSceneSettings(sceneId, { duration_seconds: value });
  };

  const handleTrimChange = (sceneId, field, value) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, [field]: value } : s));
  };

  const commitTrim = async (sceneId, field, value) => {
    const normalized = value === '' ? null : Number(value);
    const payload = field === 'trim_start_seconds'
      ? { trim_start_seconds: normalized ?? 0 }
      : { trim_end_seconds: normalized };
    await saveSceneSettings(sceneId, payload);
  };

  const updateTransition = async (sceneId, value) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, transition_type: value } : s));
    await saveSceneSettings(sceneId, { transition_type: value });
  };

  const toggleScene = (sceneId) => {
    const target = scenes.find(s => s.id === sceneId);
    const nextValue = !(target?.include_in_video ?? true);
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, include_in_video: nextValue } : s));
    saveSceneSettings(sceneId, { include_in_video: nextValue });
  };

  const exportVideo = async () => {
    setExporting(true);
    setExportProgress(0);
    try {
      const { data } = await api.post(`/stories/${storyId}/export-video`);
      toast.success('Video export started! This may take a few minutes...');
      const interval = setInterval(async () => {
        try {
          const { data: job } = await api.get(`/jobs/${data.job_id}`);
          setExportProgress(job.progress || 0);
          if (job.status === 'completed' && job.result_url) {
            clearInterval(interval);
            setExporting(false);
            window.open(`${BACKEND_URL}${job.result_url}`, '_blank');
            toast.success('Video export ready!');
          } else if (job.status === 'failed') {
            clearInterval(interval);
            setExporting(false);
            toast.error(job.error_message || 'Export failed');
          }
        } catch (_) {}
      }, 3000);
    } catch (err) { setExporting(false); toast.error('Export failed'); }
  };

  const totalDuration = scenes.filter(s => s.include_in_video).reduce((a, s) => a + (s.duration_seconds || 5), 0);
  const hasVideo = scenes.some(s => s.video_url);
  const hasAudio = scenes.some(s => s.audio_url);
  const hasImages = scenes.some(s => s.image_url);
  const hasRenderable = scenes.some(s => s.include_in_video && (s.video_url || s.image_url));

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-[#6366F1] mx-auto" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20" data-testid="video-editor-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <button onClick={() => navigate(`/stories/${storyId}/edit`)} className="text-sm text-[#64748B] hover:text-[#6366F1] flex items-center gap-1 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back to Scene Editor
            </button>
            <h1 className="font-heading font-extrabold text-3xl tracking-tight">
              <span className="gradient-text">Video</span> Editor
            </h1>
            <p className="text-[#64748B] mt-1">{story?.title}</p>
          </div>
          <Button onClick={exportVideo} disabled={exporting || !hasRenderable}
            data-testid="export-video-btn"
            className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent px-8 py-5 shadow-xl shadow-[#6366F1]/25 hover:scale-105 active:scale-95 transition-all">
            {exporting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Exporting {exportProgress}%</> : <><Download className="w-5 h-5 mr-2" /> Export Video</>}
          </Button>
        </div>

        {exporting && <Progress value={exportProgress} className="h-2 rounded-full mb-6" data-testid="export-progress" />}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Film, label: 'Scenes', value: scenes.filter(s => s.include_in_video).length, color: '#6366F1' },
            { icon: Clock, label: 'Duration', value: `${totalDuration}s`, color: '#F59E0B' },
            { icon: Volume2, label: 'Narration', value: hasAudio ? 'Yes' : 'No', color: '#10B981' },
            { icon: Music, label: 'Music', value: story?.music_url ? 'Yes' : 'No', color: '#EC4899' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color + '15' }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xs text-[#94A3B8]">{s.label}</p>
                <p className="font-heading font-bold text-lg text-[#1E293B]">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100 p-6 sm:p-8 mb-8">
          <h2 className="font-heading font-bold text-lg mb-6 flex items-center gap-2">
            <Film className="w-5 h-5 text-[#6366F1]" /> Scene Timeline
          </h2>

          <div className="space-y-3">
            {scenes.map((scene, idx) => (
              <motion.div
                key={scene.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: scene.include_in_video ? 1 : 0.5, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                  scene.include_in_video ? 'border-slate-100 bg-white' : 'border-dashed border-slate-200 bg-slate-50'
                }`}
                data-testid={`timeline-scene-${scene.id}`}
              >
                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => moveScene(idx, 'up')} disabled={idx === 0 || reordering}
                    data-testid={`move-up-${scene.id}`}
                    className="p-1 text-[#94A3B8] hover:text-[#6366F1] disabled:opacity-30">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <GripVertical className="w-4 h-4 text-[#CBD5E1] mx-auto" />
                  <button onClick={() => moveScene(idx, 'down')} disabled={idx === scenes.length - 1 || reordering}
                    data-testid={`move-down-${scene.id}`}
                    className="p-1 text-[#94A3B8] hover:text-[#6366F1] disabled:opacity-30">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Thumbnail */}
                <div className="w-20 h-14 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                  {scene.image_url ? (
                    <img src={`${BACKEND_URL}${scene.image_url}`} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-5 h-5 text-[#CBD5E1]" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-[#EEF2FF] text-[#6366F1] rounded-full px-2 py-0.5 text-xs">{idx + 1}</Badge>
                    <p className="font-medium text-sm text-[#1E293B] truncate">{scene.scene_title || `Scene ${scene.scene_number}`}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#94A3B8]">
                    {scene.video_url && <span className="flex items-center gap-1"><Film className="w-3 h-3 text-[#6366F1]" /> Video</span>}
                    {scene.audio_url && <span className="flex items-center gap-1"><Volume2 className="w-3 h-3 text-[#10B981]" /> Audio</span>}
                    {scene.image_url && !scene.video_url && <span className="flex items-center gap-1"><Image className="w-3 h-3 text-[#F59E0B]" /> Image</span>}
                  </div>
                </div>

                {/* Duration slider */}
                <div className="w-32 hidden sm:block">
                  <p className="text-xs text-[#94A3B8] mb-1">{scene.duration_seconds || 8}s</p>
                  <Slider
                    value={[scene.duration_seconds || 8]}
                    min={3} max={20} step={1}
                    onValueChange={([v]) => updateDuration(scene.id, v)}
                    data-testid={`duration-slider-${scene.id}`}
                    className="w-full"
                  />
                </div>

                {/* Include toggle */}
                <Switch checked={scene.include_in_video} onCheckedChange={() => toggleScene(scene.id)}
                  data-testid={`toggle-scene-${scene.id}`} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Music Track */}
        {story?.music_url && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Music className="w-5 h-5 text-[#EC4899]" />
              <h3 className="font-heading font-bold text-base">Background Music</h3>
              <Badge className="bg-[#FDF2F8] text-[#EC4899] rounded-full text-xs">Active</Badge>
            </div>
            <audio controls className="w-full h-10" data-testid="editor-music-player">
              <source src={`${BACKEND_URL}${story.music_url}`} type="audio/mpeg" />
            </audio>
          </div>
        )}

        {/* Help */}
        <div className="glass-panel rounded-2xl p-6 text-center">
          <Sparkles className="w-6 h-6 text-[#6366F1] mx-auto mb-2" />
          <p className="text-sm text-[#64748B]">
            Reorder scenes, adjust durations, and click <strong>Export Video</strong> to compile everything into a final MP4 with narration and background music.
          </p>
        </div>
      </motion.div>
    </div>
  );
};
