import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Scissors, Crop, Move } from 'lucide-react';

const formatTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(4, '0')}`;
};

export function VideoClipEditor({ isOpen, onClose, clip, onSave }) {
  const duration = clip?.duration || 5;
  const [activeTab, setActiveTab] = useState('trim');
  const [trimStart, setTrimStart] = useState(clip?.trimStart || 0);
  const [trimEnd, setTrimEnd] = useState(clip?.trimEnd || duration);

  const handleSave = () => {
    onSave({ ...clip, trimStart, trimEnd, playbackDuration: trimEnd - trimStart });
    onClose();
  };

  const handleReset = () => {
    setTrimStart(0);
    setTrimEnd(duration);
  };

  if (!clip) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--glass-border)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Scissors className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            Edit Clip: {clip.name}
          </DialogTitle>
        </DialogHeader>

        {/* Video preview */}
        <div className="relative aspect-video rounded-xl overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
          {clip.videoUrl ? (
            <video src={clip.videoUrl} className="w-full h-full object-cover" controls />
          ) : clip.imageUrl ? (
            <img src={clip.imageUrl} alt={clip.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--text-tertiary)' }}>No preview</div>
          )}
          <div className="absolute bottom-2 right-2 text-xs px-2 py-1 rounded-full"
            style={{ background: '#0008', color: '#fff' }}>
            {formatTime(trimEnd - trimStart)} / {formatTime(duration)}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--bg-tertiary)' }}>
          {[
            { id: 'trim', icon: Scissors, label: 'Trim' },
            { id: 'info', icon: Crop, label: 'Info' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: activeTab === t.id ? 'var(--primary)' : 'transparent',
                color: activeTab === t.id ? 'white' : 'var(--text-secondary)',
              }}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'trim' && (
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                <span>Start: {formatTime(trimStart)}</span>
                <span>End: {formatTime(trimEnd)}</span>
                <span>Duration: {formatTime(trimEnd - trimStart)}</span>
              </div>
              {/* Visual timeline */}
              <div className="relative h-10 rounded-lg overflow-hidden mb-3" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="absolute inset-y-0 rounded-lg"
                  style={{
                    left: `${(trimStart / duration) * 100}%`,
                    width: `${((trimEnd - trimStart) / duration) * 100}%`,
                    background: 'var(--primary)',
                    opacity: 0.7
                  }} />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium"
                  style={{ color: 'white' }}>Selected clip region</div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Trim Start</label>
                  <Slider value={[trimStart]} min={0} max={Math.max(0, trimEnd - 0.5)} step={0.1}
                    onValueChange={([v]) => setTrimStart(Math.min(v, trimEnd - 0.5))} />
                </div>
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>Trim End</label>
                  <Slider value={[trimEnd]} min={Math.min(trimStart + 0.5, duration)} max={duration} step={0.1}
                    onValueChange={([v]) => setTrimEnd(Math.max(v, trimStart + 0.5))} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--glass-border)' }}>
              <span>Scene</span><span className="font-medium" style={{ color: 'var(--text-primary)' }}>{clip.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b" style={{ borderColor: 'var(--glass-border)' }}>
              <span>Original Duration</span><span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatTime(duration)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span>Clip Duration</span><span className="font-medium" style={{ color: 'var(--primary)' }}>{formatTime(trimEnd - trimStart)}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={handleReset} className="rounded-xl text-xs"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
            Reset
          </Button>
          <Button variant="outline" onClick={onClose} className="rounded-xl text-xs"
            style={{ borderColor: 'var(--glass-border)', color: 'var(--text-secondary)' }}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 rounded-xl text-xs"
            style={{ background: 'var(--primary)', color: 'white' }}>
            Apply Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
