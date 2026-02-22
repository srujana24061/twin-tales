import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Film, ArrowLeft, Download, Play, Pause, Square, SkipBack, SkipForward,
  Volume2, VolumeX, Music, Image as ImageIcon, Scissors, Trash2,
  Plus, Loader2, ChevronRight, ZoomIn, ZoomOut, Upload, ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { VideoClipEditor } from '@/components/VideoClipEditor';
import { MediaLibrary } from '@/components/MediaLibrary';
import { useSequentialPlayback } from '@/hooks/useSequentialPlayback';
import { useVideoExport } from '@/hooks/useVideoExport';
import api from '@/lib/api';

const API_URL = process.env.REACT_APP_BACKEND_URL;
const PX_PER_SEC = 80; // pixels per second at zoom=1

const formatTime = (s) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

// Convert a scene document to a VideoClip timeline object
const sceneToClip = (scene, startTime) => ({
  id: scene.id,
  name: scene.title || `Scene ${scene.scene_number || ''}`,
  sceneId: scene.id,
  videoUrl: scene.video_url || null,
  imageUrl: scene.image_url || null,
  audioUrl: scene.audio_url || null,
  startTime,
  duration: scene.duration_seconds || 5,
  playbackDuration: scene.duration_seconds || 5,
  trimStart: scene.trim_start_seconds || 0,
  trimEnd: scene.trim_end_seconds || (scene.duration_seconds || 5),
  sceneText: scene.scene_text || '',
});

