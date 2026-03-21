import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

/**
 * Hook for handling Gemini-powered image style conversion
 * Supports multiple artistic styles: cartoon, anime, pixar, toy, comic, watercolor, sketch, realistic
 */
export const useImageStyleConversion = () => {
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [converting, setConverting] = useState(false);
  const [styledResult, setStyledResult] = useState(null);

  /**
   * Fetch available style templates
   */
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await api.get('/image-styles/templates');
      setTemplates(data.templates || []);
      return data.templates || [];
    } catch (error) {
      console.error('Failed to fetch style templates:', error);
      toast.error('Failed to load style options');
      return [];
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  /**
   * Convert image to selected artistic style
   * @param {string} imageUrl - Full URL of the image to convert
   * @param {string} style - Selected style (cartoon, anime, pixar, etc.)
   */
  const convertImageStyle = useCallback(async (imageUrl, style = 'cartoon') => {
    setConverting(true);
    setStyledResult(null);
    
    try {
      // Convert relative API URLs to absolute URLs
      let fullImageUrl = imageUrl;
      if (imageUrl.startsWith('/api/media/')) {
        fullImageUrl = `${BACKEND_URL}${imageUrl}`;
      }

      toast.info(`Converting to ${style} style...`);

      const { data } = await api.post('/image-styles/convert', {
        image_url: fullImageUrl,
        style: style
      });

      if (data.status === 'completed' && data.result_base64) {
        // Convert base64 to data URL for display
        const dataUrl = `data:image/png;base64,${data.result_base64}`;
        setStyledResult({
          url: dataUrl,
          base64: data.result_base64,
          style: style
        });
        toast.success(`${style.charAt(0).toUpperCase() + style.slice(1)} style applied!`);
        return {
          url: dataUrl,
          base64: data.result_base64,
          style: style
        };
      } else {
        throw new Error('No image data in response');
      }
    } catch (error) {
      console.error('Style conversion failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to convert image style');
      throw error;
    } finally {
      setConverting(false);
    }
  }, []);

  /**
   * Reset conversion state
   */
  const resetConversion = useCallback(() => {
    setStyledResult(null);
    setConverting(false);
  }, []);

  return {
    // State
    templates,
    loadingTemplates,
    converting,
    styledResult,
    
    // Actions
    fetchTemplates,
    convertImageStyle,
    resetConversion
  };
};
