import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/lib/api';

const MOOD_OPTIONS = [
  { emoji: '😄', label: 'Happy', value: 'happy' },
  { emoji: '🤩', label: 'Amazed', value: 'amazed' },
  { emoji: '😌', label: 'Calm', value: 'calm' },
  { emoji: '🤔', label: 'Thoughtful', value: 'thoughtful' },
  { emoji: '😢', label: 'Sad', value: 'sad' },
  { emoji: '😴', label: 'Sleepy', value: 'sleepy' },
];

export const ReflectionModal = ({ storyId, storyTitle, onClose, onSaved }) => {
  const [selectedMood, setSelectedMood] = useState(null);
  const [liked, setLiked] = useState('');
  const [learned, setLearned] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedMood) return;
    setSaving(true);
    try {
      await api.post('/wellbeing/reflections', {
        story_id: storyId,
        mood_emoji: selectedMood,
        what_i_liked: liked,
        what_i_learned: learned,
      });
      toast.success('Reflection saved!');
      onSaved && onSaved();
      onClose();
    } catch (err) {
      toast.error('Could not save reflection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)' }}>
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="w-full max-w-sm glass-panel rounded-3xl overflow-hidden shadow-2xl"
          data-testid="reflection-modal"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
                <span className="font-bold text-base" style={{ color: 'hsl(var(--foreground))' }}>
                  Story Reflection
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                You just finished "{storyTitle}"
              </p>
            </div>
            <button onClick={onClose} data-testid="reflection-close-btn"
              className="p-1.5 rounded-full hover:bg-black/10 transition-colors"
              style={{ color: 'hsl(var(--muted-foreground))' }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Mood selector */}
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: 'hsl(var(--foreground))' }}>
                How did this story make you feel?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {MOOD_OPTIONS.map(m => (
                  <motion.button
                    key={m.value}
                    onClick={() => setSelectedMood(m.value)}
                    whileTap={{ scale: 0.92 }}
                    data-testid={`reflection-mood-${m.value}`}
                    className="flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all"
                    style={{
                      background: selectedMood === m.value ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                      borderColor: selectedMood === m.value ? 'hsl(var(--primary))' : 'transparent',
                      boxShadow: selectedMood === m.value ? '0 0 0 2px hsl(var(--primary) / 0.3)' : 'none',
                    }}
                  >
                    <span className="text-2xl">{m.emoji}</span>
                    <span className="text-xs font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                      {m.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Questions */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold block mb-1.5"
                  style={{ color: 'hsl(var(--muted-foreground))' }}>
                  What did you like most?
                </label>
                <Textarea
                  value={liked}
                  onChange={e => setLiked(e.target.value)}
                  placeholder="The brave elephant... the funny monkey..."
                  rows={2}
                  data-testid="reflection-liked-input"
                  className="rounded-xl text-sm resize-none"
                  style={{
                    background: 'hsl(var(--muted))',
                    borderColor: 'var(--glass-border)',
                    color: 'hsl(var(--foreground))',
                  }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1.5"
                  style={{ color: 'hsl(var(--muted-foreground))' }}>
                  What did you learn?
                </label>
                <Textarea
                  value={learned}
                  onChange={e => setLearned(e.target.value)}
                  placeholder="I learned that being brave..."
                  rows={2}
                  data-testid="reflection-learned-input"
                  className="rounded-xl text-sm resize-none"
                  style={{
                    background: 'hsl(var(--muted))',
                    borderColor: 'var(--glass-border)',
                    color: 'hsl(var(--foreground))',
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="ghost" onClick={onClose}
                className="flex-1 rounded-2xl" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Maybe Later
              </Button>
              <Button
                onClick={handleSave}
                disabled={!selectedMood || saving}
                data-testid="reflection-save-btn"
                className="flex-2 rounded-2xl font-semibold flex-1"
                style={{
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  opacity: !selectedMood ? 0.5 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Reflection'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
