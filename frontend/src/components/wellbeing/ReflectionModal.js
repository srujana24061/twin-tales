import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Heart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import api from '@/lib/api';

const MOOD_OPTIONS = [
  { emoji: '😄', value: 'happy', label: 'Happy' },
  { emoji: '🤩', value: 'amazed', label: 'Amazed' },
  { emoji: '😌', value: 'calm', label: 'Calm' },
  { emoji: '🤔', value: 'thoughtful', label: 'Thoughtful' },
  { emoji: '😢', value: 'sad', label: 'Sad' },
  { emoji: '😴', value: 'sleepy', label: 'Sleepy' },
];

export const ReflectionModal = ({ storyId, storyTitle, onClose }) => {
  const [selectedMood, setSelectedMood] = useState('');
  const [whatILiked, setWhatILiked] = useState('');
  const [whatILearned, setWhatILearned] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedMood) {
      toast.error('Please select how you feel!');
      return;
    }
    setSaving(true);
    try {
      await api.post('/wellbeing/reflections', {
        story_id: storyId,
        mood_emoji: selectedMood,
        what_i_liked: whatILiked,
        what_i_learned: whatILearned,
      });
      toast.success('Reflection saved! 🎉');
      onClose(true);
    } catch (err) {
      toast.error('Could not save reflection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
      data-testid="reflection-modal">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-panel rounded-3xl p-8 max-w-lg w-full shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-5 h-5" style={{ color: '#EC4899' }} />
              <h2 className="font-heading font-bold text-xl" style={{ color: 'hsl(var(--foreground))' }}>
                Story Reflection
              </h2>
            </div>
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {storyTitle || 'Your Story'}
            </p>
          </div>
          <button onClick={() => onClose(false)} data-testid="reflection-close-btn"
            className="p-1 rounded-full transition-colors hover:bg-red-100"
            style={{ color: 'hsl(var(--muted-foreground))' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium mb-3 block" style={{ color: 'hsl(var(--foreground))' }}>
              How did this story make you feel?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MOOD_OPTIONS.map(mood => (
                <button key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  data-testid={`mood-${mood.value}`}
                  className={`p-3 rounded-2xl flex flex-col items-center gap-1 transition-all ${
                    selectedMood === mood.value ? 'scale-105' : 'hover:scale-105'
                  }`}
                  style={{
                    background: selectedMood === mood.value ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                    borderWidth: 2,
                    borderColor: selectedMood === mood.value ? 'hsl(var(--primary))' : 'transparent',
                  }}>
                  <span className="text-2xl">{mood.emoji}</span>
                  <span className="text-xs font-medium" style={{ color: 'hsl(var(--foreground))' }}>{mood.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: 'hsl(var(--foreground))' }}>
              What did you like about it? (Optional)
            </label>
            <Textarea value={whatILiked} onChange={e => setWhatILiked(e.target.value)}
              data-testid="reflection-liked"
              placeholder="The funny characters, the magical places..."
              rows={2}
              className="resize-none rounded-xl text-sm"
              style={{ background: 'hsl(var(--muted))', borderColor: 'var(--glass-border)', color: 'hsl(var(--foreground))' }}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block" style={{ color: 'hsl(var(--foreground))' }}>
              What did you learn? (Optional)
            </label>
            <Textarea value={whatILearned} onChange={e => setWhatILearned(e.target.value)}
              data-testid="reflection-learned"
              placeholder="I learned that it's important to be kind..."
              rows={2}
              className="resize-none rounded-xl text-sm"
              style={{ background: 'hsl(var(--muted))', borderColor: 'var(--glass-border)', color: 'hsl(var(--foreground))' }}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onClose(false)}
              data-testid="reflection-skip-btn"
              className="flex-1 rounded-xl" style={{ borderColor: 'var(--glass-border)' }}>
              Skip
            </Button>
            <Button onClick={handleSave} disabled={saving || !selectedMood}
              data-testid="reflection-save-btn"
              className="flex-1 rounded-xl flex items-center gap-2"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
              <Sparkles className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};