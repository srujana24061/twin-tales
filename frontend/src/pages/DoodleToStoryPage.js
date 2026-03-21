import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Pencil, Upload, Wand2, Eraser, Undo, Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export const DoodleToStoryPage = () => {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [ctx, setCtx] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [converting, setConverting] = useState(false);
  const [convertedImage, setConvertedImage] = useState(null);
  
  // User choices
  const [creationMethod, setCreationMethod] = useState('');
  const [characterStyle, setCharacterStyle] = useState('');
  const [characterRole, setCharacterRole] = useState('');
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#1E293B');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 800;
      canvas.height = 600;
      const context = canvas.getContext('2d');
      context.lineCap = 'round';
      context.lineJoin = 'round';
      setCtx(context);
      
      // Set white background
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // Drawing functions
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const convertDoodleToCharacter = async () => {
    const canvas = canvasRef.current;
    const imageDataUrl = canvas.toDataURL('image/png');
    const base64Data = imageDataUrl.split(',')[1];

    setConverting(true);
    try {
      const { data } = await api.post('/doodle/convert-to-character', {
        image_base64: base64Data,
        style: characterStyle,
        role: characterRole
      });

      if (data.converted_image_url) {
        setConvertedImage(data.converted_image_url);
        toast.success('Your doodle has been transformed into a character!');
      }
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Failed to convert doodle. Please try again.');
    } finally {
      setConverting(false);
    }
  };

  const createStoryWithCharacter = async () => {
    try {
      // Create character with converted image
      const { data: character } = await api.post('/characters', {
        name: `${characterRole} Character`,
        role: characterRole,
        description: `A ${characterStyle} style character created from a doodle`,
        reference_image: convertedImage,
        created_from_doodle: true
      });

      toast.success('Character created! Redirecting to story setup...');
      
      // Navigate to story setup with pre-selected character
      setTimeout(() => {
        navigate('/stories/new', { state: { selectedCharacters: [character.id] } });
      }, 1500);
    } catch (error) {
      console.error('Error creating character:', error);
      toast.error('Failed to create character');
    }
  };

  // Question configurations
  const questions = [
    {
      step: 1,
      question: "How would you like to create your character?",
      options: [
        { value: 'draw', label: 'Draw a Doodle', icon: Pencil, description: 'Sketch your character idea' },
        { value: 'upload', label: 'Upload Photo', icon: Upload, description: 'Use an existing image' },
        { value: 'ai', label: 'AI Generate', icon: Wand2, description: 'Describe with text' }
      ],
      selected: creationMethod,
      setSelected: setCreationMethod
    },
    {
      step: 2,
      question: "What style do you want?",
      options: [
        { value: '3d_cartoon', label: '3D Cartoon', description: 'Smooth, rounded Disney-style' },
        { value: 'anime', label: 'Anime', description: 'Japanese anime aesthetic' },
        { value: 'realistic', label: 'Realistic', description: 'Lifelike and detailed' },
        { value: 'pixar', label: 'Pixar Style', description: 'Glossy 3D character' }
      ],
      selected: characterStyle,
      setSelected: setCharacterStyle
    },
    {
      step: 3,
      question: "What's your character's role?",
      options: [
        { value: 'hero', label: 'Hero', description: 'Main protagonist' },
        { value: 'villain', label: 'Villain', description: 'Antagonist' },
        { value: 'animal', label: 'Animal', description: 'Friendly creature' },
        { value: 'magical', label: 'Magical Creature', description: 'Fantasy being' }
      ],
      selected: characterRole,
      setSelected: setCharacterRole
    }
  ];

  const currentQuestion = questions.find(q => q.step === currentStep);
  const canProceed = currentQuestion?.selected;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-white to-[#F0F9FF] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-[#64748B] hover:text-[#1E293B] transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
          <Badge className="bg-[#6366F1] text-white px-4 py-2">
            <Sparkles className="w-4 h-4 mr-2 inline" />
            Doodle to Story
          </Badge>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                currentStep >= step ? 'bg-[#6366F1] text-white' : 'bg-slate-200 text-slate-400'
              }`}>
                {step === 4 ? <Sparkles className="w-5 h-5" /> : step}
              </div>
              {step < 4 && (
                <div className={`w-16 sm:w-24 h-1 transition-all ${
                  currentStep > step ? 'bg-[#6366F1]' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Question Steps */}
          {currentStep <= 3 && (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              <h2 className="text-3xl font-heading font-bold text-center mb-3 text-[#1E293B]">
                {currentQuestion.question}
              </h2>
              <p className="text-center text-[#64748B] mb-8">Step {currentStep} of 3</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {currentQuestion.options.map((option) => (
                  <motion.button
                    key={option.value}
                    onClick={() => currentQuestion.setSelected(option.value)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-6 rounded-2xl border-2 transition-all text-left ${
                      currentQuestion.selected === option.value
                        ? 'border-[#6366F1] bg-[#EEF2FF] shadow-lg'
                        : 'border-slate-200 bg-white hover:border-[#6366F1]/50 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {option.icon && (
                        <div className={`p-3 rounded-xl ${
                          currentQuestion.selected === option.value ? 'bg-[#6366F1] text-white' : 'bg-slate-100 text-[#64748B]'
                        }`}>
                          <option.icon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-[#1E293B] mb-1">{option.label}</h3>
                        <p className="text-sm text-[#64748B]">{option.description}</p>
                      </div>
                      {currentQuestion.selected === option.value && (
                        <Check className="w-6 h-6 text-[#6366F1]" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="flex justify-center gap-4">
                {currentStep > 1 && (
                  <Button variant="outline" onClick={() => setCurrentStep(currentStep - 1)} className="rounded-full px-8">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                )}
                <Button 
                  onClick={() => setCurrentStep(currentStep + 1)} 
                  disabled={!canProceed}
                  className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white px-8"
                >
                  {currentStep === 3 ? 'Start Drawing' : 'Next'} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Drawing Canvas */}
          {currentStep === 4 && !convertedImage && (
            <motion.div
              key="canvas"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white rounded-3xl shadow-2xl p-8">
                <div className="mb-6">
                  <h2 className="text-2xl font-heading font-bold text-[#1E293B] mb-2">Draw Your Character</h2>
                  <p className="text-[#64748B]">Sketch your {characterRole} character - it will be converted to {characterStyle} style!</p>
                </div>

                {/* Drawing Tools */}
                <div className="flex items-center gap-4 mb-4 p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-[#64748B]">Brush Size:</label>
                    <input 
                      type="range" 
                      min="1" 
                      max="20" 
                      value={brushSize} 
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm font-medium text-[#1E293B]">{brushSize}px</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-[#64748B]">Color:</label>
                    <input 
                      type="color" 
                      value={brushColor} 
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="w-12 h-8 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex-1" />

                  <Button size="sm" variant="outline" onClick={clearCanvas} className="rounded-full">
                    <Eraser className="w-4 h-4 mr-2" /> Clear
                  </Button>
                </div>

                {/* Canvas */}
                <div className="border-4 border-slate-200 rounded-2xl overflow-hidden mb-6">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="cursor-crosshair w-full"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </div>

                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => setCurrentStep(3)} className="rounded-full px-8">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button 
                    onClick={convertDoodleToCharacter}
                    disabled={converting}
                    className="rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#4F46E5] hover:to-[#7C3AED] text-white px-8"
                  >
                    {converting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2"
                        />
                        Converting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" /> Convert to Character
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Result */}
          {convertedImage && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white rounded-3xl shadow-2xl p-8">
                <h2 className="text-2xl font-heading font-bold text-[#1E293B] mb-2 text-center">
                  ✨ Your Character is Ready!
                </h2>
                <p className="text-[#64748B] text-center mb-8">
                  Your doodle has been transformed into a beautiful {characterStyle} character
                </p>

                <div className="grid md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <p className="text-sm font-bold text-[#94A3B8] uppercase mb-3">Original Doodle</p>
                    <canvas ref={canvasRef} className="w-full border-2 border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#94A3B8] uppercase mb-3">AI-Enhanced Character</p>
                    <img 
                      src={convertedImage} 
                      alt="Converted character"
                      className="w-full border-2 border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => { setConvertedImage(null); setCurrentStep(4); }} className="rounded-full px-8">
                    Draw Again
                  </Button>
                  <Button 
                    onClick={createStoryWithCharacter}
                    className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white px-8"
                  >
                    Create Story with This Character <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
