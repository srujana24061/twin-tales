import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Sparkles, Copy, Check, Loader2, Instagram, Youtube, MessageCircle,
  Facebook, Linkedin, Hash, Quote, MousePointerClick, Image, Film
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const platforms = [
  { id: 'instagram', label: 'Instagram Reel', icon: Instagram, aspect: '9:16', color: '#E4405F' },
  { id: 'youtube', label: 'YouTube Short', icon: Youtube, aspect: '9:16', color: '#FF0000' },
  { id: 'whatsapp', label: 'WhatsApp Status', icon: MessageCircle, aspect: '9:16', color: '#25D366' },
  { id: 'facebook', label: 'Facebook Feed', icon: Facebook, aspect: '4:5', color: '#1877F2' },
  { id: 'linkedin', label: 'LinkedIn Post', icon: Linkedin, aspect: '1:1', color: '#0A66C2' },
];

const styles = [
  { value: 'emotional', label: 'Emotional' },
  { value: 'funny', label: 'Funny' },
  { value: 'educational', label: 'Educational' },
  { value: 'action', label: 'Action' },
];

export const AdStudioPage = () => {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState('instagram');
  const [adStyle, setAdStyle] = useState('emotional');
  const [ctaText, setCtaText] = useState('Watch the full story!');
  const [generating, setGenerating] = useState(false);
  const [ads, setAds] = useState([]);
  const [copied, setCopied] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [storyRes, adsRes] = await Promise.all([
        api.get(`/stories/${storyId}`),
        api.get(`/stories/${storyId}/ads`),
      ]);
      setStory(storyRes.data);
      setAds(adsRes.data);
    } catch (err) { toast.error('Failed to load'); navigate('/dashboard'); }
    finally { setLoading(false); }
  }, [storyId, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const generateAd = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/stories/${storyId}/generate-ad`, {
        platform: selectedPlatform,
        style: adStyle,
        cta_text: ctaText,
      });
      toast.success('Ad generation started!');
      const interval = setInterval(async () => {
        try {
          const { data: job } = await api.get(`/jobs/${data.job_id}`);
          if (job.status === 'completed') {
            clearInterval(interval);
            setGenerating(false);
            await loadData();
            toast.success('Ad content ready!');
          } else if (job.status === 'failed') {
            clearInterval(interval);
            setGenerating(false);
            toast.error(job.error_message || 'Generation failed');
          }
        } catch (_) {}
      }, 2000);
    } catch (err) { setGenerating(false); toast.error('Failed to generate'); }
  };

  const copyToClipboard = async (text, field) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Copied!');
  };

  const getPlatformConfig = (id) => platforms.find(p => p.id === id) || platforms[0];

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-[#6366F1] mx-auto" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20" data-testid="ad-studio-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-8">
          <button onClick={() => navigate(`/stories/${storyId}/edit`)} className="text-sm text-[#64748B] hover:text-[#6366F1] flex items-center gap-1 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Scene Editor
          </button>
          <h1 className="font-heading font-extrabold text-3xl tracking-tight">
            <span className="gradient-text">Ad</span> Studio
          </h1>
          <p className="text-[#64748B] mt-1">Create social media promotions for "{story?.title}"</p>
        </div>

        {/* Config Section */}
        <div className="bg-white rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100 p-6 sm:p-8 mb-8">
          <h2 className="font-heading font-bold text-lg mb-6">Create New Ad</h2>

          {/* Platform Selection */}
          <div className="mb-6">
            <p className="text-sm font-medium text-[#1E293B] mb-3">Platform</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {platforms.map(p => (
                <button key={p.id} onClick={() => setSelectedPlatform(p.id)}
                  data-testid={`platform-${p.id}`}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    selectedPlatform === p.id
                      ? 'border-[#6366F1] bg-[#EEF2FF] shadow-md'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}>
                  <p.icon className="w-6 h-6" style={{ color: p.color }} />
                  <span className="text-xs font-medium text-[#1E293B]">{p.label}</span>
                  <span className="text-[10px] text-[#94A3B8]">{p.aspect}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style & CTA */}
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm font-medium text-[#1E293B] mb-2">Ad Style</p>
              <Select value={adStyle} onValueChange={setAdStyle}>
                <SelectTrigger className="h-12 rounded-xl border-2 border-slate-200" data-testid="ad-style-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {styles.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm font-medium text-[#1E293B] mb-2">Call to Action</p>
              <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)}
                data-testid="ad-cta-input"
                className="h-12 rounded-xl border-2 border-slate-200 focus:border-[#6366F1]"
                placeholder="Watch the full story!" />
            </div>
          </div>

          <Button onClick={generateAd} disabled={generating}
            data-testid="generate-ad-btn"
            className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent px-8 py-5 shadow-lg shadow-[#6366F1]/25 hover:scale-105 active:scale-95 transition-all">
            {generating ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="w-5 h-5 mr-2" /> Generate Ad Content</>}
          </Button>
        </div>

        {/* Generated Ads */}
        {ads.length > 0 && (
          <div className="space-y-6">
            <h2 className="font-heading font-bold text-lg">Generated Ads ({ads.length})</h2>

            {ads.map((ad, i) => {
              const pConfig = getPlatformConfig(ad.platform);
              return (
                <motion.div key={ad.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-3xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden"
                  data-testid={`ad-card-${ad.id}`}>

                  {/* Ad Header */}
                  <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: pConfig.color + '15' }}>
                        <pConfig.icon className="w-5 h-5" style={{ color: pConfig.color }} />
                      </div>
                      <div>
                        <p className="font-heading font-bold text-base">{pConfig.label}</p>
                        <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                          <span>{ad.aspect_ratio}</span>
                          <span className="capitalize">{ad.style}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-0">
                    {/* Content */}
                    <div className="p-6 space-y-5">
                      {/* Hook */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Quote className="w-4 h-4 text-[#F59E0B]" />
                          <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wide">Hook</p>
                        </div>
                        <p className="text-[#1E293B] font-medium text-base leading-relaxed">{ad.hook_text}</p>
                      </div>

                      {/* Caption */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wide">Caption</p>
                          <button onClick={() => copyToClipboard(ad.caption + '\n\n' + ad.hashtags, `caption-${ad.id}`)}
                            data-testid={`copy-caption-${ad.id}`}
                            className="text-xs text-[#6366F1] hover:underline flex items-center gap-1">
                            {copied === `caption-${ad.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied === `caption-${ad.id}` ? 'Copied!' : 'Copy All'}
                          </button>
                        </div>
                        <p className="text-sm text-[#475569] leading-relaxed">{ad.caption}</p>
                      </div>

                      {/* Hashtags */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-[#6366F1]" />
                            <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wide">Hashtags</p>
                          </div>
                          <button onClick={() => copyToClipboard(ad.hashtags, `hash-${ad.id}`)}
                            data-testid={`copy-hashtags-${ad.id}`}
                            className="text-xs text-[#6366F1] hover:underline flex items-center gap-1">
                            {copied === `hash-${ad.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <p className="text-sm text-[#6366F1]">{ad.hashtags}</p>
                      </div>

                      {/* CTA */}
                      <div className="bg-[#EEF2FF] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <MousePointerClick className="w-4 h-4 text-[#6366F1]" />
                          <p className="text-xs font-bold text-[#6366F1] uppercase tracking-wide">Call to Action</p>
                        </div>
                        <p className="text-sm font-medium text-[#4338CA]">{ad.cta_text}</p>
                      </div>
                    </div>

                    {/* Scene Previews */}
                    <div className="p-6 bg-slate-50 border-l border-slate-100">
                      <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wide mb-3">Selected Scenes</p>
                      <div className="space-y-3">
                        {(ad.selected_scenes || []).map((ss, j) => (
                          <div key={j} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
                            <div className="w-16 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                              {ss.image_url ? (
                                <img src={`${BACKEND_URL}${ss.image_url}`} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><Image className="w-4 h-4 text-[#CBD5E1]" /></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1E293B] truncate">{ss.scene_title || `Scene ${ss.scene_number}`}</p>
                              <div className="flex gap-2">
                                {ss.video_url && <Badge className="bg-[#EEF2FF] text-[#6366F1] rounded-full text-[10px] px-2 py-0"><Film className="w-2.5 h-2.5 mr-0.5 inline" /> Video</Badge>}
                                {ss.image_url && <Badge className="bg-[#FFFBEB] text-[#D97706] rounded-full text-[10px] px-2 py-0"><Image className="w-2.5 h-2.5 mr-0.5 inline" /> Image</Badge>}
                              </div>
                            </div>
                            {ad.overlay_texts?.[j] && (
                              <p className="text-[10px] text-[#94A3B8] italic max-w-[120px] truncate">"{ad.overlay_texts[j]}"</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {ads.length === 0 && !generating && (
          <div className="glass-panel rounded-3xl p-12 text-center">
            <Sparkles className="w-12 h-12 text-[#6366F1]/30 mx-auto mb-3" />
            <p className="text-[#64748B]">No ads created yet. Select a platform and generate your first promotional content!</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
