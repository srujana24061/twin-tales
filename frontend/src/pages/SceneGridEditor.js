import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Edit2, Save, Image as ImageIcon, Video, Upload, 
  Sparkles, Loader2, CheckCircle, Play, X, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/lib/api';

export const SceneGridEditor = () => {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingScene, setEditingScene] = useState(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [generatingImages, setGeneratingImages] = useState({});
  const [generatingVideos, setGeneratingVideos] = useState({});

  useEffect(() => {
    loadData();
  }, [storyId]);

  const loadData = async () => {
    try {
      const { data: storyData } = await api.get(`/stories/${storyId}`);
      setStory(storyData);
      
      const { data: scenesData } = await api.get(`/stories/${storyId}/scenes`);
      setScenes(scenesData);
    } catch (err) {
      toast.error('Failed to load story');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const updateSceneText = async (sceneId, newText) => {
    try {
      await api.put(`/scenes/${sceneId}`, { scene_text: newText });
      setScenes(scenes.map(s => s.id === sceneId ? { ...s, scene_text: newText } : s));
      setEditingScene(null);
      toast.success('Scene updated');
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const pollJob = (jobId, onDone) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(`/jobs/${jobId}`);
        if (data.status === 'completed') {
          clearInterval(interval);
          onDone(null);
          await loadData();
        } else if (data.status === 'failed') {
          clearInterval(interval);
          onDone(data.error_message || 'Generation failed');
        }
      } catch (_) {}
    }, 3000);
    return interval;
  };

  const generateSceneImage = async (sceneId) => {
    setGeneratingImages(prev => ({ ...prev, [sceneId]: true }));
    try {
      toast.info('Generating image with Nano Banana...');
      await api.post(`/scenes/${sceneId}/generate-image`);
      await loadData();
      toast.success('Image generated!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate image');
    } finally {
      setGeneratingImages(prev => ({ ...prev, [sceneId]: false }));
    }
  };

  const generateSceneVideo = async (sceneId) => {
    setGeneratingVideos(prev => ({ ...prev, [sceneId]: true }));
    try {
      toast.info('Generating video with Nano Banana...');
      const { data } = await api.post(`/scenes/${sceneId}/generate-video`);
      toast.success('Video generation started! Hang tight...');
      pollJob(data.job_id, (err) => {
        setGeneratingVideos(prev => ({ ...prev, [sceneId]: false }));
        if (err) toast.error(err);
        else toast.success('Video ready!');
      });
    } catch (err) {
      setGeneratingVideos(prev => ({ ...prev, [sceneId]: false }));
      toast.error('Failed to generate video');
    }
  };

  const uploadMedia = async (sceneId, file, mediaType) => {
    try {
      toast.info(`Uploading ${mediaType}...`);
      
      const { data: presignedData } = await api.post('/media/presigned-url', null, {
        params: { filename: file.name, content_type: file.type }
      });

      await fetch(presignedData.presigned_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      const updateData = mediaType === 'image' 
        ? { image_url: presignedData.s3_url }
        : { video_url: presignedData.s3_url };
      
      await api.put(`/scenes/${sceneId}`, updateData);
      toast.success(`${mediaType} uploaded!`);
      await loadData();
    } catch (err) {
      toast.error(`Upload failed`);
    }
  };

  const handleGenerateAllVideos = async () => {
    try {
      setBatchGenerating(true);
      const { data } = await api.post(`/stories/${storyId}/batch-generate-videos`);
      toast.success(data.message || 'All videos queued for generation!');
      toast.info('You\'ll receive an email notification when complete');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start generation');
    } finally {
      setBatchGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'hsl(var(--primary))' }} />
      </div>
    );
  }

  const scenesWithImages = scenes.filter(s => s.image_url).length;
  const scenesWithVideos = scenes.filter(s => s.video_url).length;

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                style={{ color: 'var(--text-secondary)' }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center gap-2 text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Characters</span>
                <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                <span style={{ color: 'var(--text-secondary)' }}>Story</span>
                <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Scenes</span>
                <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                <span style={{ color: 'var(--text-secondary)' }}>Editor</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {scenesWithImages}/{scenes.length} images
              </div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {scenesWithVideos}/{scenes.length} videos
              </div>
              <Button
                onClick={handleGenerateAllVideos}
                disabled={batchGenerating || scenesWithImages === 0}
                style={{ background: '#f97316', color: 'white' }}
                className="rounded-lg"
              >
                {batchGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Generate All Videos</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Story Header */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          {story?.title}
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>{story?.user_topic}</p>
      </div>

      {/* Scenes Grid */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenes.map((scene, idx) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              sceneNumber={idx + 1}
              isEditing={editingScene === scene.id}
              isGeneratingImage={generatingImages[scene.id]}
              isGeneratingVideo={generatingVideos[scene.id]}
              onStartEdit={() => setEditingScene(scene.id)}
              onSaveEdit={(text) => updateSceneText(scene.id, text)}
              onCancelEdit={() => setEditingScene(null)}
              onGenerateImage={() => generateSceneImage(scene.id)}
              onGenerateVideo={() => generateSceneVideo(scene.id)}
              onUploadImage={(file) => uploadMedia(scene.id, file, 'image')}
              onUploadVideo={(file) => uploadMedia(scene.id, file, 'video')}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneCard = ({
  scene,
  sceneNumber,
  isEditing,
  isGeneratingImage,
  isGeneratingVideo,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onGenerateImage,
  onGenerateVideo,
  onUploadImage,
  onUploadVideo
}) => {
  const [editText, setEditText] = useState(scene.scene_text || '');
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--glass-border)' }}
    >
      {/* Scene Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--glass-border)', background: 'var(--bg-secondary)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-1 rounded" 
              style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              Scene {sceneNumber}
            </span>
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              {scene.title}
            </h3>
          </div>
          {scene.image_url && (
            <CheckCircle className="w-4 h-4" style={{ color: '#22c55e' }} />
          )}
        </div>
      </div>

      {/* Image Preview */}
      <div className="relative aspect-video flex items-center justify-center"
        style={{ background: 'var(--bg-tertiary)' }}>
        {scene.image_url ? (
          <img src={scene.image_url} alt={scene.title} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-12 h-12" style={{ color: 'var(--text-tertiary)' }} />
        )}
      </div>

      {/* Scene Text */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="text-sm rounded-xl"
              style={{ 
                background: 'var(--bg-secondary)', 
                borderColor: 'var(--glass-border)',
                color: 'var(--text-primary)'
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onSaveEdit(editText)}
                className="flex-1 rounded-lg"
                style={{ background: 'var(--primary)', color: 'white' }}
              >
                <Save className="w-3 h-3 mr-2" /> Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelEdit}
                className="rounded-lg"
                style={{ borderColor: 'var(--glass-border)' }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            onClick={onStartEdit}
            className="text-sm leading-relaxed cursor-pointer hover:opacity-80 line-clamp-3 group relative"
            style={{ color: 'var(--text-secondary)' }}
          >
            {scene.scene_text}
            <Edit2 className="w-3 h-3 absolute top-0 right-0 opacity-0 group-hover:opacity-100" 
              style={{ color: 'var(--text-tertiary)' }} />
          </div>
        )}

        {/* Action Buttons */}
        {!isEditing && (
          <div className="mt-4 space-y-2">
            {/* Image Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={onGenerateImage}
                disabled={isGeneratingImage}
                className="flex-1 rounded-lg"
                style={{ borderColor: 'var(--glass-border)', color: 'var(--text-primary)' }}
                data-testid={`generate-image-btn-${scene.id}`}
              >
                {isGeneratingImage ? (
                  <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-3 h-3 mr-2" />{scene.image_url ? 'Regenerate Image' : 'Generate Image'}</>
                )}
              </Button>
              {scene.image_url && !isGeneratingImage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onGenerateImage}
                  className="rounded-lg"
                  style={{ borderColor: 'var(--glass-border)', color: 'var(--primary)' }}
                  title="Regenerate image"
                  data-testid={`regen-image-btn-${scene.id}`}
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => imageInputRef.current?.click()}
                disabled={isGeneratingImage}
                className="rounded-lg"
                style={{ borderColor: 'var(--glass-border)' }}
                title="Upload image"
              >
                <Upload className="w-3 h-3" />
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadImage(file);
                }}
              />
            </div>

            {/* Video Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={onGenerateVideo}
                className="flex-1 rounded-lg"
                style={{ 
                  background: '#f97316', 
                  color: 'white',
                }}
                data-testid={`generate-video-btn-${scene.id}`}
              >
                <Video className="w-3 h-3 mr-2" />
                Generate Video
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => videoInputRef.current?.click()}
                className="rounded-lg"
                style={{ borderColor: 'var(--glass-border)' }}
              >
                <Upload className="w-3 h-3" />
              </Button>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadVideo(file);
                }}
              />
            </div>

            {scene.video_url && (
              <div className="flex items-center gap-2 text-xs px-2 py-1 rounded"
                style={{ background: '#22c55e20', color: '#22c55e' }}>
                <CheckCircle className="w-3 h-3" />
                Video Ready
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SceneGridEditor;
