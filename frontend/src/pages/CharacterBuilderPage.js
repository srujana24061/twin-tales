import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Wand2, Trash2, Pencil, X, Sparkles, Camera, Upload, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useCartoonization } from '@/hooks/useCartoonization';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const roles = ['hero', 'friend', 'villain', 'animal', 'imaginary'];
const traitOptions = ['brave', 'shy', 'funny', 'curious', 'kind', 'adventurous', 'smart', 'gentle', 'playful', 'creative'];
const speakingStyles = ['funny', 'shy', 'brave', 'curious', 'cheerful', 'wise'];
const emptyChar = { name: '', role: 'hero', description: '', personality_traits: [], speaking_style: '', voice_style: '', is_imaginary: false };
const roleColors = { hero: '#6366F1', friend: '#F59E0B', villain: '#EF4444', animal: '#10B981', imaginary: '#EC4899' };

export const CharacterBuilderPage = () => {
  const [characters, setCharacters] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyChar });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [uploadedCharacterUrl, setUploadedCharacterUrl] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState('cartoon');
  const [showStyleOptions, setShowStyleOptions] = useState(false);
  const [useStyledVersion, setUseStyledVersion] = useState(false);
  const fileInputRef = useRef(null);

  // Image style conversion hook
  const {
    templates,
    loadingTemplates,
    converting,
    styledResult,
    fetchTemplates,
    convertImageStyle,
    resetConversion
  } = useImageStyleConversion();

  useEffect(() => { loadCharacters(); }, []);

  const loadCharacters = async () => {
    try {
      const { data } = await api.get('/characters');
      setCharacters(data);
    } catch (err) { toast.error('Failed to load characters'); }
    finally { setLoading(false); }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      toast.error('Only JPEG, PNG, or WEBP images allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10MB)');
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async (charId) => {
    if (!photoFile) return;
    setUploadingPhoto(charId);
    try {
      const formData = new FormData();
      formData.append('file', photoFile);
      const { data } = await api.post(`/characters/${charId}/upload-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCharacters(prev => prev.map(c => c.id === charId ? data : c));
      setUploadedCharacterUrl(data.reference_image);
      toast.success('Photo uploaded!');
      setPhotoFile(null);
      setPhotoPreview(null);
      
      // Show cartoonization options after upload
      setShowCartoonOptions(true);
      await fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Photo upload failed');
    } finally { setUploadingPhoto(null); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      let charData;
      if (editId) {
        const { data } = await api.put(`/characters/${editId}`, form);
        charData = data;
        setCharacters(characters.map(c => c.id === editId ? data : c));
        toast.success('Character updated!');
      } else {
        const { data } = await api.post('/characters', form);
        charData = data;
        setCharacters([...characters, data]);
        toast.success('Character created!');
      }
      
      // Upload photo if provided
      if (photoFile && charData?.id) {
        await uploadPhoto(charData.id);
      }
      
      // Save cartoonized image if user selected it
      if (cartoonResult && charData?.id) {
        try {
          const { data: updatedChar } = await api.post(`/characters/${charData.id}/save-cartoonized`, {
            cartoonized_url: cartoonResult,
            use_cartoonized: useCartoonizedVersion
          });
          setCharacters(prev => prev.map(c => c.id === charData.id ? updatedChar : c));
          toast.success(useCartoonizedVersion ? 'Cartoonized version saved!' : 'Original version selected');
        } catch (err) {
          console.error('Failed to save cartoonized image:', err);
          toast.error('Character saved, but cartoonized image failed to save');
        }
      }
      
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleUploadForExisting = async (charId) => {
    fileInputRef.current?.click();
    fileInputRef.current.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowed.includes(file.type)) { toast.error('Only JPEG, PNG, WEBP'); return; }
      if (file.size > 10 * 1024 * 1024) { toast.error('Max 10MB'); return; }
      setUploadingPhoto(charId);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post(`/characters/${charId}/upload-photo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setCharacters(prev => prev.map(c => c.id === charId ? data : c));
        toast.success('Photo uploaded!');
        
        // Optionally trigger cartoonization flow for existing characters
        // (For now, we'll keep it simple - cartoonization only in the form)
      } catch (err) { toast.error('Upload failed'); }
      finally { setUploadingPhoto(null); fileInputRef.current.value = ''; }
    };
  };

  const handleCartoonize = async () => {
    if (!uploadedCharacterUrl) {
      toast.error('Please upload a photo first');
      return;
    }
    try {
      await startCartoonization(uploadedCharacterUrl, selectedTemplate);
    } catch (error) {
      // Error already toasted in hook
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/characters/${id}`);
      setCharacters(characters.filter(c => c.id !== id));
      toast.success('Character deleted');
    } catch (err) { toast.error('Failed to delete'); }
  };

  const startEdit = (char) => {
    setForm({ name: char.name, role: char.role, description: char.description, personality_traits: char.personality_traits || [], speaking_style: char.speaking_style || '', voice_style: char.voice_style || '', is_imaginary: char.is_imaginary || false });
    setEditId(char.id);
    setPhotoFile(null);
    setPhotoPreview(char.reference_image || null);
    setShowForm(true);
  };

  const resetForm = () => { 
    setForm({ ...emptyChar }); 
    setEditId(null); 
    setShowForm(false); 
    setPhotoFile(null); 
    setPhotoPreview(null); 
    setUploadedCharacterUrl(null);
    setShowStyleOptions(false);
    setUseStyledVersion(false);
    resetConversion();
  };

  const toggleTrait = (trait) => {
    setForm(prev => ({
      ...prev,
      personality_traits: prev.personality_traits.includes(trait)
        ? prev.personality_traits.filter(t => t !== trait)
        : [...prev.personality_traits, trait]
    }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20" data-testid="character-builder-page">
      {/* Hidden file input for existing characters */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">
              <span className="gradient-text">Character</span> Builder
            </h1>
            <p className="text-[#64748B] mt-1">Create the heroes and friends for your stories</p>
          </div>
          <Button onClick={() => { resetForm(); setShowForm(true); }} data-testid="add-character-btn"
            className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent px-6 py-5 shadow-lg shadow-[#6366F1]/25 hover:scale-105 active:scale-95 transition-all">
            <Plus className="w-5 h-5 mr-2" /> Add Character
          </Button>
        </div>

        {/* Character Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" data-testid="character-form-modal">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-heading font-bold text-xl">{editId ? 'Edit Character' : 'New Character'}</h2>
                  <button onClick={resetForm} className="text-[#94A3B8] hover:text-[#64748B]" data-testid="close-character-form"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                  {/* Photo Upload */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2"><Camera className="w-4 h-4 text-[#6366F1]" /> Character Photo</Label>
                    <div className="flex items-center gap-4">
                      <div
                        onClick={() => document.getElementById('char-photo-input')?.click()}
                        className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-[#6366F1] hover:bg-[#EEF2FF] transition-all overflow-hidden group"
                        data-testid="char-photo-upload-area"
                      >
                        {photoPreview ? (
                          <img src={photoPreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <div className="text-center">
                            <Upload className="w-6 h-6 text-[#94A3B8] group-hover:text-[#6366F1] mx-auto mb-1 transition-colors" />
                            <span className="text-[10px] text-[#94A3B8] group-hover:text-[#6366F1]">Upload</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-[#64748B]">Upload a reference photo of this character. The AI will use it to maintain visual consistency when generating story images and videos.</p>
                        <p className="text-xs text-[#94A3B8] mt-1">JPEG, PNG, WEBP (max 10MB)</p>
                        {photoPreview && (
                          <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                            className="text-xs text-red-500 hover:underline mt-1" data-testid="remove-photo-btn">Remove photo</button>
                        )}
                      </div>
                    </div>
                    <input id="char-photo-input" type="file" accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect} className="hidden" data-testid="char-photo-file-input" />
                  </div>

                  {/* Cartoonization Options - Show after character is created and photo uploaded */}
                  {showCartoonOptions && uploadedCharacterUrl && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3 p-4 bg-gradient-to-br from-[#EEF2FF] to-[#F0F9FF] rounded-xl border border-[#6366F1]/20"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-[#6366F1]" />
                        <h4 className="font-semibold text-sm text-[#1E293B]">Cartoonize Photo</h4>
                      </div>

                      {/* Template Selector */}
                      <div className="space-y-2">
                        <Label className="text-xs">Cartoon Style</Label>
                        <Select value={selectedTemplate} onValueChange={setSelectedTemplate} disabled={generating}>
                          <SelectTrigger className="h-10 rounded-lg bg-white" data-testid="cartoon-template-select">
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                          <SelectContent>
                            {loadingTemplates ? (
                              <SelectItem value="loading" disabled>Loading styles...</SelectItem>
                            ) : templates.length > 0 ? (
                              templates.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="cartoon_1">Classic Cartoon</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Cartoonize Button */}
                      <Button
                        type="button"
                        onClick={handleCartoonize}
                        disabled={generating}
                        data-testid="cartoonize-btn"
                        className="w-full h-10 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm"
                      >
                        {generating ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2"
                            />
                            Cartoonizing...
                          </>
                        ) : (
                          <>
                            <Wand2 className="w-4 h-4 mr-2" /> Cartoonize Image
                          </>
                        )}
                      </Button>

                      {/* Show result when cartoonization is complete */}
                      {cartoonResult && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-3"
                        >
                          <div className="grid grid-cols-2 gap-3">
                            {/* Original */}
                            <div 
                              onClick={() => setUseCartoonizedVersion(false)}
                              className={`cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                                !useCartoonizedVersion 
                                  ? 'border-[#6366F1] ring-2 ring-[#6366F1]/20' 
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                              data-testid="select-original-btn"
                            >
                              <div className="aspect-square bg-slate-100">
                                <img 
                                  src={photoPreview || `${BACKEND_URL}${uploadedCharacterUrl}`} 
                                  alt="Original" 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className={`p-2 text-center text-xs font-medium ${
                                !useCartoonizedVersion ? 'bg-[#6366F1] text-white' : 'bg-white text-[#64748B]'
                              }`}>
                                Original
                              </div>
                            </div>

                            {/* Cartoonized */}
                            <div 
                              onClick={() => setUseCartoonizedVersion(true)}
                              className={`cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                                useCartoonizedVersion 
                                  ? 'border-[#6366F1] ring-2 ring-[#6366F1]/20' 
                                  : 'border-slate-200 hover:border-slate-300'
                              }`}
                              data-testid="select-cartoon-btn"
                            >
                              <div className="aspect-square bg-slate-100">
                                <img 
                                  src={cartoonResult} 
                                  alt="Cartoonized" 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className={`p-2 text-center text-xs font-medium ${
                                useCartoonizedVersion ? 'bg-[#6366F1] text-white' : 'bg-white text-[#64748B]'
                              }`}>
                                Cartoonized
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-[#64748B] text-center">
                            Select which version to use for this character
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {/* Name */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Name</Label>
                    <Input data-testid="char-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Character name" className="h-12 rounded-xl border-2 border-slate-200 focus:border-[#6366F1]" required />
                  </div>

                  {/* Role */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Role</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                      <SelectTrigger className="h-12 rounded-xl border-2 border-slate-200" data-testid="char-role-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roles.map(r => <SelectItem key={r} value={r}><span className="capitalize">{r}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Description</Label>
                    <Textarea data-testid="char-description-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe your character..." className="rounded-xl border-2 border-slate-200 focus:border-[#6366F1] min-h-[80px]" />
                  </div>

                  {/* Traits */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Personality Traits</Label>
                    <div className="flex flex-wrap gap-2">
                      {traitOptions.map(trait => (
                        <button key={trait} type="button" onClick={() => toggleTrait(trait)} data-testid={`trait-${trait}`}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            form.personality_traits.includes(trait)
                              ? 'bg-[#6366F1] text-white shadow-md shadow-[#6366F1]/25'
                              : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
                          }`}>
                          {trait}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Speaking Style */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Speaking Style</Label>
                    <Select value={form.speaking_style} onValueChange={(v) => setForm({ ...form, speaking_style: v })}>
                      <SelectTrigger className="h-12 rounded-xl border-2 border-slate-200" data-testid="char-speaking-style-select"><SelectValue placeholder="Select style" /></SelectTrigger>
                      <SelectContent>
                        {speakingStyles.map(s => <SelectItem key={s} value={s}><span className="capitalize">{s}</span></SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Imaginary */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <Label className="text-sm font-medium">Imaginary Character</Label>
                      <p className="text-xs text-[#94A3B8]">Not based on a real person</p>
                    </div>
                    <Switch data-testid="char-imaginary-switch" checked={form.is_imaginary} onCheckedChange={(v) => setForm({ ...form, is_imaginary: v })} />
                  </div>

                  <Button type="submit" disabled={saving} data-testid="save-character-btn"
                    className="w-full h-12 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent shadow-lg shadow-[#6366F1]/25 hover:scale-[1.02] active:scale-95 transition-all">
                    {saving ? 'Saving...' : editId ? 'Update Character' : 'Create Character'}
                  </Button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Character Grid */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 animate-pulse">
                <div className="h-12 w-12 bg-slate-200 rounded-2xl mb-4" />
                <div className="h-5 bg-slate-200 rounded-lg w-2/3 mb-3" />
                <div className="h-4 bg-slate-100 rounded w-full mb-2" />
              </div>
            ))}
          </div>
        ) : characters.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel rounded-3xl p-16 text-center">
            <Users className="w-16 h-16 text-[#F59E0B]/30 mx-auto mb-4" />
            <h3 className="font-heading font-bold text-xl text-[#1E293B] mb-2">No characters yet</h3>
            <p className="text-[#64748B] mb-6">Create your first character to start building stories</p>
            <Button onClick={() => setShowForm(true)} data-testid="empty-add-character-btn"
              className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent px-8 shadow-lg shadow-[#6366F1]/25">
              <Wand2 className="w-5 h-5 mr-2" /> Create Character
            </Button>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((char, i) => (
              <motion.div key={char.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} whileHover={{ y: -5 }}
                className="bg-white rounded-3xl p-6 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.06)] border border-slate-100 hover:shadow-[0_20px_60px_-15px_rgba(99,102,241,0.12)] transition-shadow group"
                data-testid={`character-card-${char.id}`}>

                <div className="flex items-start justify-between mb-4">
                  {/* Avatar / Photo */}
                  <div className="relative">
                    {char.reference_image ? (
                      <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm">
                        <img src={char.reference_image.startsWith('/api') ? `${BACKEND_URL}${char.reference_image}` : char.reference_image} alt={char.name}
                          className="w-full h-full object-cover" data-testid={`char-photo-${char.id}`} />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-heading font-bold text-lg"
                        style={{ backgroundColor: roleColors[char.role] || '#6366F1' }}>
                        {char.name[0]?.toUpperCase()}
                      </div>
                    )}
                    {/* Upload photo overlay */}
                    <button
                      onClick={() => handleUploadForExisting(char.id)}
                      disabled={uploadingPhoto === char.id}
                      data-testid={`upload-photo-${char.id}`}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#6366F1] text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                    >
                      {uploadingPhoto === char.id ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-3 h-3 border border-white/30 border-t-white rounded-full" />
                      ) : (
                        <Camera className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(char)} data-testid={`edit-char-${char.id}`}
                      className="p-2 text-[#94A3B8] hover:text-[#6366F1] rounded-lg hover:bg-[#EEF2FF]">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(char.id)} data-testid={`delete-char-${char.id}`}
                      className="p-2 text-[#94A3B8] hover:text-red-500 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-heading font-bold text-lg text-[#1E293B] mb-1">{char.name}</h3>
                <Badge className="rounded-full text-xs font-medium mb-3 capitalize"
                  style={{ backgroundColor: (roleColors[char.role] || '#6366F1') + '15', color: roleColors[char.role] || '#6366F1' }}>
                  {char.role}
                </Badge>
                {char.reference_image && (
                  <div className="flex items-center gap-1 text-xs text-[#10B981] mb-2">
                    <ImageIcon className="w-3 h-3" /> Photo reference attached
                  </div>
                )}
                {char.description && <p className="text-sm text-[#64748B] mb-3 line-clamp-2">{char.description}</p>}
                {char.personality_traits?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {char.personality_traits.slice(0, 4).map(t => (
                      <span key={t} className="text-xs px-2 py-1 rounded-full bg-slate-100 text-[#64748B]">{t}</span>
                    ))}
                    {char.personality_traits.length > 4 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-[#64748B]">+{char.personality_traits.length - 4}</span>
                    )}
                  </div>
                )}
                {char.is_imaginary && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-[#EC4899]">
                    <Sparkles className="w-3 h-3" /> Imaginary
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};
