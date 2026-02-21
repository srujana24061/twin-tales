import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Image, Pencil, RefreshCw, Shield, ShieldAlert, FileText,
  ChevronDown, ChevronUp, Download, ArrowLeft, Sparkles, Check, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import api from '@/lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

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
  const [pdfJobId, setPdfJobId] = useState(null);

  useEffect(() => { loadStory(); }, [storyId]);

  const loadStory = async () => {
    try {
      const { data } = await api.get(`/stories/${storyId}`);
      setStory(data);
      setScenes(data.scenes || []);
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
    } catch (err) {
      toast.error('Failed to save');
    } finally { setSavingScene(null); }
  };

  const regenerateImage = async (sceneId) => {
    setRegenScene(sceneId);
    try {
      const { data } = await api.post(`/stories/${storyId}/scenes/${sceneId}/regenerate-image`);
      toast.success('Image regeneration started!');
      const interval = setInterval(async () => {
        try {
          const { data: job } = await api.get(`/jobs/${data.job_id}`);
          if (job.status === 'completed') {
            clearInterval(interval);
            await loadStory();
            setRegenScene(null);
            toast.success('New image generated!');
          } else if (job.status === 'failed') {
            clearInterval(interval);
            setRegenScene(null);
            toast.error('Image generation failed');
          }
        } catch (_) {}
      }, 3000);
    } catch (err) {
      setRegenScene(null);
      toast.error('Failed to start regeneration');
    }
  };

  const generatePdf = async () => {
    setPdfLoading(true);
    try {
      const { data } = await api.post(`/stories/${storyId}/generate-pdf`);
      setPdfJobId(data.job_id);
      const interval = setInterval(async () => {
        try {
          const { data: job } = await api.get(`/jobs/${data.job_id}`);
          if (job.status === 'completed' && job.result_url) {
            clearInterval(interval);
            setPdfLoading(false);
            window.open(`${BACKEND_URL}${job.result_url}`, '_blank');
            toast.success('PDF ready!');
          } else if (job.status === 'failed') {
            clearInterval(interval);
            setPdfLoading(false);
            toast.error('PDF generation failed');
          }
        } catch (_) {}
      }, 2000);
    } catch (err) {
      setPdfLoading(false);
      toast.error('Failed to generate PDF');
    }
  };

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <button onClick={() => navigate('/dashboard')} className="text-sm text-[#64748B] hover:text-[#6366F1] flex items-center gap-1 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
            <h1 className="font-heading font-extrabold text-3xl tracking-tight" data-testid="scene-editor-title">
              {story?.title || 'Story Editor'}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge className="bg-[#EEF2FF] text-[#6366F1] rounded-full text-xs capitalize">{story?.tone}</Badge>
              <Badge className="bg-[#FFFBEB] text-[#D97706] rounded-full text-xs capitalize">{story?.visual_style}</Badge>
              <Badge className="bg-[#ECFDF5] text-[#10B981] rounded-full text-xs">{scenes.length} scenes</Badge>
            </div>
          </div>
          <Button
            onClick={generatePdf}
            disabled={pdfLoading || scenes.length === 0}
            data-testid="generate-pdf-btn"
            className="rounded-full bg-[#F59E0B] hover:bg-[#D97706] text-white font-accent px-6 shadow-lg shadow-[#F59E0B]/25 hover:scale-105 active:scale-95 transition-all"
          >
            {pdfLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <FileText className="w-5 h-5 mr-2" />}
            {pdfLoading ? 'Generating PDF...' : 'Export PDF'}
          </Button>
        </div>

        {/* AI Badge */}
        <div className="flex items-center gap-2 mb-8">
          <Badge className="bg-[#EEF2FF] text-[#6366F1] rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="w-3 h-3 mr-1" /> AI Generated
          </Badge>
          <Badge className="bg-[#ECFDF5] text-[#10B981] rounded-full px-3 py-1 text-xs font-medium">
            <Shield className="w-3 h-3 mr-1" /> Safety Verified
          </Badge>
        </div>

        {/* Scenes */}
        {scenes.length === 0 ? (
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
                  <div className="relative aspect-[16/9] bg-slate-100">
                    <img
                      src={`${BACKEND_URL}${scene.image_url}`}
                      alt={`Scene ${scene.scene_number}`}
                      className="w-full h-full object-cover"
                      data-testid={`scene-image-${scene.id}`}
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-black/50 text-white backdrop-blur-sm rounded-full px-3 py-1 text-xs">
                        Scene {scene.scene_number}
                      </Badge>
                    </div>
                    <div className="absolute top-4 right-4">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => regenerateImage(scene.id)}
                        disabled={regenScene === scene.id}
                        data-testid={`regen-image-${scene.id}`}
                        className="rounded-full bg-white/80 backdrop-blur-sm hover:bg-white text-[#1E293B] shadow-md"
                      >
                        {regenScene === scene.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        <span className="ml-1 text-xs">Regenerate</span>
                      </Button>
                    </div>
                    {/* Safety badge */}
                    {scene.safety_checked && (
                      <div className="absolute bottom-4 left-4">
                        {scene.safety_flagged ? (
                          <Badge className="bg-red-500/80 text-white backdrop-blur-sm rounded-full px-3 py-1 text-xs">
                            <ShieldAlert className="w-3 h-3 mr-1" /> Flagged
                          </Badge>
                        ) : (
                          <Badge className="bg-[#10B981]/80 text-white backdrop-blur-sm rounded-full px-3 py-1 text-xs">
                            <Shield className="w-3 h-3 mr-1" /> Safe
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!scene.image_url && (
                  <div className="aspect-[16/9] bg-gradient-to-br from-[#EEF2FF] to-[#FFFBEB] flex items-center justify-center">
                    <div className="text-center">
                      <Image className="w-12 h-12 text-[#6366F1]/30 mx-auto mb-2" />
                      <p className="text-sm text-[#94A3B8]">Scene {scene.scene_number} - No image</p>
                    </div>
                  </div>
                )}

                {/* Scene Content */}
                <div className="p-6 sm:p-8">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="font-heading font-bold text-xl text-[#1E293B]">
                      {scene.scene_title || `Scene ${scene.scene_number}`}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editingScene === scene.id ? setEditingScene(null) : startEdit(scene)}
                      data-testid={`edit-scene-${scene.id}`}
                      className="text-[#6366F1] hover:bg-[#EEF2FF] rounded-full"
                    >
                      <Pencil className="w-4 h-4 mr-1" /> {editingScene === scene.id ? 'Cancel' : 'Edit'}
                    </Button>
                  </div>

                  <AnimatePresence mode="wait">
                    {editingScene === scene.id ? (
                      <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                        <Textarea
                          value={editForm.scene_text}
                          onChange={(e) => setEditForm({ ...editForm, scene_text: e.target.value })}
                          data-testid={`edit-scene-text-${scene.id}`}
                          className="min-h-[120px] rounded-xl border-2 border-slate-200 focus:border-[#6366F1]"
                          placeholder="Scene text..."
                        />
                        <Textarea
                          value={editForm.narration_text}
                          onChange={(e) => setEditForm({ ...editForm, narration_text: e.target.value })}
                          data-testid={`edit-narration-${scene.id}`}
                          className="min-h-[80px] rounded-xl border-2 border-slate-200 focus:border-[#6366F1]"
                          placeholder="Narration text..."
                        />

                        <Collapsible>
                          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-[#6366F1] font-medium" data-testid={`toggle-prompts-${scene.id}`}>
                            <ChevronDown className="w-4 h-4" /> Image Prompt
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <Textarea
                              value={editForm.image_prompt}
                              onChange={(e) => setEditForm({ ...editForm, image_prompt: e.target.value })}
                              data-testid={`edit-image-prompt-${scene.id}`}
                              className="mt-2 min-h-[80px] rounded-xl border-2 border-slate-200 focus:border-[#6366F1]"
                            />
                          </CollapsibleContent>
                        </Collapsible>

                        <div className="flex gap-3">
                          <Button
                            onClick={() => saveScene(scene.id)}
                            disabled={savingScene === scene.id}
                            data-testid={`save-scene-${scene.id}`}
                            className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent shadow-lg shadow-[#6366F1]/25"
                          >
                            {savingScene === scene.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
                            Save
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
