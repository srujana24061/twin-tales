import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Sparkles, Shield, Palette, FileText, ArrowRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, type: 'spring', stiffness: 200, damping: 25 } }),
};

const FloatingBlob = ({ className, delay = 0 }) => (
  <motion.div
    className={`absolute rounded-full opacity-20 blur-3xl ${className}`}
    animate={{ y: [0, -25, 0], scale: [1, 1.05, 1] }}
    transition={{ duration: 6 + delay, repeat: Infinity, ease: 'easeInOut' }}
  />
);

const features = [
  { icon: Sparkles, title: 'AI Story Generation', desc: 'Create unique stories from a topic or let AI transform your ideas into illustrated scenes.', color: '#6366F1' },
  { icon: Palette, title: 'Scene Illustrations', desc: 'Every scene gets a beautiful AI-generated illustration in your chosen visual style.', color: '#F59E0B' },
  { icon: Shield, title: 'Child-Safe AI', desc: 'Built-in Responsible AI checks ensure every story is safe and age-appropriate.', color: '#10B981' },
  { icon: FileText, title: 'PDF Story Books', desc: 'Export your illustrated stories as beautiful PDF books to share and print.', color: '#EC4899' },
];

export const LandingPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('storycraft_token');

  return (
    <div className="min-h-screen bg-paper relative overflow-hidden">
      <FloatingBlob className="w-96 h-96 bg-[#6366F1] top-10 -left-48" delay={0} />
      <FloatingBlob className="w-80 h-80 bg-[#F59E0B] top-60 right-0" delay={2} />
      <FloatingBlob className="w-72 h-72 bg-[#EC4899] bottom-20 left-1/3" delay={4} />

      {/* Navbar */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        className="fixed top-0 left-0 right-0 z-50 glass-panel"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2" data-testid="landing-logo">
            <BookOpen className="w-7 h-7 text-[#6366F1]" />
            <span className="font-heading font-extrabold text-xl tracking-tight">
              Story<span className="text-[#6366F1]">Craft</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {token ? (
              <Button
                onClick={() => navigate('/dashboard')}
                data-testid="landing-dashboard-btn"
                className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent px-6 shadow-lg shadow-[#6366F1]/25 hover:scale-105 transition-all"
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/login')}
                  data-testid="landing-login-btn"
                  className="rounded-full font-medium text-[#64748B] hover:text-[#1E293B]"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => navigate('/register')}
                  data-testid="landing-register-btn"
                  className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent px-6 shadow-lg shadow-[#6366F1]/25 hover:scale-105 transition-all"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-44 md:pb-32 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div initial="hidden" animate="visible" className="space-y-8">
              <motion.div custom={0} variants={fadeUp} className="inline-flex items-center gap-2 bg-[#EEF2FF] text-[#6366F1] px-4 py-2 rounded-full text-sm font-medium">
                <Star className="w-4 h-4" />
                Responsible AI for Kids
              </motion.div>
              <motion.h1 custom={1} variants={fadeUp} className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-[1.1]">
                Create <span className="gradient-text">Magical Stories</span> for Your Little Ones
              </motion.h1>
              <motion.p custom={2} variants={fadeUp} className="text-base md:text-lg text-[#64748B] max-w-lg leading-relaxed">
                Turn your child into the hero of their own AI-illustrated storybook. Safe, personalized, and ready to print as a beautiful PDF.
              </motion.p>
              <motion.div custom={3} variants={fadeUp} className="flex flex-wrap gap-4">
                <Button
                  onClick={() => navigate(token ? '/stories/new' : '/register')}
                  data-testid="hero-cta-btn"
                  className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent text-lg px-8 py-6 shadow-xl shadow-[#6366F1]/25 hover:scale-105 active:scale-95 transition-all"
                >
                  Create Your Story <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="hero-learn-more-btn"
                  className="rounded-full text-[#64748B] border-2 border-slate-200 px-8 py-6 hover:border-[#6366F1] hover:text-[#6366F1] transition-all"
                >
                  Learn More
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 40 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 150 }}
              className="relative"
            >
              <div className="glass-panel rounded-3xl p-3 shadow-2xl shadow-[#6366F1]/10">
                <img
                  src="https://images.unsplash.com/photo-1767356326735-2da0a10cf1f0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzV8MHwxfHNlYXJjaHwxfHxjdXRlJTIwa2lkJTIwcmVhZGluZyUyMGJvb2slMjBtYWdpY3xlbnwwfHx8fDE3NzE2NjYwNjZ8MA&ixlib=rb-4.1.0&q=85"
                  alt="Child reading a magical book"
                  className="w-full rounded-2xl object-cover aspect-[4/3]"
                />
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-6 -right-6 glass-panel rounded-2xl p-4 shadow-lg"
                >
                  <Sparkles className="w-8 h-8 text-[#F59E0B]" />
                </motion.div>
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="absolute -bottom-4 -left-4 glass-panel rounded-2xl px-4 py-3 shadow-lg flex items-center gap-2"
                >
                  <Shield className="w-5 h-5 text-[#10B981]" />
                  <span className="text-sm font-medium text-[#1E293B]">Child-Safe AI</span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-32 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight mb-4">
              Everything You Need to Create <span className="gradient-text">Amazing Stories</span>
            </h2>
            <p className="text-base md:text-lg text-[#64748B] max-w-2xl mx-auto">
              From character creation to illustrated PDF exports, StoryCraft AI handles the entire storytelling pipeline.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="bg-white rounded-3xl p-8 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.08)] border border-slate-100 hover:shadow-[0_20px_60px_-15px_rgba(99,102,241,0.15)] transition-shadow duration-300"
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: feat.color + '15' }}
                >
                  <feat.icon className="w-7 h-7" style={{ color: feat.color }} />
                </div>
                <h3 className="font-heading font-bold text-lg mb-3 text-[#1E293B]">{feat.title}</h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 md:py-32 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-panel rounded-3xl p-3"
            >
              <img
                src="https://images.unsplash.com/photo-1758687127068-816ae9b29c0c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwzfHxwYXJlbnQlMjBhbmQlMjBjaGlsZCUyMHJlYWRpbmclMjB0YWJsZXR8ZW58MHx8fHwxNzcxNjY2MDY3fDA&ixlib=rb-4.1.0&q=85"
                alt="Parent and child reading together"
                className="w-full rounded-2xl object-cover aspect-[4/3]"
              />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h2 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight">
                Built with <span className="text-[#10B981]">Responsible AI</span>
              </h2>
              <p className="text-base md:text-lg text-[#64748B] leading-relaxed">
                Every story passes through our 6-pillar safety framework before it reaches your child. Fairness, transparency, privacy, safety, accountability, and human oversight built into every generation.
              </p>
              <div className="space-y-4">
                {['Content moderation on every scene', 'No bias or stereotypes', 'Parent approval before export', 'AI-generated badge on all content'].map((item, i) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#ECFDF5] flex items-center justify-center flex-shrink-0">
                      <Shield className="w-3.5 h-3.5 text-[#10B981]" />
                    </div>
                    <span className="text-sm font-medium text-[#1E293B]">{item}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-panel rounded-3xl p-12 md:p-16"
          >
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl tracking-tight mb-4">
              Ready to Create Something Magical?
            </h2>
            <p className="text-base md:text-lg text-[#64748B] mb-8 max-w-xl mx-auto">
              Join parents and teachers who are creating personalized, safe story experiences for their children.
            </p>
            <Button
              onClick={() => navigate(token ? '/stories/new' : '/register')}
              data-testid="cta-get-started-btn"
              className="rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-accent text-lg px-10 py-6 shadow-xl shadow-[#6366F1]/25 hover:scale-105 active:scale-95 transition-all"
            >
              Get Started Free <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 relative z-10 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-[#64748B]">
            StoryCraft AI — Responsible AI Kids Story Generator. Made with care.
          </p>
        </div>
      </footer>
    </div>
  );
};
