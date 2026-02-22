import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Eraser, Undo, Download, Sparkles, Loader2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import api from '@/lib/api';

// Color palette for drawing
const COLORS = [
  '#1E293B', // Dark
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#FFFFFF', // White (eraser effect)
];

export const DoodleCanvasModal = ({ 
  isOpen, 
  onClose, 
  sceneId, 
  sceneTitle,
  onImageGenerated 
}) => {
  const canvasRef = useRef(null);
  const [ctx, setCtx] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#1E293B');
  const [isConverting, setIsConverting] = useState(false);
  const [history, setHistory] = useState([]);

  // Initialize canvas
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      context.lineCap = 'round';
      context.lineJoin = 'round';
      setCtx(context);
      
      // Set white background
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Save initial state
      saveToHistory();
    }
  }, [isOpen]);

  const saveToHistory = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      setHistory(prev => [...prev, canvas.toDataURL()]);
    }
  };

  const undo = () => {
    if (history.length > 1 && ctx) {
      const newHistory = [...history];
      newHistory.pop();
      setHistory(newHistory);
      
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = newHistory[newHistory.length - 1];
    }
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !ctx) return;
    e.preventDefault();
    
    const { x, y } = getCoordinates(e);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
  };

  const clearCanvas = () => {
    if (ctx && canvasRef.current) {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      saveToHistory();
    }
  };

  const convertDoodleToImage = async () => {
    if (!canvasRef.current) return;

    setIsConverting(true);
    try {
      const canvas = canvasRef.current;
      const imageDataUrl = canvas.toDataURL('image/png');
      const base64Data = imageDataUrl.split(',')[1];

      toast.info('Converting your doodle with Nano Banana AI...');

      const { data } = await api.post(`/scenes/${sceneId}/doodle-to-image`, {
        doodle_base64: base64Data,
        scene_title: sceneTitle
      });

      if (data.image_url) {
        toast.success('Your doodle has been transformed!');
        onImageGenerated(data.image_url);
        onClose();
      }
    } catch (error) {
      console.error('Doodle conversion error:', error);
      toast.error(error.response?.data?.detail || 'Failed to convert doodle. Please try again.');
    } finally {
      setIsConverting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden"
          data-testid="doodle-canvas-modal"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)' }}>
            <div className="flex items-center gap-3">
              <Pencil className="w-5 h-5 text-white" />
              <div>
                <h3 className="font-bold text-white">Draw Your Scene</h3>
                <p className="text-xs text-white/80">Sketch it, AI will transform it</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
              data-testid="close-doodle-modal"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Tools */}
          <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-4 flex-wrap">
            {/* Brush Size */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Size:</span>
              <input
                type="range"
                min="2"
                max="30"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20 accent-purple-600"
                data-testid="brush-size-slider"
              />
              <span className="text-xs font-mono text-gray-700 w-8">{brushSize}px</span>
            </div>

            {/* Color Palette */}
            <div className="flex items-center gap-1">
              <Palette className="w-4 h-4 text-gray-500 mr-1" />
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setBrushColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    brushColor === color ? 'border-purple-600 scale-110' : 'border-gray-300'
                  }`}
                  style={{ 
                    background: color,
                    boxShadow: color === '#FFFFFF' ? 'inset 0 0 0 1px #e5e7eb' : 'none'
                  }}
                  data-testid={`color-${color}`}
                />
              ))}
            </div>

            <div className="flex-1" />

            {/* Actions */}
            <Button
              size="sm"
              variant="outline"
              onClick={undo}
              disabled={history.length <= 1}
              className="rounded-lg"
              data-testid="undo-btn"
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearCanvas}
              className="rounded-lg"
              data-testid="clear-canvas-btn"
            >
              <Eraser className="w-4 h-4 mr-1" /> Clear
            </Button>
          </div>

          {/* Canvas */}
          <div className="p-6 flex justify-center" style={{ background: '#f8fafc' }}>
            <div className="border-4 border-gray-200 rounded-2xl overflow-hidden shadow-inner"
              style={{ background: 'white' }}>
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="cursor-crosshair touch-none"
                style={{ width: '400px', height: '400px' }}
                data-testid="doodle-canvas"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Draw a rough sketch - AI will convert it into a polished scene image
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-full px-6"
                data-testid="cancel-doodle-btn"
              >
                Cancel
              </Button>
              <Button
                onClick={convertDoodleToImage}
                disabled={isConverting}
                className="rounded-full px-6"
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)', color: 'white' }}
                data-testid="convert-doodle-btn"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Convert to Image
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DoodleCanvasModal;
