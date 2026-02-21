import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Edit3, Save, Image as ImageIcon, Video, Upload, 
  Sparkles, Loader2, CheckCircle, AlertCircle, Play, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/api';

export const SceneEditorPageNew = () => {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [frames, setFrames] = useState({});
  const [loading, setLoading] = useState(true);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [expandedScenes, setExpandedScenes] = useState({});
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [tempDesc, setTempDesc] = useState('');

  useEffect(() => {
    loadStoryData();
  }, [storyId]);

  const loadStoryData = async () => {
    try {
      setLoading(true);
      const { data: storyData } = await api.get(`/stories/${storyId}`);
      setStory(storyData);
      setTempTitle(storyData.title);
      setTempDesc(storyData.user_topic || '');

      const { data: scenesData } = await api.get(`/stories/${storyId}/scenes`);
      setScenes(scenesData);

      // Load frames for each scene
      const framesMap = {};
      for (const scene of scenesData) {
        try {
          const { data: sceneFrames } = await api.get(`/scenes/${scene.id}/frames`);
          framesMap[scene.id] = sceneFrames;
        } catch (err) {
          framesMap[scene.id] = [];
        }
      }
      setFrames(framesMap);

      // Expand first scene by default
      if (scenesData.length > 0) {
        setExpandedScenes({ [scenesData[0].id]: true });
      }
    } catch (err) {
      toast.error('Failed to load story');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const saveStoryMetadata = async () => {
    try {
      await api.put(`/stories/${storyId}`, {
        title: tempTitle,
        user_topic: tempDesc
      });
      setStory({ ...story, title: tempTitle, user_topic: tempDesc });
      setEditingTitle(false);
      setEditingDesc(false);
      toast.success('Saved!');
    } catch (err) {
      toast.error('Failed to save');
    }
  };

  const toggleScene = (sceneId) => {
    setExpandedScenes(prev => ({ ...prev, [sceneId]: !prev[sceneId] }));
  };

  const updateFrameText = async (frameId, newText) => {
    try {
      await api.put(`/frames/${frameId}`, { text: newText });
      toast.success('Frame updated');
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const generateFrameImage = async (frameId, frameText) => {
    try {
      toast.info('Generating image...');
      const { data } = await api.post(`/frames/${frameId}/generate-image`, {
        prompt: frameText
      });
      
      // Reload frames
      await loadStoryData();
      toast.success('Image generated!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate image');
    }
  };

  const generateFrameVideo = async (frameId, imageUrl) => {
    if (!imageUrl) {
      toast.error('Generate or upload an image first');
      return;
    }
    try {
      toast.info('Generating video...');
      const { data } = await api.post(`/frames/${frameId}/generate-video`);
      toast.success('Video generation started! You\'ll be notified when ready.');
      
      // Reload after a delay
      setTimeout(() => loadStoryData(), 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate video');
    }
  };

  const uploadMedia = async (frameId, file, mediaType) => {
    try {
      toast.info(`Uploading ${mediaType}...`);
      
      // Get presigned URL
      const { data: presignedData } = await api.post('/media/presigned-url', null, {
        params: {
          filename: file.name,
          content_type: file.type
        }
      });

      // Upload to S3
      await fetch(presignedData.presigned_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      // Update frame with S3 URL
      const updateData = mediaType === 'image' 
        ? { image_url: presignedData.s3_url }
        : { video_url: presignedData.s3_url };
      
      await api.put(`/frames/${frameId}`, updateData);
      
      toast.success(`${mediaType} uploaded!`);
      await loadStoryData();
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`);
    }
  };

  const handleGenerateAllVideos = async () => {
    try {
      setBatchGenerating(true);
      const { data } = await api.post(`/stories/${storyId}/generate-all-videos`);
      toast.success(data.message || 'All videos queued for generation!');
      toast.info('You\'ll receive an email when complete', { duration: 5000 });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start batch generation');
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

  const totalFrames = Object.values(frames).reduce((sum, f) => sum + f.length, 0);
  const framesWithImages = Object.values(frames).flat().filter(f => f.image_url).length;
  const framesWithVideos = Object.values(frames).flat().filter(f => f.video_url).length;

  return (
    <div className="min-h-screen theme-page-bg pb-20" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: '#1a1a1a', background: '#0f0f0f' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Characters</span>
                <span className="text-gray-600">→</span>
                <span className="text-gray-500">Story</span>
                <span className="text-gray-600">→</span>
                <span className="text-white font-medium">Scenes</span>
                <span className="text-gray-600">→</span>
                <span className="text-gray-500">Editor</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500">
                {scenes.length}/5 scenes
              </div>
              <div className="text-xs text-gray-500">
                {framesWithImages}/{totalFrames} images
              </div>
              <Button
                onClick={handleGenerateAllVideos}
                disabled={batchGenerating || framesWithImages === 0}
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-4">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                className="text-2xl font-bold bg-[#1a1a1a] border-[#333] text-white"
                autoFocus
              />
              <Button size="sm" onClick={saveStoryMetadata}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <h1
              className="text-2xl font-bold text-white flex items-center gap-2 cursor-pointer hover:text-orange-500"
              onClick={() => setEditingTitle(true)}
            >
              {story?.title}
              <Edit3 className="w-4 h-4 text-gray-500" />
            </h1>
          )}

          {editingDesc ? (
            <div className="flex items-start gap-2">
              <Textarea
                value={tempDesc}
                onChange={(e) => setTempDesc(e.target.value)}
                className="bg-[#1a1a1a] border-[#333] text-gray-300"
                rows={3}
              />
              <Button size="sm" onClick={saveStoryMetadata}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <p
              className="text-gray-400 leading-relaxed cursor-pointer hover:text-gray-300"
              onClick={() => setEditingDesc(true)}
            >
              {story?.user_topic || 'No description'}
              <Edit3 className="w-3 h-3 ml-2 inline text-gray-600" />
            </p>
          )}
        </div>
      </div>

      {/* Scenes */}
      <div className="max-w-7xl mx-auto px-6 space-y-6">
        {scenes.map((scene, sceneIdx) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            sceneIdx={sceneIdx}
            frames={frames[scene.id] || []}
            expanded={expandedScenes[scene.id]}
            onToggle={() => toggleScene(scene.id)}
            onUpdateFrameText={updateFrameText}
            onGenerateImage={generateFrameImage}
            onGenerateVideo={generateFrameVideo}
            onUploadMedia={uploadMedia}
          />
        ))}
      </div>
    </div>
  );
};

const SceneCard = ({
  scene,
  sceneIdx,
  frames,
  expanded,
  onToggle,
  onUpdateFrameText,
  onGenerateImage,
  onGenerateVideo,
  onUploadMedia
}) => {
  const [editingFrameText, setEditingFrameText] = useState({});
  const [tempFrameText, setTempFrameText] = useState({});

  const handleSaveFrameText = async (frameId) => {
    await onUpdateFrameText(frameId, tempFrameText[frameId]);
    setEditingFrameText({ ...editingFrameText, [frameId]: false });
  };

  const imagesReady = frames.filter(f => f.image_url).length;
  const videosReady = frames.filter(f => f.video_url).length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#151515', border: '1px solid #222' }}>
      {/* Scene Header */}
      <div
        className="p-4 flex items-start justify-between cursor-pointer hover:bg-[#1a1a1a]"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {expanded ? (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            )}
            <span className="text-xs font-medium text-gray-500">Scene {String(sceneIdx + 1).padStart(2, '0')}</span>
            <h3 className="text-lg font-semibold text-white">{scene.title}</h3>
            <Edit3 className="w-4 h-4 text-gray-600" />
          </div>
          <p className="text-gray-400 text-sm ml-8">{scene.text}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{imagesReady}/{frames.length} images</span>
          <span>{videosReady}/{frames.length} videos</span>
        </div>
      </div>

      {/* Frames */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pt-0"
          >
            {frames.map((frame, frameIdx) => (
              <FrameCard
                key={frame.id}
                frame={frame}
                frameIdx={frameIdx}
                editingText={editingFrameText[frame.id]}
                tempText={tempFrameText[frame.id] || frame.text}
                onEditText={() => {
                  setEditingFrameText({ ...editingFrameText, [frame.id]: true });
                  setTempFrameText({ ...tempFrameText, [frame.id]: frame.text });
                }}
                onSaveText={() => handleSaveFrameText(frame.id)}
                onChangeText={(val) => setTempFrameText({ ...tempFrameText, [frame.id]: val })}
                onGenerateImage={() => onGenerateImage(frame.id, frame.text)}
                onGenerateVideo={() => onGenerateVideo(frame.id, frame.image_url)}
                onUploadImage={(file) => onUploadMedia(frame.id, file, 'image')}
                onUploadVideo={(file) => onUploadMedia(frame.id, file, 'video')}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FrameCard = ({
  frame,
  frameIdx,
  editingText,
  tempText,
  onEditText,
  onSaveText,
  onChangeText,
  onGenerateImage,
  onGenerateVideo,
  onUploadImage,
  onUploadVideo
}) => {
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
      {/* Frame Header */}
      <div className="p-3 border-b" style={{ borderColor: '#2a2a2a' }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-400">Frame {frameIdx + 1}</span>
          {frame.image_url && (
            <span className="text-xs px-2 py-1 rounded" style={{ background: '#22c55e20', color: '#22c55e' }}>
              <CheckCircle className="w-3 h-3 inline mr-1" />
              Image Ready
            </span>
          )}
        </div>
      </div>

      {/* Image Preview */}
      <div className="relative aspect-video bg-[#0a0a0a] flex items-center justify-center">
        {frame.image_url ? (
          <img src={frame.image_url} alt={`Frame ${frameIdx + 1}`} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-12 h-12 text-gray-700" />
        )}
      </div>

      {/* Frame Text */}
      <div className="p-3">
        {editingText ? (
          <div className="space-y-2">
            <Textarea
              value={tempText}
              onChange={(e) => onChangeText(e.target.value)}
              className="text-sm bg-[#0f0f0f] border-[#333] text-gray-300"
              rows={3}
            />
            <Button size="sm" onClick={onSaveText} className="w-full">
              <Save className="w-3 h-3 mr-2" /> Save
            </Button>
          </div>
        ) : (
          <p
            className="text-sm text-gray-400 leading-relaxed cursor-pointer hover:text-gray-300 line-clamp-3"
            onClick={onEditText}
          >
            {frame.text}
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onGenerateImage}
              className="flex-1 bg-[#0f0f0f] border-[#333] text-gray-300 hover:bg-[#1a1a1a]"
            >
              <Sparkles className="w-3 h-3 mr-2" />
              Generate Image
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => imageInputRef.current?.click()}
              className="bg-[#0f0f0f] border-[#333] text-gray-300 hover:bg-[#1a1a1a]"
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

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onGenerateVideo}
              disabled={!frame.image_url}
              className="flex-1 rounded-lg"
              style={{ background: frame.image_url ? '#f97316' : '#333', color: 'white' }}
            >
              <Video className="w-3 h-3 mr-2" />
              Generate Video
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => videoInputRef.current?.click()}
              className="bg-[#0f0f0f] border-[#333] text-gray-300 hover:bg-[#1a1a1a]"
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
        </div>
      </div>
    </div>
  );
};

export default SceneEditorPageNew;
