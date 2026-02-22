import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Sparkles, Copy, Check, Loader2, Instagram, Youtube, MessageCircle,
  Facebook, Linkedin, Hash, Quote, MousePointerClick, Image, Film, Share2, Download, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const platforms = [
  { id: 'instagram', label: 'Instagram Post', icon: Instagram, aspect: '1:1', color: '#E4405F' },
  { id: 'instagram_reel', label: 'Instagram Reel', icon: Instagram, aspect: '9:16', color: '#E4405F' },
  { id: 'youtube', label: 'YouTube Video', icon: Youtube, aspect: '16:9', color: '#FF0000' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', icon: Youtube, aspect: '9:16', color: '#FF0000' },
  { id: 'whatsapp', label: 'WhatsApp Status', icon: MessageCircle, aspect: '9:16', color: '#25D366' },
  { id: 'tiktok', label: 'TikTok Video', icon: Film, aspect: '4:3', color: '#000000' },
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

  const shareToSocialMedia = (ad) => {
    const pConfig = getPlatformConfig(ad.platform);
    const shareText = `${ad.hook_text}\n\n${ad.caption}\n\n${ad.hashtags}\n\n${ad.cta_text}`;
    const shareUrl = window.location.origin; // Replace with actual story URL when available
    
    const shareHandlers = {
      whatsapp: () => {
        const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank');
      },
      facebook: () => {
        const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank', 'width=600,height=400');
      },
      linkedin: () => {
        const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        window.open(url, '_blank', 'width=600,height=600');
      },
      instagram: () => {
        // Instagram doesn't support direct web sharing
        // Copy to clipboard and show instructions
        copyToClipboard(shareText, `share-${ad.id}`);
        toast.info('Content copied! Open Instagram app to post', { duration: 5000 });
      },
      instagram_reel: () => {
        copyToClipboard(shareText, `share-${ad.id}`);
        toast.info('Content copied! Open Instagram app to create a Reel', { duration: 5000 });
      },
      youtube: () => {
        copyToClipboard(shareText, `share-${ad.id}`);
        toast.info('Content copied! Open YouTube Studio to upload', { duration: 5000 });
      },
      youtube_shorts: () => {
        copyToClipboard(shareText, `share-${ad.id}`);
        toast.info('Content copied! Open YouTube app to create a Short', { duration: 5000 });
      },
      tiktok: () => {
        copyToClipboard(shareText, `share-${ad.id}`);
        toast.info('Content copied! Open TikTok app to post', { duration: 5000 });
      },
    };

    const handler = shareHandlers[ad.platform];
    if (handler) {
      handler();
    } else {
      // Fallback: use Web Share API if available
      if (navigator.share) {
        navigator.share({
          title: ad.hook_text,
          text: shareText,
          url: shareUrl,
        }).catch(() => {
          copyToClipboard(shareText, `share-${ad.id}`);
        });
      } else {
        copyToClipboard(shareText, `share-${ad.id}`);
      }
    }
  };

  const downloadAdContent = (ad) => {
    const pConfig = getPlatformConfig(ad.platform);
    const content = `
${pConfig.label} Ad Content
${'='.repeat(50)}

Hook:
${ad.hook_text}

Caption:
${ad.caption}

Hashtags:
${ad.hashtags}

Call to Action:
${ad.cta_text}

Platform: ${pConfig.label}
Aspect Ratio: ${ad.aspect_ratio}
Style: ${ad.style}

Selected Scenes:
${(ad.selected_scenes || []).map((s, i) => `${i + 1}. ${s.scene_title || `Scene ${s.scene_number}`}`).join('\n')}

${'='.repeat(50)}
Generated by Twinnee AI
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pConfig.label.replace(/\s+/g, '_')}_Ad_${ad.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Ad content downloaded!');
  };

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
                    <div className="flex items-center justify-between">
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
                      
                      {/* Share Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => shareToSocialMedia(ad)}
                          size="sm"
                          data-testid={`share-btn-${ad.id}`}
                          className="rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#4F46E5] hover:to-[#7C3AED] text-white shadow-md hover:shadow-lg transition-all"
                        >
                          <Share2 className="w-3.5 h-3.5 mr-1.5" />
                          Share to {pConfig.label.split(' ')[0]}
                        </Button>
                        <Button
                          onClick={() => downloadAdContent(ad)}
                          size="sm"
                          variant="outline"
                          data-testid={`download-btn-${ad.id}`}
                          className="rounded-full border-2 border-slate-200 hover:border-[#6366F1] hover:bg-[#EEF2FF] transition-all"
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-0">
                    {/* Scene Images - Large Preview */}
                    <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wide">Visual Preview</p>
                        <Badge className="bg-white text-[#64748B] rounded-full text-[10px] px-3 py-1">
                          {ad.selected_scenes?.length || 0} Scenes
                        </Badge>
                      </div>
                      
                      {/* Image Gallery */}
                      <div className="space-y-3">
                        {(ad.selected_scenes || []).map((ss, j) => (
                          <motion.div 
                            key={j}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: j * 0.1 }}
                            className="bg-white rounded-2xl overflow-hidden shadow-lg"
                          >
                            {/* Scene Image */}
                            <div 
                              className={`relative w-full bg-slate-200 ${
                                ad.aspect_ratio === '1:1' ? 'aspect-square' :
                                ad.aspect_ratio === '16:9' ? 'aspect-[16/9]' :
                                ad.aspect_ratio === '9:16' ? 'aspect-[9/16]' :
                                ad.aspect_ratio === '4:3' ? 'aspect-[4/3]' :
                                ad.aspect_ratio === '4:5' ? 'aspect-[4/5]' :
                                'aspect-video'
                              }`}
                            >
                              {ss.image_url ? (
                                <>
                                  <img 
                                    src={ss.image_url} 
                                    alt={ss.scene_title || `Scene ${ss.scene_number}`}
                                    className="w-full h-full object-cover"
                                  />
                                  {/* Overlay Text */}
                                  {ad.overlay_texts?.[j] && (
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end">
                                      <p className="text-white font-bold text-lg sm:text-xl p-4 leading-tight drop-shadow-lg">
                                        {ad.overlay_texts[j]}
                                      </p>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <div className="text-center">
                                    <Image className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                    <p className="text-sm text-slate-400">No image</p>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Scene Info */}
                            <div className="p-3 border-t border-slate-100">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-[#1E293B]">
                                    {ss.scene_title || `Scene ${ss.scene_number}`}
                                  </p>
                                  <p className="text-xs text-[#94A3B8]">Scene {ss.scene_number}</p>
                                </div>
                                <div className="flex gap-1.5">
                                  {ss.image_url && (
                                    <Badge className="bg-[#FFFBEB] text-[#D97706] rounded-full text-[10px] px-2 py-0.5">
                                      <Image className="w-2.5 h-2.5 mr-0.5 inline" /> Image
                                    </Badge>
                                  )}
                                  {ss.video_url && (
                                    <Badge className="bg-[#EEF2FF] text-[#6366F1] rounded-full text-[10px] px-2 py-0.5">
                                      <Film className="w-2.5 h-2.5 mr-0.5 inline" /> Video
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5 bg-white">
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

                      {/* Quick Share Options */}
                      <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-wide mb-3">Quick Actions</p>
                        <div className="grid grid-cols-2 gap-2">
                          {/* Copy All Content */}
                          <button
                            onClick={() => copyToClipboard(`${ad.hook_text}\n\n${ad.caption}\n\n${ad.hashtags}\n\n${ad.cta_text}`, `all-${ad.id}`)}
                            className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-slate-200 hover:border-[#6366F1] hover:bg-[#EEF2FF] transition-all text-sm font-medium text-[#1E293B]"
                          >
                            {copied === `all-${ad.id}` ? (
                              <><Check className="w-4 h-4 text-green-600" /> Copied!</>
                            ) : (
                              <><Copy className="w-4 h-4" /> Copy All</>
                            )}
                          </button>
                          
                          {/* Open Platform */}
                          <button
                            onClick={() => {
                              const platformUrls = {
                                instagram: 'https://www.instagram.com',
                                instagram_reel: 'https://www.instagram.com/reels',
                                youtube: 'https://studio.youtube.com',
                                youtube_shorts: 'https://www.youtube.com/upload',
                                whatsapp: 'https://web.whatsapp.com',
                                tiktok: 'https://www.tiktok.com/upload',
                                facebook: 'https://www.facebook.com',
                                linkedin: 'https://www.linkedin.com/feed',
                              };
                              window.open(platformUrls[ad.platform] || '#', '_blank');
                            }}
                            className="flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-slate-200 hover:border-[#6366F1] hover:bg-[#EEF2FF] transition-all text-sm font-medium text-[#1E293B]"
                          >
                            <ExternalLink className="w-4 h-4" /> Open {pConfig.label.split(' ')[0]}
                          </button>
                        </div>
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