export const VideoEditorPage = () => {
  const { storyId } = useParams();
  const navigate = useNavigate();

  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [videoTracks, setVideoTracks] = useState([[]]); // array of tracks, each track = array of clips
  const [audioTracks, setAudioTracks] = useState([[]]); // audio tracks
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [editingClip, setEditingClip] = useState(null);
  const [dragOverTrack, setDragOverTrack] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportingFull, setExportingFull] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedUrl, setExportedUrl] = useState(null);
  const [showMediaLibrary, setShowMediaLibrary] = useState(true);

  const timelineRef = useRef(null);
  const audioInputRef = useRef(null);

  const { isExporting, exportVideo, downloadIndividual } = useVideoExport();

  const playback = useSequentialPlayback({
    videoTracks,
    audioTracks,
    onTimeUpdate: () => {},
    onPlaybackEnd: () => toast.info('Playback complete'),
  });

  const pxPerSec = PX_PER_SEC * timelineZoom;
  const totalDuration = playback.totalDuration || 1;

  /* ---- Load data ---- */
  const loadStory = useCallback(async () => {
    try {
      const { data: storyData } = await api.get(`/stories/${storyId}`);
      setStory(storyData);

      const { data: scenesData } = await api.get(`/stories/${storyId}/scenes`);
      const sorted = [...scenesData].sort((a, b) => (a.scene_number || 0) - (b.scene_number || 0));

      let t = 0;
      const clips = sorted.map(scene => {
        const clip = sceneToClip(scene, t);
        t += clip.duration;
        return clip;
      });
      setVideoTracks([clips]);

      // Load audio track if any scenes have audio
      const audioClips = sorted
        .filter(s => s.audio_url)
        .map((s, i) => ({
          id: `audio-${s.id}`,
          name: `Narration ${i + 1}`,
          url: s.audio_url,
          startTime: clips.find(c => c.sceneId === s.id)?.startTime || 0,
          duration: s.duration_seconds || 5,
          volume: 0.8,
          muted: false,
        }));
      if (audioClips.length) setAudioTracks([audioClips]);
    } catch (err) {
      toast.error('Failed to load story');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [storyId, navigate]);

  useEffect(() => { loadStory(); }, [loadStory]);

  /* ---- Clip actions ---- */
  const removeClipFromTrack = (trackIdx, clipId, type = 'video') => {
    if (type === 'video') {
      setVideoTracks(prev => prev.map((track, i) =>
        i === trackIdx ? track.filter(c => c.id !== clipId) : track
      ));
    } else {
      setAudioTracks(prev => prev.map((track, i) =>
        i === trackIdx ? track.filter(c => c.id !== clipId) : track
      ));
    }
  };

  const saveEditedClip = (updated) => {
    setVideoTracks(prev => prev.map((track, i) =>
      i === editingClip.trackIdx ? track.map(c => c.id === updated.id ? updated : c) : track
    ));
    setEditingClip(null);
  };

  const addVideoTrack = () => setVideoTracks(prev => [...prev, []]);
  const addAudioTrack = () => setAudioTracks(prev => [...prev, []]);

  /* ---- Handle media from library ---- */
  const handleMediaFromLibrary = (mediaItem) => {
    const newClip = {
      id: mediaItem.id,
      name: mediaItem.name,
      videoUrl: mediaItem.type === 'video' ? mediaItem.url : null,
      imageUrl: mediaItem.type === 'image' ? mediaItem.url : null,
      startTime: totalDuration,
      duration: mediaItem.duration || 5,
      playbackDuration: mediaItem.duration || 5,
      trimStart: 0,
      trimEnd: mediaItem.duration || 5,
    };
    
    // Add to first video track
    setVideoTracks(prev => {
      const next = [...prev];
      if (next.length === 0) next.push([]);
      next[0] = [...next[0], newClip];
      return next;
    });
    
    toast.success(`Added ${mediaItem.name} to timeline`);
  };

  /* ---- Handle drop on timeline ---- */
  const handleTimelineDrop = (e, trackIdx) => {
    e.preventDefault();
    
    // Check if it's from media library
    try {
      const mediaData = e.dataTransfer.getData('application/json');
      if (mediaData) {
        const mediaItem = JSON.parse(mediaData);
        const rect = e.currentTarget.getBoundingClientRect();
        const dropX = e.clientX - rect.left;
        const startTime = Math.max(0, dropX / pxPerSec);
        
        const newClip = {
          id: `${mediaItem.id}-${Date.now()}`,
          name: mediaItem.name,
          videoUrl: mediaItem.type === 'video' ? mediaItem.url : null,
          imageUrl: mediaItem.type === 'image' ? mediaItem.url : null,
          startTime,
          duration: mediaItem.duration || 5,
          playbackDuration: mediaItem.duration || 5,
          trimStart: 0,
          trimEnd: mediaItem.duration || 5,
        };
        
        setVideoTracks(prev => prev.map((track, i) =>
          i === trackIdx ? [...track, newClip] : track
        ));
        
        toast.success(`Added ${mediaItem.name} to timeline`);
        return;
      }
    } catch (err) {
      // Not from media library, handle as clip reorder
    }
    
    // Existing clip reorder logic
    const clipId = e.dataTransfer.getData('text/clip-id');
    const fromTrack = parseInt(e.dataTransfer.getData('text/track-idx'));
    if (!clipId || isNaN(fromTrack)) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const newStart = Math.max(0, (e.clientX - rect.left) / pxPerSec);
    
    setVideoTracks(prev => {
      const next = prev.map(t => [...t]);
      const clip = next[fromTrack].find(c => c.id === clipId);
      if (!clip) return prev;
      next[fromTrack] = next[fromTrack].filter(c => c.id !== clipId);
      next[trackIdx] = [...next[trackIdx], { ...clip, startTime: newStart }];
      return next;
    });
  };

  /* ---- Drag & drop audio onto audio track ---- */
  const handleAudioDrop = (e, trackIdx) => {
    e.preventDefault();
    setDragOverTrack(null);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    if (!files.length) { toast.error('Please drop an audio file'); return; }
    const rect = timelineRef.current?.getBoundingClientRect();
    const dropX = rect ? e.clientX - rect.left : 0;
    const startTime = Math.max(0, dropX / pxPerSec);
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        setAudioTracks(prev => prev.map((track, i) => i === trackIdx
          ? [...track, { id: `audio-drop-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ''), url, startTime, duration: audio.duration, volume: 0.8, muted: false }]
          : track
        ));
      };
    });
  };

  /* ---- Handle uploaded audio file ---- */
  const handleAudioFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      setAudioTracks(prev => {
        const newTrack = { id: `audio-upload-${Date.now()}`, name: file.name.replace(/\.[^.]+$/, ''), url, startTime: 0, duration: audio.duration, volume: 0.8, muted: false };
        if (prev.length === 0) return [[newTrack]];
        return [prev[0].concat(newTrack), ...prev.slice(1)];
      });
      toast.success(`Added audio: ${file.name}`);
    };
    e.target.value = '';
  };

  /* ---- Export ---- */
  const handleExportFull = async () => {
    setExportingFull(true);
    setExportProgress(0);
    setExportedUrl(null);
    try {
      const { data } = await api.post(`/stories/${storyId}/export-video`);
      toast.info('Compiling story video on server...');
      const interval = setInterval(async () => {
        try {
          const { data: job } = await api.get(`/jobs/${data.job_id}`);
          setExportProgress(job.progress || 0);
          if (job.status === 'completed' && job.result_url) {
            clearInterval(interval);
            setExportingFull(false);
            setExportedUrl(job.result_url);
            toast.success('Story video compiled and ready to download!');
          } else if (job.status === 'failed') {
            clearInterval(interval);
            setExportingFull(false);
            toast.error(job.error_message || 'Export failed');
          }
        } catch (_) {}
      }, 3000);
    } catch (err) {
      setExportingFull(false);
      toast.error('Export failed');
    }
  };

  const handleDownloadIndividual = () => {
    const allClips = videoTracks.flat().filter(c => c.videoUrl);
    if (!allClips.length) { toast.error('No video clips to download'); return; }
    downloadIndividual(allClips, story?.title || 'scene');
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--primary)' }} />
    </div>
  );

  const allVideoClips = videoTracks.flat().sort((a, b) => a.startTime - b.startTime);
  const currentClip = playback.currentClip;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}
      data-testid="video-editor-page">

      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 z-10"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--glass-border)' }}>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/stories/${storyId}/edit`)}
            className="gap-2" style={{ color: 'var(--text-secondary)' }}
            data-testid="back-to-scenes-btn">
            <ArrowLeft className="w-4 h-4" /> Scenes
          </Button>
          <div className="h-5 w-px" style={{ background: 'var(--glass-border)' }} />
          <Film className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {story?.title || 'Video Editor'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            {allVideoClips.length} clips
          </span>
        </div>

        <div className="flex items-center gap-2">
          {exportedUrl ? (
            <a href={exportedUrl} download={`${story?.title || 'story'}.mp4`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: '#22c55e', color: 'white' }}
              data-testid="download-compiled-btn">
              <Download className="w-4 h-4" /> Download MP4
            </a>
          ) : (
            <Button size="sm" onClick={handleExportFull}
              disabled={exportingFull || allVideoClips.length === 0}
              className="rounded-xl gap-2"
              style={{ background: 'var(--primary)', color: 'white' }}
              data-testid="export-full-btn">
              {exportingFull
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {exportProgress}%</>
                : <><Download className="w-4 h-4" /> Export Story</>
              }
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleDownloadIndividual}
            disabled={isExporting} className="rounded-xl gap-2"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}
            data-testid="download-individual-btn">
            <Download className="w-4 h-4" /> Individual
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* ── LEFT: PREVIEW + CONTROLS ── */}
        <div className="w-80 flex-shrink-0 flex flex-col border-r"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--glass-border)' }}>

          {/* Video preview */}
          <div className="relative aspect-video w-full" style={{ background: '#000' }}>
            {currentClip?.videoUrl ? (
              <video
                ref={playback.videoRef}
                key={currentClip.id}
                src={currentClip.videoUrl}
                className="w-full h-full object-contain"
                muted={isMuted}
                onEnded={() => {}}
              />
            ) : currentClip?.imageUrl ? (
              <img src={currentClip.imageUrl} alt={currentClip.name}
                className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <Film className="w-10 h-10" style={{ color: '#555' }} />
                <span className="text-xs" style={{ color: '#555' }}>No preview</span>
              </div>
            )}
            {/* Time overlay */}
            <div className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#0008', color: '#fff' }}>
              {formatTime(playback.currentTime)} / {formatTime(totalDuration)}
            </div>
          </div>

          {/* Playback controls */}
          <div className="p-3 border-b space-y-3" style={{ borderColor: 'var(--glass-border)' }}>
            {/* Progress */}
            <div className="relative h-1.5 rounded-full cursor-pointer"
              style={{ background: 'var(--bg-tertiary)' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const t = ((e.clientX - rect.left) / rect.width) * totalDuration;
                playback.seek(t);
              }}>
              <div className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{ width: `${(playback.currentTime / totalDuration) * 100}%`, background: 'var(--primary)' }} />
            </div>

            <div className="flex items-center justify-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={playback.stop}
                style={{ color: 'var(--text-secondary)' }} data-testid="stop-btn">
                <Square className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => playback.seek(Math.max(0, playback.currentTime - 5))}
                style={{ color: 'var(--text-secondary)' }} data-testid="rewind-btn">
                <SkipBack className="w-4 h-4" />
              </Button>
              <Button size="icon" className="h-10 w-10 rounded-full"
                style={{ background: 'var(--primary)', color: 'white' }}
                onClick={playback.togglePlay} data-testid="play-pause-btn">
                {playback.isPlaying
                  ? <Pause className="w-5 h-5" />
                  : <Play className="w-5 h-5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => playback.seek(Math.min(totalDuration, playback.currentTime + 5))}
                style={{ color: 'var(--text-secondary)' }} data-testid="forward-btn">
                <SkipForward className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8"
                onClick={() => setIsMuted(m => !m)}
                style={{ color: isMuted ? 'var(--primary)' : 'var(--text-secondary)' }}
                data-testid="mute-btn">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2 px-1">
              <Volume2 className="w-3 h-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <Slider value={[volume * 100]} min={0} max={100} step={1}
                onValueChange={([v]) => setVolume(v / 100)} className="flex-1" />
              <span className="text-xs w-7 text-right" style={{ color: 'var(--text-tertiary)' }}>{Math.round(volume * 100)}%</span>
            </div>
          </div>

          {/* Clip list sidebar */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>CLIPS</p>
            {allVideoClips.map((clip, i) => (
              <div key={clip.id}
                className="flex items-center gap-2 p-2 rounded-xl cursor-pointer transition-all"
                style={{
                  background: playback.currentClip?.id === clip.id ? 'var(--primary-light)' : 'var(--bg-tertiary)',
                  border: `1px solid ${playback.currentClip?.id === clip.id ? 'var(--primary)' : 'transparent'}`,
                }}
                onClick={() => playback.seek(clip.startTime)}
                data-testid={`clip-item-${clip.id}`}>
                <div className="w-10 h-8 rounded-lg overflow-hidden shrink-0"
                  style={{ background: 'var(--bg-secondary)' }}>
                  {clip.imageUrl
                    ? <img src={clip.imageUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        {clip.videoUrl
                          ? <Film className="w-3 h-3" style={{ color: 'var(--primary)' }} />
                          : <ImageIcon className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />}
                      </div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{clip.name}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {formatTime(clip.startTime)} • {formatTime(clip.playbackDuration || clip.duration)}
                  </p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: clip.videoUrl ? 'var(--primary-light)' : '#f59e0b20',
                    color: clip.videoUrl ? 'var(--primary)' : '#f59e0b',
                  }}>
                  {clip.videoUrl ? 'Video' : 'Img'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: TIMELINE ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Timeline toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--glass-border)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>TIMELINE</span>
            <div className="flex-1" />

            {/* Add audio file */}
            <button
              onClick={() => audioInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ background: '#ec489920', color: '#ec4899', border: '1px solid #ec489940' }}
              data-testid="add-audio-btn">
              <Music className="w-3.5 h-3.5" /> Add Audio
            </button>
            <input ref={audioInputRef} type="file" accept="audio/*" className="hidden"
              onChange={handleAudioFileUpload} />

            <button onClick={addVideoTrack}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}
              data-testid="add-video-track-btn">
              <Plus className="w-3 h-3" /> Video Track
            </button>
            <button onClick={addAudioTrack}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}
              data-testid="add-audio-track-btn">
              <Plus className="w-3 h-3" /> Audio Track
            </button>

            {/* Zoom */}
            <div className="flex items-center gap-1">
              <button onClick={() => setTimelineZoom(z => Math.max(0.3, z - 0.2))}
                className="p-1 rounded" style={{ color: 'var(--text-secondary)' }}>
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs w-10 text-center" style={{ color: 'var(--text-secondary)' }}>
                {Math.round(timelineZoom * 100)}%
              </span>
              <button onClick={() => setTimelineZoom(z => Math.min(4, z + 0.2))}
                className="p-1 rounded" style={{ color: 'var(--text-secondary)' }}>
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable timeline area */}
          <div className="flex-1 overflow-auto" ref={timelineRef}>
            <div style={{ minWidth: `${totalDuration * pxPerSec + 200}px` }}>

              {/* Time ruler */}
              <div className="sticky top-0 z-10 h-8 flex border-b"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--glass-border)' }}>
                <div className="w-32 shrink-0 border-r" style={{ borderColor: 'var(--glass-border)' }} />
                <div className="relative flex-1">
                  {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                    <div key={i} className="absolute top-0 h-full flex flex-col justify-end pb-1"
                      style={{ left: i * pxPerSec }}>
                      <div className="w-px h-3" style={{ background: 'var(--glass-border)' }} />
                      <span className="text-[9px] ml-1" style={{ color: 'var(--text-tertiary)' }}>
                        {formatTime(i)}
                      </span>
                    </div>
                  ))}
                  {/* Playhead */}
                  <div className="absolute top-0 h-full w-0.5 pointer-events-none z-20 transition-all"
                    style={{ left: playback.currentTime * pxPerSec, background: 'var(--primary)' }}>
                    <div className="w-3 h-3 rounded-full -ml-1.5 -mt-0"
                      style={{ background: 'var(--primary)' }} />
                  </div>
                </div>
              </div>

              {/* Video Tracks */}
              {videoTracks.map((track, trackIdx) => (
                <div key={`vtrack-${trackIdx}`} className="flex border-b"
                  style={{ borderColor: 'var(--glass-border)', minHeight: 72 }}>
                  {/* Track label */}
                  <div className="w-32 shrink-0 flex items-center justify-between px-3 border-r"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--glass-border)' }}>
                    <div className="flex items-center gap-1.5">
                      <Film className="w-3 h-3" style={{ color: 'var(--primary)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Video {trackIdx + 1}
                      </span>
                    </div>
                    {trackIdx > 0 && (
                      <button onClick={() => setVideoTracks(p => p.filter((_, i) => i !== trackIdx))}
                        className="opacity-50 hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} />
                      </button>
                    )}
                  </div>

                  {/* Track clips */}
                  <div className="relative flex-1"
                    style={{ background: trackIdx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-tertiary)' }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const clipId = e.dataTransfer.getData('text/clip-id');
                      const fromTrack = parseInt(e.dataTransfer.getData('text/track-idx'));
                      if (!clipId || isNaN(fromTrack)) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const newStart = Math.max(0, (e.clientX - rect.left) / pxPerSec);
                      setVideoTracks(prev => {
                        const next = prev.map(t => [...t]);
                        const clip = next[fromTrack].find(c => c.id === clipId);
                        if (!clip) return prev;
                        next[fromTrack] = next[fromTrack].filter(c => c.id !== clipId);
                        next[trackIdx] = [...next[trackIdx], { ...clip, startTime: newStart }];
                        return next;
                      });
                    }}>
                    {track.map(clip => (
                      <motion.div key={clip.id}
                        className="absolute top-1 bottom-1 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing flex items-center"
                        style={{
                          left: clip.startTime * pxPerSec,
                          width: Math.max(40, (clip.playbackDuration || clip.duration) * pxPerSec - 2),
                          background: clip.videoUrl ? 'var(--primary)' : '#f59e0b',
                          opacity: 0.9,
                        }}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/clip-id', clip.id);
                          e.dataTransfer.setData('text/track-idx', String(trackIdx));
                        }}
                        onClick={() => playback.seek(clip.startTime)}
                        data-testid={`timeline-clip-${clip.id}`}>
                        {/* Thumbnail bg */}
                        {clip.imageUrl && (
                          <div className="absolute inset-0">
                            <img src={clip.imageUrl} alt="" className="w-full h-full object-cover opacity-30" />
                          </div>
                        )}
                        <div className="relative z-10 px-2 flex items-center justify-between w-full">
                          <span className="text-[10px] font-medium text-white truncate">{clip.name}</span>
                          <div className="flex gap-0.5 shrink-0 ml-1">
                            <button className="p-0.5 rounded hover:bg-white/20 transition-colors"
                              onClick={(e) => { e.stopPropagation(); setEditingClip({ clip, trackIdx }); }}
                              data-testid={`edit-clip-btn-${clip.id}`}>
                              <Scissors className="w-2.5 h-2.5 text-white" />
                            </button>
                            <button className="p-0.5 rounded hover:bg-white/20 transition-colors"
                              onClick={(e) => { e.stopPropagation(); removeClipFromTrack(trackIdx, clip.id); }}
                              data-testid={`remove-clip-btn-${clip.id}`}>
                              <Trash2 className="w-2.5 h-2.5 text-white" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {track.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs"
                        style={{ color: 'var(--text-tertiary)' }}>
                        Drag clips here
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Audio Tracks */}
              {audioTracks.map((track, trackIdx) => (
                <div key={`atrack-${trackIdx}`} className="flex border-b"
                  style={{ borderColor: 'var(--glass-border)', minHeight: 56 }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverTrack({ type: 'audio', index: trackIdx }); }}
                  onDragLeave={() => setDragOverTrack(null)}
                  onDrop={(e) => handleAudioDrop(e, trackIdx)}>
                  {/* Track label */}
                  <div className="w-32 shrink-0 flex items-center justify-between px-3 border-r"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--glass-border)' }}>
                    <div className="flex items-center gap-1.5">
                      <Music className="w-3 h-3" style={{ color: '#ec4899' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Audio {trackIdx + 1}
                      </span>
                    </div>
                    {trackIdx > 0 && (
                      <button onClick={() => setAudioTracks(p => p.filter((_, i) => i !== trackIdx))}>
                        <Trash2 className="w-3 h-3" style={{ color: '#ef4444', opacity: 0.5 }} />
                      </button>
                    )}
                  </div>

                  {/* Audio clips */}
                  <div className="relative flex-1"
                    style={{
                      background: dragOverTrack?.type === 'audio' && dragOverTrack.index === trackIdx
                        ? '#ec489910' : 'var(--bg-primary)',
                    }}>
                    {track.map(clip => (
                      <div key={clip.id}
                        className="absolute top-1 bottom-1 rounded-xl flex items-center px-2"
                        style={{
                          left: clip.startTime * pxPerSec,
                          width: Math.max(40, clip.duration * pxPerSec - 2),
                          background: '#ec489930',
                          border: '1px solid #ec489960',
                        }}
                        data-testid={`audio-clip-${clip.id}`}>
                        <Music className="w-3 h-3 shrink-0 mr-1.5" style={{ color: '#ec4899' }} />
                        <span className="text-[10px] truncate font-medium" style={{ color: '#ec4899' }}>{clip.name}</span>
                        <button className="ml-auto shrink-0 p-0.5 opacity-60 hover:opacity-100"
                          onClick={() => removeClipFromTrack(trackIdx, clip.id, 'audio')}>
                          <Trash2 className="w-2.5 h-2.5" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    ))}
                    {track.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs gap-2"
                        style={{ color: 'var(--text-tertiary)', borderStyle: 'dashed', borderWidth: 1, borderColor: 'var(--glass-border)', margin: 4, borderRadius: 8 }}>
                        <Upload className="w-3 h-3" /> Drop audio file here or click "Add Audio"
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Export progress bar (full width) */}
              {exportingFull && (
                <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--glass-border)' }}>
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" style={{ color: 'var(--primary)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Compiling story video… {exportProgress}%</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${exportProgress}%`, background: 'var(--primary)' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Clip editor dialog */}
      {editingClip && (
        <VideoClipEditor
          isOpen
          onClose={() => setEditingClip(null)}
          clip={editingClip.clip}
          onSave={saveEditedClip}
        />
      )}
    </div>
  );
};
