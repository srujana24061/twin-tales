import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Image, Pencil, RefreshCw, Shield, ShieldAlert, FileText,
  ChevronDown, Download, ArrowLeft, Sparkles, Check, Loader2,
  Film, Volume2, Music, Play, Pause, Scissors, Megaphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import api from '@/lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const pollJob = (jobId, onProgress, onComplete, onFail) => {
  const interval = setInterval(async () => {
    try {
      const { data } = await api.get(`/jobs/${jobId}`);
      if (onProgress) onProgress(data.progress);
      if (data.status === 'completed') {
        clearInterval(interval);
        if (onComplete) onComplete(data);
      } else if (data.status === 'failed') {
        clearInterval(interval);
        if (onFail) onFail(data.error_message);
      }
    } catch (_) {}
  }, 3000);
  return interval;
};

export const SceneEditorPage = () => {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingScene, setEditingScene] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingScene, setSavingScene] = useState(null);
  const [regenScene, setRegenScene] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [musicLoading, setMusicLoading] = useState(false);
  const [mediaProgress, setMediaProgress] = useState({ video: 0, audio: 0, music: 0 });
  const [voiceStyle, setVoiceStyle] = useState('storyteller');
  const [imageProvider, setImageProvider] = useState('nano_banana');

  useEffect(() => { loadStory(); }, [storyId]); // eslint-disable-line

  const loadStory = async () => {
    try {
      const { data } = await api.get(`/stories/${storyId}`);
      setStory(data);
      setScenes(data.scenes || []);
      setImageProvider(data.image_provider || 'nano_banana');
    } catch (err) {
      toast.error('Failed to load story');
      navigate('/dashboard');
    } finally { setLoading(false); }
  };

  const startEdit = (scene) => {
    setEditingScene(scene.id);
    setEditForm({
      scene_text: scene.scene_text,
      narration_text: scene.narration_text || '',
      image_prompt: scene.image_prompt || '',
    });
  };

  const saveScene = async (sceneId) => {
    setSavingScene(sceneId);
    try {
      const { data } = await api.put(`/stories/${storyId}/scenes/${sceneId}`, editForm);
      setScenes(scenes.map(s => s.id === sceneId ? { ...s, ...data } : s));
      setEditingScene(null);
      toast.success('Scene updated!');
    } catch (err) { toast.error('Failed to save'); }
    finally { setSavingScene(null); }
  };

  const regenerateImage = async (sceneId, providerOverride) => {
    setRegenScene(sceneId);
    const provider = providerOverride || imageProvider;
    try {
      const { data } = await api.post(`/stories/${storyId}/scenes/${sceneId}/regenerate-image`, { provider });
      toast.success(`Image regeneration started (${provider === 'minimax' ? 'MiniMax' : 'Nano Banana'})!`);
      pollJob(data.job_id, null, () => { loadStory(); setRegenScene(null); toast.success('New image!'); },
        (err) => { setRegenScene(null); toast.error(err || 'Image gen failed'); });
    } catch (err) { setRegenScene(null); toast.error('Failed'); }
  };

  const generatePdf = async () => {
    setPdfLoading(true);
    try {
      const { data } = await api.post(`/stories/${storyId}/generate-pdf`);
      pollJob(data.job_id, null,
        (job) => { setPdfLoading(false); window.open(`${BACKEND_URL}${job.result_url}`, '_blank'); toast.success('PDF ready!'); },
        (err) => { setPdfLoading(false); toast.error(err || 'PDF failed'); });
    } catch (err) { setPdfLoading(false); toast.error('Failed'); }
  };

  const generateVideo = async () => {
    setVideoLoading(true);
    setMediaProgress(p => ({ ...p, video: 0 }));
    try {
      const hasImages = scenes.some(s => s.image_url);
      const mode = hasImages ? 'image-to-video (using scene images as first frames)' : 'text-to-video';
      const { data } = await api.post(`/stories/${storyId}/generate-video`);
      toast.success(`Video generation started in ${mode} mode! This may take several minutes per scene...`);
      pollJob(data.job_id,
        (prog) => setMediaProgress(p => ({ ...p, video: prog })),
        () => { setVideoLoading(false); loadStory(); toast.success('Videos ready!'); },
        (err) => { setVideoLoading(false); toast.error(err || 'Video gen failed'); });
    } catch (err) { setVideoLoading(false); toast.error('Failed to start video gen'); }
  };

  const generateAudio = async () => {
    setAudioLoading(true);
    setMediaProgress(p => ({ ...p, audio: 0 }));
    try {
      const { data } = await api.post(`/stories/${storyId}/generate-audio`, { voice_style: voiceStyle });
      toast.success('Audio narration started!');
      pollJob(data.job_id,
        (prog) => setMediaProgress(p => ({ ...p, audio: prog })),
        () => { setAudioLoading(false); loadStory(); toast.success('Narration ready!'); },
        (err) => { setAudioLoading(false); toast.error(err || 'Audio gen failed'); });
    } catch (err) { setAudioLoading(false); toast.error('Failed to start audio gen'); }
  };

  const generateMusic = async () => {
    setMusicLoading(true);
    setMediaProgress(p => ({ ...p, music: 0 }));
    try {
      const { data } = await api.post(`/stories/${storyId}/generate-music`);
      toast.success('Background music generation started!');
      pollJob(data.job_id,
        (prog) => setMediaProgress(p => ({ ...p, music: prog })),
        () => { setMusicLoading(false); loadStory(); toast.success('Music ready!'); },
        (err) => { setMusicLoading(false); toast.error(err || 'Music gen failed'); });
    } catch (err) { setMusicLoading(false); toast.error('Failed'); }
  };

  const hasScenes = scenes.length > 0;
  const aspectRatioClass = (() => {
    const ratio = story?.image_aspect_ratio || '16:9';
    if (ratio === '4:3') return 'aspect-[4/3]';
    if (ratio === '1:1') return 'aspect-square';
    if (ratio === '3:4') return 'aspect-[3/4]';
    if (ratio === '9:16') return 'aspect-[9/16]';
    return 'aspect-[16/9]';
  })();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#6366F1] mx-auto" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20" data-testid="scene-editor-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <button onClick={() => navigate('/dashboard')} className="text-sm text-[#64748B] hover:text-[#6366F1] flex items-center gap-1 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <h1 className="font-heading font-extrabold text-3xl tracking-tight" data-testid="scene-editor-title">
              {story?.title || 'Story Editor'}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className="bg-[#EEF2FF] text-[#6366F1] rounded-full text-xs capitalize">{story?.tone}</Badge>
              <Badge className="bg-[#FFFBEB] text-[#D97706] rounded-full text-xs capitalize">{story?.visual_style}</Badge>
              <Badge className="bg-[#ECFDF5] text-[#10B981] rounded-full text-xs">{scenes.length} scenes</Badge>
            </div>
          </div>
        </div>

        {/* Media Generation Panel */}
        {hasScenes && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100 mb-8">
            <h2 className="font-heading font-bold text-lg mb-5 text-[#1E293B]">Media Studio</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* PDF */}
              <Button
                onClick={generatePdf}
                disabled={pdfLoading}
                data-testid="generate-pdf-btn"
                className="h-auto py-4 rounded-2xl bg-[#F59E0B] hover:bg-[#D97706] text-white font-accent shadow-lg shadow-[#F59E0B]/20 hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-2"
              >
                {pdfLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileText className="w-6 h-6" />}
                <span className="text-sm">{pdfLoading ? 'Creating...' : 'Export PDF'}</span>
              </Button>

              {/* Video */}
              <div className="space-y-2">
                <Button
                  onClick={generateVideo}
                  disabled={videoLoading}
                  data-testid="generate-video-btn"
                  className="w-full h-auto py-4 rounded-2xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent shadow-lg shadow-[#6366F1]/20 hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-2"
                >
                  {videoLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Film className="w-6 h-6" />}
                  <span className="text-sm">{videoLoading ? `Video ${mediaProgress.video}%` : 'Generate Videos'}</span>
                </Button>
                {videoLoading && <Progress value={mediaProgress.video} className="h-1.5 rounded-full" />}
              </div>

              {/* Audio */}
              <div className="space-y-2">
                <Button
                  onClick={generateAudio}
                  disabled={audioLoading}
                  data-testid="generate-audio-btn"
                  className="w-full h-auto py-4 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white font-accent shadow-lg shadow-[#10B981]/20 hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-2"
                >
                  {audioLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Volume2 className="w-6 h-6" />}
                  <span className="text-sm">{audioLoading ? `Audio ${mediaProgress.audio}%` : 'Narration'}</span>
                </Button>
                {audioLoading && <Progress value={mediaProgress.audio} className="h-1.5 rounded-full" />}
              </div>

              {/* Music */}
              <div className="space-y-2">
                <Button
                  onClick={generateMusic}
                  disabled={musicLoading}
                  data-testid="generate-music-btn"
                  className="w-full h-auto py-4 rounded-2xl bg-[#EC4899] hover:bg-[#DB2777] text-white font-accent shadow-lg shadow-[#EC4899]/20 hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-2"
                >
                  {musicLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Music className="w-6 h-6" />}
                  <span className="text-sm">{musicLoading ? `Music ${mediaProgress.music}%` : 'Background Music'}</span>
                </Button>
                {musicLoading && <Progress value={mediaProgress.music} className="h-1.5 rounded-full" />}
              </div>
            </div>

            {/* Voice selector for audio */}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-[#64748B] font-medium">Narration Voice:</span>
              <Select value={voiceStyle} onValueChange={setVoiceStyle}>
                <SelectTrigger className="w-40 h-9 rounded-xl border-2 border-slate-200 text-sm" data-testid="voice-style-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="storyteller">Storyteller</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#64748B] font-medium">Image Model:</span>
                <Select value={imageProvider} onValueChange={setImageProvider}>
                  <SelectTrigger className="w-44 h-9 rounded-xl border-2 border-slate-200 text-sm" data-testid="scene-image-provider-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nano_banana">Nano Banana</SelectItem>
                    <SelectItem value="minimax">MiniMax</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => navigate(`/stories/${storyId}/video-editor`)}
                data-testid="open-video-editor-btn"
                className="rounded-full border-2 border-[#6366F1] text-[#6366F1] hover:bg-[#EEF2FF] font-medium">
                <Scissors className="w-4 h-4 mr-2" /> Video Editor
              </Button>
              <Button variant="outline" onClick={() => navigate(`/stories/${storyId}/ads`)}
                data-testid="open-ad-studio-btn"
                className="rounded-full border-2 border-[#EC4899] text-[#EC4899] hover:bg-[#FDF2F8] font-medium">
                <Megaphone className="w-4 h-4 mr-2" /> Ad Studio
              </Button>
            </div>

            {/* Story-level music player */}
            {story?.music_url && (
              <div className="mt-4 p-4 bg-[#FDF2F8] rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <Music className="w-5 h-5 text-[#EC4899]" />
                  <span className="text-sm font-medium text-[#1E293B]">Background Music</span>
                </div>
                <audio controls className="w-full h-10" data-testid="story-music-player">
                  <source src={`${BACKEND_URL}${story.music_url}`} type="audio/mpeg" />
                </audio>
              </div>
            )}
          </div>
        )}

        {/* AI & Safety Badges */}
        <div className="flex items-center gap-2 mb-6">
          <Badge className="bg-[#EEF2FF] text-[#6366F1] rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="w-3 h-3 mr-1" /> AI Generated
          </Badge>
          <Badge className="bg-[#ECFDF5] text-[#10B981] rounded-full px-3 py-1 text-xs font-medium">
            <Shield className="w-3 h-3 mr-1" /> Safety Verified
          </Badge>
        </div>

        {/* Scenes */}
        {!hasScenes ? (
          <div className="glass-panel rounded-3xl p-16 text-center">
            <BookOpen className="w-16 h-16 text-[#6366F1]/30 mx-auto mb-4" />
            <h3 className="font-heading font-bold text-xl mb-2">No scenes yet</h3>
            <p className="text-[#64748B]">This story hasn't been generated yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {scenes.map((scene, idx) => (
              <motion.div
                key={scene.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden"
                data-testid={`scene-card-${scene.id}`}
              >
                {/* Scene Image */}
                {scene.image_url && (
                  <div className={`relative ${aspectRatioClass} bg-slate-100`}>
                    <img src={scene.image_url} alt={`Scene ${scene.scene_number}`}
                      className="w-full h-full object-cover" data-testid={`scene-image-${scene.id}`} />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-black/50 text-white backdrop-blur-sm rounded-full px-3 py-1 text-xs">
                        Scene {scene.scene_number}
                      </Badge>
                    </div>
                    <div className="absolute top-4 right-4 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => regenerateImage(scene.id, 'nano_banana')}
                        disabled={regenScene === scene.id} data-testid={`regen-nano-${scene.id}`}
                        className="rounded-full bg-white/90 backdrop-blur-sm hover:bg-white text-[#1E293B] shadow-md">
                        {regenScene === scene.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        <span className="ml-1 text-xs">Nano</span>
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => regenerateImage(scene.id, 'minimax')}
                        disabled={regenScene === scene.id} data-testid={`regen-minimax-${scene.id}`}
                        className="rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-[#1E293B] shadow-md">
                        {regenScene === scene.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        <span className="ml-1 text-xs">MiniMax</span>
                      </Button>
                    </div>
                    {scene.safety_checked && (
                      <div className="absolute bottom-4 left-4">
                        <Badge className={`${scene.safety_flagged ? 'bg-red-500/80' : 'bg-[#10B981]/80'} text-white backdrop-blur-sm rounded-full px-3 py-1 text-xs`}>
                          {scene.safety_flagged ? <><ShieldAlert className="w-3 h-3 mr-1" /> Flagged</> : <><Shield className="w-3 h-3 mr-1" /> Safe</>}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}

                {!scene.image_url && (
                  <div className={`relative ${aspectRatioClass} bg-gradient-to-br from-[#EEF2FF] to-[#FFFBEB] flex items-center justify-center`}>
                    <div className="text-center">
                      <Image className="w-12 h-12 text-[#6366F1]/30 mx-auto mb-2" />
                      <p className="text-sm text-[#94A3B8] mb-4">Scene {scene.scene_number} — No image yet</p>
                      
                      {/* Generate Image Buttons */}
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" onClick={() => regenerateImage(scene.id, 'nano_banana')}
                          disabled={regenScene === scene.id} data-testid={`generate-nano-${scene.id}`}
                          className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-md">
                          {regenScene === scene.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-1" />
                          )}
                          <span className="text-xs">Generate with Nano</span>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => regenerateImage(scene.id, 'minimax')}
                          disabled={regenScene === scene.id} data-testid={`generate-minimax-${scene.id}`}
                          className="rounded-full border-2 border-[#6366F1] text-[#6366F1] hover:bg-[#EEF2FF] shadow-md">
                          {regenScene === scene.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Sparkles className="w-4 h-4 mr-1" />
                          )}
                          <span className="text-xs">Generate with MiniMax</span>
                        </Button>
                      </div>
                    </div>
                    
                    {/* Scene Number Badge */}
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-black/50 text-white backdrop-blur-sm rounded-full px-3 py-1 text-xs">
                        Scene {scene.scene_number}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Scene Content */}
                <div className="p-6 sm:p-8">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-heading font-bold text-xl text-[#1E293B]">
                      {scene.scene_title || `Scene ${scene.scene_number}`}
                    </h3>
                    <Button variant="ghost" size="sm"
                      onClick={() => editingScene === scene.id ? setEditingScene(null) : startEdit(scene)}
                      data-testid={`edit-scene-${scene.id}`}
                      className="text-[#6366F1] hover:bg-[#EEF2FF] rounded-full">
                      <Pencil className="w-4 h-4 mr-1" /> {editingScene === scene.id ? 'Cancel' : 'Edit'}
                    </Button>
                  </div>

                  {/* Media Players */}
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    {scene.video_url && (
                      <div className="flex-1 rounded-xl overflow-hidden border border-slate-100">
                        <div className="flex items-center gap-2 px-3 py-2 bg-[#EEF2FF]">
                          <Film className="w-4 h-4 text-[#6366F1]" />
                          <span className="text-xs font-medium text-[#6366F1]">Video</span>
                        </div>
                        <video controls className="w-full" data-testid={`scene-video-${scene.id}`}>
                          <source src={`${BACKEND_URL}${scene.video_url}`} type="video/mp4" />
                        </video>
                      </div>
                    )}
                    {scene.audio_url && (
                      <div className="flex-1 rounded-xl border border-slate-100 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Volume2 className="w-4 h-4 text-[#10B981]" />
                          <span className="text-xs font-medium text-[#10B981]">Narration</span>
                        </div>
                        <audio controls className="w-full h-10" data-testid={`scene-audio-${scene.id}`}>
                          <source src={`${BACKEND_URL}${scene.audio_url}`} type="audio/mpeg" />
                        </audio>
                      </div>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {editingScene === scene.id ? (
                      <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        <Textarea value={editForm.scene_text} onChange={(e) => setEditForm({ ...editForm, scene_text: e.target.value })}
                          data-testid={`edit-scene-text-${scene.id}`}
                          className="min-h-[120px] rounded-xl border-2 border-slate-200 focus:border-[#6366F1]" placeholder="Scene text..." />
                        <Textarea value={editForm.narration_text} onChange={(e) => setEditForm({ ...editForm, narration_text: e.target.value })}
                          data-testid={`edit-narration-${scene.id}`}
                          className="min-h-[80px] rounded-xl border-2 border-slate-200 focus:border-[#6366F1]" placeholder="Narration text..." />
                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-[#6366F1] font-medium" data-testid={`toggle-prompts-${scene.id}`}>
                            <ChevronDown className="w-4 h-4" /> Image Prompt
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <Textarea value={editForm.image_prompt} onChange={(e) => setEditForm({ ...editForm, image_prompt: e.target.value })}
                              data-testid={`edit-image-prompt-${scene.id}`}
                              className="mt-2 min-h-[80px] rounded-xl border-2 border-slate-200 focus:border-[#6366F1]" />
                          </CollapsibleContent>
                        </Collapsible>
                        <div className="flex gap-3">
                          <Button onClick={() => saveScene(scene.id)} disabled={savingScene === scene.id}
                            data-testid={`save-scene-${scene.id}`}
                            className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent shadow-lg shadow-[#6366F1]/25">
                            {savingScene === scene.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />} Save
                          </Button>
                          <Button variant="outline" onClick={() => setEditingScene(null)} className="rounded-full border-2 border-slate-200">Cancel</Button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <p className="text-[#475569] leading-relaxed mb-4">{scene.scene_text}</p>
                        {scene.narration_text && (
                          <div className="bg-[#FFFBEB] rounded-xl p-4 mb-4">
                            <p className="text-sm text-[#92400E] font-medium mb-1">Narration</p>
                            <p className="text-sm text-[#78350F]/80">{scene.narration_text}</p>
                          </div>
                        )}
                        {scene.dialogue_text && (
                          <div className="bg-[#EEF2FF] rounded-xl p-4">
                            <p className="text-sm text-[#4338CA] font-medium mb-1">Dialogue</p>
                            <p className="text-sm text-[#4338CA]/80 italic">{scene.dialogue_text}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};
