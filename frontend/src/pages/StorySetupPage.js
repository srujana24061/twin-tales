import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, BookOpen, Palette, Film, Music, GraduationCap, ArrowRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import api from '@/lib/api';

const tones = [
  { value: 'funny', label: 'Funny', icon: '~', color: '#F59E0B' },
  { value: 'adventure', label: 'Adventure', icon: '~', color: '#6366F1' },
  { value: 'bedtime', label: 'Bedtime', icon: '~', color: '#8B5CF6' },
  { value: 'educational', label: 'Educational', icon: '~', color: '#10B981' },
];
const visualStyles = [
  { value: 'cartoon', label: 'Cartoon' },
  { value: 'realistic', label: 'Realistic' },
  { value: 'anime', label: 'Anime' },
  { value: 'watercolor', label: 'Watercolor' },
];
const lengths = [
  { value: 'short', label: 'Short (3 scenes)' },
  { value: 'medium', label: 'Medium (5 scenes)' },
  { value: 'long', label: 'Long (8 scenes)' },
];

const imageProviders = [
  { value: 'nano_banana', label: 'Gemini Nano Banana (Default)' },
  { value: 'minimax', label: 'MiniMax Hailuo' },
];

const aspectRatios = [
  { value: '16:9', label: '16:9 Widescreen' },
  { value: '4:3', label: '4:3 Classic' },
  { value: '1:1', label: '1:1 Square' },
  { value: '3:4', label: '3:4 Portrait' },
  { value: '9:16', label: '9:16 Vertical' },
];

