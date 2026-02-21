import { useState, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Hook for handling Fotor API cartoonization
 * Manages template fetching, job creation, and polling
 */
export const useCartoonization = () => {
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pollingTaskId, setPollingTaskId] = useState(null);
  const [cartoonResult, setCartoonResult] = useState(null);

  /**
   * Fetch available cartoon templates from Fotor
   */
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await api.get('/fotor/templates');
      setTemplates(data.templates || []);
      return data.templates || [];
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load cartoon styles');
      return [];
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  /**
   * Start cartoonization job
   * @param {string} imageUrl - Full URL of the image to cartoonize
   * @param {string} templateId - Selected template ID
   */
  const startCartoonization = useCallback(async (imageUrl, templateId = 'cartoon_1') => {
    setGenerating(true);
    setCartoonResult(null);
    
    try {
      // Convert relative API URLs to absolute URLs
      let fullImageUrl = imageUrl;
      if (imageUrl.startsWith('/api/media/')) {
        fullImageUrl = `${BACKEND_URL}${imageUrl}`;
      }

      const { data } = await api.post('/fotor/generate', {
        image_url: fullImageUrl,
        template_id: templateId
      });

      const taskId = data.task_id;
      if (!taskId) {
        throw new Error('No task ID returned');
      }

      setPollingTaskId(taskId);
      toast.success('Cartoonization started! This may take a moment...');
      
      // Start polling
      await pollTaskStatus(taskId);
      
      return taskId;
    } catch (error) {
      console.error('Cartoonization failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to start cartoonization');
      setGenerating(false);
      throw error;
    }
  }, []);

  /**
   * Poll task status until completion
   * @param {string} taskId - Fotor task ID
   * @param {number} maxAttempts - Maximum polling attempts
   */
  const pollTaskStatus = useCallback(async (taskId, maxAttempts = 60) => {
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setGenerating(false);
        setPollingTaskId(null);
        toast.error('Cartoonization timed out. Please try again.');
        return null;
      }

      try {
        const { data } = await api.get(`/fotor/tasks/${taskId}`);
        const status = data.status?.toLowerCase();

        if (status === 'completed' || status === 'success') {
          // Success!
          setCartoonResult(data.result_url);
          setGenerating(false);
          setPollingTaskId(null);
          toast.success('Cartoonization completed!');
          return data.result_url;
        } else if (status === 'failed' || status === 'error') {
          // Failed
          setGenerating(false);
          setPollingTaskId(null);
          toast.error('Cartoonization failed. Please try again.');
          return null;
        } else {
          // Still processing - poll again after 2 seconds
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
          return poll();
        }
      } catch (error) {
        console.error('Polling error:', error);
        attempts++;
        // Continue polling on error (might be temporary network issue)
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          return poll();
        } else {
          setGenerating(false);
          setPollingTaskId(null);
          toast.error('Failed to check cartoonization status');
          return null;
        }
      }
    };

    return poll();
  }, []);

  /**
   * Reset cartoonization state
   */
  const resetCartoonization = useCallback(() => {
    setCartoonResult(null);
    setPollingTaskId(null);
    setGenerating(false);
  }, []);

  return {
    // State
    templates,
    loadingTemplates,
    generating,
    pollingTaskId,
    cartoonResult,
    
    // Actions
    fetchTemplates,
    startCartoonization,
    resetCartoonization
  };
};
