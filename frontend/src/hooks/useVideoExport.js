import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export function useVideoExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');

  const exportVideo = useCallback(async (videoTracks, audioTracks, options, apiExportFn) => {
    setIsExporting(true);
    setExportProgress(0);
    setExportStage('Starting export...');

    try {
      // Use backend export (imageio-based) instead of WASM FFmpeg
      if (apiExportFn) {
        setExportStage('Compiling scenes on server...');
        const result = await apiExportFn(options);
        setExportProgress(100);
        setExportStage('Export complete!');
        toast.success(`Video exported: ${options.filename || 'story'}.mp4`);
        return result;
      }

      // Fallback: download individual clips
      const allClips = videoTracks.flat().sort((a, b) => a.startTime - b.startTime);
      for (let i = 0; i < allClips.length; i++) {
        const clip = allClips[i];
        setExportStage(`Downloading clip ${i + 1}/${allClips.length}...`);
        setExportProgress(Math.round((i / allClips.length) * 100));
        const resp = await fetch(clip.videoUrl);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${options.filename || 'scene'}_${String(i + 1).padStart(3, '0')}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 300));
      }
      setExportProgress(100);
      setExportStage('Downloads complete!');
      toast.success(`Downloaded ${allClips.length} clips`);
      return { success: true };
    } catch (err) {
      toast.error(`Export failed: ${err.message || 'Unknown error'}`);
      return { success: false, error: err };
    } finally {
      setIsExporting(false);
      setTimeout(() => { setExportProgress(0); setExportStage(''); }, 2000);
    }
  }, []);

  const downloadIndividual = useCallback(async (clips, filename) => {
    setIsExporting(true);
    setExportStage('Downloading clips...');
    try {
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        setExportProgress(Math.round((i / clips.length) * 100));
        const resp = await fetch(clip.videoUrl);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${String(i + 1).padStart(3, '0')}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 300));
      }
      toast.success(`Downloaded ${clips.length} clips`);
    } catch (err) {
      toast.error('Failed to download clips');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      setExportStage('');
    }
  }, []);

  return { isExporting, exportProgress, exportStage, exportVideo, downloadIndividual };
}
