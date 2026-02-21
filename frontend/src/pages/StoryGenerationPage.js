import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle, XCircle, Loader2, BookOpen, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import api from '@/lib/api';

const steps = [
  { key: 'text', label: 'Generating Story Text', range: [0, 25] },
  { key: 'safety', label: 'Running Safety Checks', range: [25, 40] },
  { key: 'images', label: 'Creating Illustrations', range: [40, 95] },
  { key: 'done', label: 'Finalizing', range: [95, 100] },
];

export const StoryGenerationPage = () => {
  const { storyId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('job');
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (jobId) {
      pollJob();
      pollRef.current = setInterval(pollJob, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  const pollJob = async () => {
    try {
      const { data } = await api.get(`/jobs/${jobId}`);
      setJob(data);
      if (data.status === 'completed') {
        clearInterval(pollRef.current);
        toast.success('Story generated successfully!');
      } else if (data.status === 'failed') {
        clearInterval(pollRef.current);
        setError(data.error_message || 'Generation failed');
        toast.error('Generation failed');
      }
    } catch (err) {
      setError('Failed to check status');
    }
  };

  const retryGeneration = async () => {
    try {
      setError(null);
      setJob(null);
      const { data } = await api.post(`/stories/${storyId}/generate`);
      const newJobId = data.job_id;
      window.history.replaceState(null, '', `?job=${newJobId}`);
      pollRef.current = setInterval(async () => {
        try {
          const { data: jd } = await api.get(`/jobs/${newJobId}`);
          setJob(jd);
          if (jd.status === 'completed' || jd.status === 'failed') {
            clearInterval(pollRef.current);
            if (jd.status === 'failed') setError(jd.error_message);
          }
        } catch (_) {}
      }, 2000);
    } catch (err) {
      toast.error('Failed to retry');
    }
  };

  const progress = job?.progress || 0;
  const currentStep = steps.find(s => progress >= s.range[0] && progress < s.range[1]) || steps[steps.length - 1];
  const isComplete = job?.status === 'completed';
  const isFailed = job?.status === 'failed';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pb-20" data-testid="story-generation-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <div className="mb-10">
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight mb-2">
            {isComplete ? (
              <span className="text-[#10B981]">Story Ready!</span>
            ) : isFailed ? (
              <span className="text-[#FF6B6B]">Generation Failed</span>
            ) : (
              <span className="gradient-text">Creating Your Story</span>
            )}
          </h1>
          <p className="text-[#64748B]">
            {isComplete ? 'Your illustrated story is ready to explore' : isFailed ? 'Something went wrong during generation' : 'AI is crafting your personalized story...'}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] border border-slate-100">
          {/* Main Progress */}
          {!isFailed && (
            <div className="mb-10">
              <motion.div
                animate={!isComplete ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center"
                style={{ backgroundColor: isComplete ? '#ECFDF5' : '#EEF2FF' }}
              >
                {isComplete ? (
                  <CheckCircle className="w-12 h-12 text-[#10B981]" />
                ) : (
                  <Sparkles className="w-12 h-12 text-[#6366F1]" />
                )}
              </motion.div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-[#1E293B]">{isComplete ? 'Complete!' : currentStep.label}</span>
                  <span className="font-bold text-[#6366F1]">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3 rounded-full" data-testid="generation-progress-bar" />
              </div>
            </div>
          )}

          {isFailed && (
            <div className="mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-red-50 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-[#FF6B6B]" />
              </div>
              {error && <p className="text-sm text-[#FF6B6B] mb-4 bg-red-50 rounded-xl p-4">{error}</p>}
            </div>
          )}

          {/* Step Indicators */}
          <div className="space-y-3 mb-8">
            {steps.map((step, i) => {
              const isDone = progress > step.range[1];
              const isCurrent = progress >= step.range[0] && progress <= step.range[1];
              return (
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm ${
                    isDone ? 'bg-[#ECFDF5] text-[#10B981]' : isCurrent ? 'bg-[#EEF2FF] text-[#6366F1]' : 'bg-slate-50 text-[#94A3B8]'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-current flex-shrink-0" />
                  )}
                  <span className="font-medium">{step.label}</span>
                </motion.div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {isComplete && (
              <>
                <Button
                  onClick={() => navigate(`/stories/${storyId}/edit`)}
                  data-testid="view-story-btn"
                  className="flex-1 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent shadow-lg shadow-[#6366F1]/25 hover:scale-105 active:scale-95 transition-all h-12"
                >
                  <BookOpen className="w-5 h-5 mr-2" /> View Story <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  data-testid="back-dashboard-btn"
                  className="flex-1 rounded-full border-2 border-slate-200 hover:border-[#6366F1] h-12"
                >
                  Dashboard
                </Button>
              </>
            )}
            {isFailed && (
              <>
                <Button
                  onClick={retryGeneration}
                  data-testid="retry-generation-btn"
                  className="flex-1 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent shadow-lg shadow-[#6366F1]/25 h-12"
                >
                  <RefreshCw className="w-5 h-5 mr-2" /> Retry
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 rounded-full border-2 border-slate-200 h-12"
                >
                  Dashboard
                </Button>
              </>
            )}
          </div>
        </div>

        {/* AI Badge */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <Badge className="bg-[#EEF2FF] text-[#6366F1] rounded-full px-3 py-1 font-medium text-xs">
            <Sparkles className="w-3 h-3 mr-1" /> AI Generated Content
          </Badge>
          <Badge className="bg-[#ECFDF5] text-[#10B981] rounded-full px-3 py-1 font-medium text-xs">
            Responsible AI Checked
          </Badge>
        </div>
      </motion.div>
    </div>
  );
};