export const StorySetupPage = () => {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputMode, setInputMode] = useState('topic');
  const [form, setForm] = useState({
    title: '', tone: 'funny', visual_style: 'cartoon', video_style: 'narrated',
    moral_theme: '', story_length: 'medium', image_provider: 'nano_banana', image_aspect_ratio: '16:9', character_ids: [],
    user_topic: '', user_full_story: '',
  });

  useEffect(() => {
    api.get('/characters').then(({ data }) => setCharacters(data)).catch(() => {});
  }, []);

  const toggleChar = (id) => {
    setForm(prev => ({
      ...prev,
      character_ids: prev.character_ids.includes(id)
        ? prev.character_ids.filter(c => c !== id)
        : [...prev.character_ids, id]
    }));
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('Give your story a title'); return; }
    if (inputMode === 'topic' && !form.user_topic.trim()) { toast.error('Enter a story topic'); return; }
    if (inputMode === 'full' && !form.user_full_story.trim()) { toast.error('Enter your story text'); return; }
    setLoading(true);
    try {
      const { data: story } = await api.post('/stories', { ...form, story_type: 'original' });
      const { data: job } = await api.post(`/stories/${story.id}/generate`);
      toast.success('Story generation started!');
      navigate(`/stories/${story.id}/generate?job=${job.job_id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create story');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20" data-testid="story-setup-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-10">
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">
            Create a <span className="gradient-text">New Story</span>
          </h1>
          <p className="text-[#64748B] mt-1">Set up your story details and let AI do the magic</p>
        </div>

        <div className="space-y-8">
          {/* Title */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100">
            <Label className="text-sm font-bold text-[#1E293B] mb-3 block">Story Title</Label>
            <Input
              data-testid="story-title-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="The Adventures of Little Bear..."
              className="h-14 rounded-xl border-2 border-slate-200 focus:border-[#6366F1] text-lg"
            />
          </div>

          {/* Tone */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100">
            <Label className="text-sm font-bold text-[#1E293B] mb-4 block">Story Tone</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tones.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, tone: t.value })}
                  data-testid={`tone-${t.value}`}
                  className={`p-4 rounded-2xl text-center font-medium text-sm transition-all border-2 ${
                    form.tone === t.value
                      ? 'border-[#6366F1] bg-[#EEF2FF] text-[#6366F1] shadow-md shadow-[#6366F1]/10'
                      : 'border-slate-100 hover:border-slate-200 text-[#64748B]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Style & Length */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100">
              <Label className="text-sm font-bold text-[#1E293B] mb-3 block"><Palette className="w-4 h-4 inline mr-2 text-[#6366F1]" />Visual Style</Label>
              <Select value={form.visual_style} onValueChange={(v) => setForm({ ...form, visual_style: v })}>
                <SelectTrigger className="h-12 rounded-xl border-2 border-slate-200" data-testid="visual-style-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {visualStyles.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100">
              <Label className="text-sm font-bold text-[#1E293B] mb-3 block"><BookOpen className="w-4 h-4 inline mr-2 text-[#F59E0B]" />Story Length</Label>
              <Select value={form.story_length} onValueChange={(v) => setForm({ ...form, story_length: v })}>
                <SelectTrigger className="h-12 rounded-xl border-2 border-slate-200" data-testid="story-length-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {lengths.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Image Settings */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100">
              <Label className="text-sm font-bold text-[#1E293B] mb-3 block"><Film className="w-4 h-4 inline mr-2 text-[#6366F1]" />Image Model</Label>
              <Select value={form.image_provider} onValueChange={(v) => setForm({ ...form, image_provider: v })}>
                <SelectTrigger className="h-12 rounded-xl border-2 border-slate-200" data-testid="story-image-provider-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {imageProviders.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100">
              <Label className="text-sm font-bold text-[#1E293B] mb-3 block"><Film className="w-4 h-4 inline mr-2 text-[#F59E0B]" />Image Aspect Ratio</Label>
              <Select value={form.image_aspect_ratio} onValueChange={(v) => setForm({ ...form, image_aspect_ratio: v })}>
                <SelectTrigger className="h-12 rounded-xl border-2 border-slate-200" data-testid="aspect-ratio-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {aspectRatios.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Moral Theme */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100">
            <Label className="text-sm font-bold text-[#1E293B] mb-3 block"><GraduationCap className="w-4 h-4 inline mr-2 text-[#10B981]" />Learning Theme (optional)</Label>
            <Input
              data-testid="moral-theme-input"
              value={form.moral_theme}
              onChange={(e) => setForm({ ...form, moral_theme: e.target.value })}
              placeholder="kindness, friendship, courage, honesty..."
              className="h-12 rounded-xl border-2 border-slate-200 focus:border-[#6366F1]"
            />
          </div>

          {/* Characters */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100">
            <Label className="text-sm font-bold text-[#1E293B] mb-4 block"><Users className="w-4 h-4 inline mr-2 text-[#EC4899]" />Select Characters (optional)</Label>
            {characters.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No characters yet. <button onClick={() => navigate('/characters')} className="text-[#6366F1] hover:underline">Create some</button></p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {characters.map(c => (
                  <div
                    key={c.id}
                    onClick={() => toggleChar(c.id)}
                    data-testid={`select-char-${c.id}`}
                    className={`flex items-center gap-3 p-4 rounded-xl text-left transition-all border-2 cursor-pointer ${
                      form.character_ids.includes(c.id)
                        ? 'border-[#6366F1] bg-[#EEF2FF]'
                        : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <Checkbox checked={form.character_ids.includes(c.id)} className="pointer-events-none" />
                    <div>
                      <p className="font-medium text-sm text-[#1E293B]">{c.name}</p>
                      <p className="text-xs text-[#94A3B8] capitalize">{c.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Story Input */}
          <div className="bg-white rounded-3xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100">
            <Label className="text-sm font-bold text-[#1E293B] mb-4 block"><Sparkles className="w-4 h-4 inline mr-2 text-[#F59E0B]" />Story Input</Label>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setInputMode('topic')}
                data-testid="input-mode-topic"
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${inputMode === 'topic' ? 'bg-[#6366F1] text-white' : 'bg-slate-100 text-[#64748B]'}`}
              >
                From Topic
              </button>
              <button
                onClick={() => setInputMode('full')}
                data-testid="input-mode-full"
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${inputMode === 'full' ? 'bg-[#6366F1] text-white' : 'bg-slate-100 text-[#64748B]'}`}
              >
                Full Story
              </button>
            </div>

            {inputMode === 'topic' ? (
              <Input
                data-testid="story-topic-input"
                value={form.user_topic}
                onChange={(e) => setForm({ ...form, user_topic: e.target.value })}
                placeholder="A shy dragon learns to be brave..."
                className="h-12 rounded-xl border-2 border-slate-200 focus:border-[#6366F1]"
              />
            ) : (
              <Textarea
                data-testid="story-full-text-input"
                value={form.user_full_story}
                onChange={(e) => setForm({ ...form, user_full_story: e.target.value })}
                placeholder="Once upon a time, there was a little dragon who lived in a big cave..."
                className="min-h-[150px] rounded-xl border-2 border-slate-200 focus:border-[#6366F1]"
              />
            )}
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleCreate}
            disabled={loading}
            data-testid="generate-story-btn"
            className="w-full h-14 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent text-lg shadow-xl shadow-[#6366F1]/25 hover:scale-[1.02] active:scale-95 transition-all"
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <><Sparkles className="w-5 h-5 mr-2" /> Generate Story <ArrowRight className="w-5 h-5 ml-2" /></>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
