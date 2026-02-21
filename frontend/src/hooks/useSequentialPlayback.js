import { useState, useRef, useCallback, useEffect } from 'react';

export function useSequentialPlayback({ videoTracks, audioTracks, onTimeUpdate, onClipChange, onPlaybackEnd }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);

  const videoRef = useRef(null);
  const audioRefs = useRef(new Map());
  const animationFrameRef = useRef(null);
  const playbackStartTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const isPlayingRef = useRef(false);

  const allClips = (videoTracks[0] || []).slice().sort((a, b) => a.startTime - b.startTime);

  const totalDuration = allClips.reduce((max, clip) => {
    const clipEnd = clip.startTime + (clip.playbackDuration || clip.duration);
    return Math.max(max, clipEnd);
  }, 0);

  const getClipAtTime = useCallback((time) => {
    for (let i = 0; i < allClips.length; i++) {
      const clip = allClips[i];
      const clipEnd = clip.startTime + (clip.playbackDuration || clip.duration);
      if (time >= clip.startTime && time < clipEnd) return { clip, index: i };
    }
    return null;
  }, [allClips]);

  // Manage audio elements
  useEffect(() => {
    const allAudioClips = audioTracks.flat();
    allAudioClips.forEach((clip) => {
      if (!audioRefs.current.has(clip.id)) {
        const audio = new Audio(clip.url);
        audio.volume = clip.volume ?? 0.8;
        audio.muted = clip.muted ?? false;
        audioRefs.current.set(clip.id, audio);
      }
    });
    audioRefs.current.forEach((_, id) => {
      if (!allAudioClips.find((c) => c.id === id)) {
        audioRefs.current.get(id)?.pause();
        audioRefs.current.delete(id);
      }
    });
    return () => {
      audioRefs.current.forEach((a) => { a.pause(); a.src = ''; });
      audioRefs.current.clear();
    };
  }, [audioTracks]);

  const syncAudio = useCallback((time, playing) => {
    audioTracks.flat().forEach((clip) => {
      const audio = audioRefs.current.get(clip.id);
      if (!audio) return;
      const clipEnd = clip.startTime + clip.duration;
      if (time >= clip.startTime && time < clipEnd) {
        const clipTime = time - clip.startTime;
        if (Math.abs(audio.currentTime - clipTime) > 0.2) audio.currentTime = clipTime;
        if (playing && audio.paused) audio.play().catch(() => {});
        else if (!playing && !audio.paused) audio.pause();
      } else if (!audio.paused) audio.pause();
    });
  }, [audioTracks]);

  const tick = useCallback(() => {
    if (!isPlayingRef.current) return;
    const elapsed = (performance.now() - playbackStartTimeRef.current) / 1000;
    const time = pausedAtRef.current + elapsed;

    if (time >= totalDuration) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentTime(totalDuration);
      pausedAtRef.current = 0;
      onTimeUpdate?.(totalDuration);
      onPlaybackEnd?.();
      syncAudio(totalDuration, false);
      return;
    }

    setCurrentTime(time);
    onTimeUpdate?.(time);
    syncAudio(time, true);

    const result = getClipAtTime(time);
    if (result) {
      setCurrentClipIndex(prev => {
        if (prev !== result.index) { onClipChange?.(result.index, 0); return result.index; }
        return prev;
      });
      if (videoRef.current) {
        const clipLocalTime = time - result.clip.startTime + (result.clip.trimStart || 0);
        if (Math.abs(videoRef.current.currentTime - clipLocalTime) > 0.3) {
          videoRef.current.currentTime = clipLocalTime;
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick);
  }, [totalDuration, getClipAtTime, syncAudio, onTimeUpdate, onClipChange, onPlaybackEnd]);

  useEffect(() => {
    if (isPlaying) {
      isPlayingRef.current = true;
      playbackStartTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(tick);
    } else {
      isPlayingRef.current = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isPlaying, tick]);

  const play = useCallback(() => {
    if (currentTime >= totalDuration) { pausedAtRef.current = 0; setCurrentTime(0); }
    setIsPlaying(true);
  }, [currentTime, totalDuration]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    pausedAtRef.current = currentTime;
    syncAudio(currentTime, false);
    if (videoRef.current) videoRef.current.pause();
  }, [currentTime, syncAudio]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause(); else play();
  }, [isPlaying, play, pause]);

  const seek = useCallback((time) => {
    const t = Math.max(0, Math.min(time, totalDuration));
    setCurrentTime(t);
    pausedAtRef.current = t;
    const result = getClipAtTime(t);
    if (result) { setCurrentClipIndex(result.index); onClipChange?.(result.index, 0); }
    syncAudio(t, isPlaying);
    onTimeUpdate?.(t);
  }, [totalDuration, getClipAtTime, syncAudio, isPlaying, onTimeUpdate, onClipChange]);

  const stop = useCallback(() => {
    setIsPlaying(false);
    pausedAtRef.current = 0;
    setCurrentTime(0);
    setCurrentClipIndex(0);
    syncAudio(0, false);
    if (videoRef.current) videoRef.current.pause();
  }, [syncAudio]);

  const currentClip = allClips[currentClipIndex] || null;

  return {
    isPlaying, currentTime, totalDuration, currentClipIndex,
    currentClip, allClips, play, pause, togglePlay, seek, stop, videoRef,
  };
}
