import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Sparkles, ArrowRight, Play, Brain, MessageCircle, 
  BookOpen, BarChart2, Shield, Heart, CheckCircle, Star, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

// Twinnee Logo & Hero Mascot
const TWINNEE_LOGO = "/twinnee-logo.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({ 
    opacity: 1, 
    y: 0, 
    transition: { delay: i * 0.1, type: 'spring', stiffness: 200, damping: 25 } 
  }),
};

export const LandingPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('storycraft_token');

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#f4f0fb' }}>
      
      {/* Navbar */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        className="fixed top-0 left-0 right-0 z-50"
        style={{ background: 'rgba(244, 240, 251, 0.95)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-full px-4 py-2 mt-4 shadow-lg flex items-center justify-between"
            style={{ boxShadow: '0 4px 30px rgba(0, 0, 0, 0.08)' }}>
            
            {/* Logo */}
            <div className="flex items-center gap-2" data-testid="landing-logo">
              <img src="/twinnee-logo.png" alt="TWINNEE" className="w-9 h-9 object-contain" />
              <span className="font-heading font-black text-xl tracking-tight" style={{ color: '#1a1a2e' }}>
                Twinnee
              </span>
            </div>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#how-it-works" className="text-sm font-medium transition-colors hover:text-purple-600" 
                style={{ color: '#64748B' }}>
                How it works
              </a>
              <a href="#parents" className="text-sm font-medium transition-colors hover:text-purple-600" 
                style={{ color: '#64748B' }}>
                For Parents
              </a>
              <a href="#stories" className="text-sm font-medium transition-colors hover:text-purple-600" 
                style={{ color: '#64748B' }}>
                Stories
              </a>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center gap-3">
              <ThemeSwitcher />
              {token ? (
                <Button
                  onClick={() => navigate('/dashboard')}
                  data-testid="landing-dashboard-btn"
                  className="rounded-full font-bold px-6 text-sm transition-all hover:scale-105"
                  style={{ background: '#8B5CF6', color: 'white' }}
                >
                  Go to Dashboard
                </Button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    data-testid="landing-login-btn"
                    className="font-bold text-sm px-4 py-2 rounded-full transition-all hover:bg-gray-100"
                    style={{ color: '#1a1a2e' }}
                  >
                    Log in
                  </button>
                  <Button
                    onClick={() => navigate('/register')}
                    data-testid="landing-register-btn"
                    className="rounded-full font-bold px-6 text-sm transition-all hover:scale-105"
                    style={{ background: '#8B5CF6', color: 'white' }}
                  >
                    Get Twinnee
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Left Content */}
            <motion.div initial="hidden" animate="visible" className="space-y-6">
              {/* Badge */}
              <motion.div custom={0} variants={fadeUp}>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold"
                  style={{ 
                    background: 'linear-gradient(135deg, #eef2ff 0%, #fdf2f8 100%)',
                    color: '#EC4899',
                    border: '1px solid #fce7f3'
                  }}>
                  <Sparkles className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                  DIGITAL TWIN OF YOUR KIDS
                </span>
              </motion.div>

              {/* Main Heading */}
              <motion.h1 custom={1} variants={fadeUp}>
                <span className="font-heading font-black text-5xl sm:text-6xl lg:text-7xl block leading-tight"
                  style={{ color: '#1a1a2e' }}>
                  Meet{' '}
                  <span className="gradient-text-hero">
                    Twinnee
                  </span>
                </span>
              </motion.h1>

              {/* Subtitle */}
              <motion.h2 custom={2} variants={fadeUp} 
                className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl leading-tight"
                style={{ color: '#1a1a2e' }}>
                Your Child's<br />
                Smart Companion
              </motion.h2>

              {/* Description */}
              <motion.p custom={3} variants={fadeUp} 
                className="text-base sm:text-lg max-w-md leading-relaxed"
                style={{ color: '#64748B' }}>
                A friendly AI-powered companion that learns, grows, and interacts—helping them build habits and stay balanced.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div custom={4} variants={fadeUp} className="flex flex-wrap gap-4 pt-4">
                <Button
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="rounded-full font-bold px-8 py-6 text-base transition-all hover:scale-105 group"
                  style={{ background: '#8B5CF6', color: 'white', boxShadow: '0 8px 30px rgba(139, 92, 246, 0.35)' }}
                  data-testid="hero-get-started-btn"
                >
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="rounded-full font-bold px-8 py-6 text-base transition-all hover:scale-105"
                  style={{ 
                    background: 'white', 
                    borderColor: '#e2e8f0', 
                    color: '#1a1a2e',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
                  }}
                  data-testid="hero-demo-btn"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Watch Demo
                </Button>
              </motion.div>
            </motion.div>

            {/* Right Content - Mascot */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="relative flex items-center justify-center"
            >
              <motion.img
                src={TWINNEE_LOGO}
                alt="TWINNEE - Your AI Companion"
                className="w-full max-w-lg drop-shadow-2xl"
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                data-testid="hero-mascot-image"
              />
              
              {/* Decorative Glow */}
              <div className="absolute inset-0 rounded-full opacity-40 blur-3xl -z-10"
                style={{ 
                  background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
                  transform: 'scale(1.2)'
                }} 
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-heading font-black text-3xl sm:text-4xl lg:text-5xl mb-4"
              style={{ color: '#1a1a2e' }}>
              What is <span style={{ color: '#8B5CF6' }}>TWINNEE</span>?
            </h2>
            <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{ color: '#64748B' }}>
              TWINNEE is an intelligent AI companion that talks like a friend, thinks like a guide, and grows with your child.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: MessageCircle, title: 'Talks like a friend', color: '#8B5CF6', bg: '#8B5CF620' },
              { icon: Brain, title: 'Thinks like a guide', color: '#F59E0B', bg: '#F59E0B20' },
              { icon: BarChart2, title: 'Tracks like an assistant', color: '#10B981', bg: '#10B98120' },
              { icon: Heart, title: 'Grows with your child', color: '#EC4899', bg: '#EC489920' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl p-6 hover:scale-105 transition-all cursor-pointer"
                style={{ boxShadow: '0 4px 30px rgba(0, 0, 0, 0.06)' }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: item.bg }}>
                  <item.icon className="w-7 h-7" style={{ color: item.color }} />
                </div>
                <h3 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
                  {item.title}
                </h3>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stories Section */}
      <section id="stories" className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-heading font-black text-3xl sm:text-4xl mb-6"
                style={{ color: '#1a1a2e' }}>
                Powered by <span style={{ color: '#8B5CF6' }}>Stories</span>
              </h2>
              <p className="text-base sm:text-lg mb-6" style={{ color: '#64748B' }}>
                Children learn best through stories—and TWINNEE makes them part of the adventure.
              </p>
              
              <div className="space-y-4">
                {[
                  { icon: BookOpen, text: 'Interactive storytelling', color: '#8B5CF6' },
                  { icon: Sparkles, text: 'Choice-based adventures', color: '#EC4899' },
                  { icon: Heart, text: 'Personalized characters', color: '#F59E0B' },
                  { icon: Star, text: 'Embedded life lessons', color: '#10B981' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${item.color}20` }}>
                      <item.icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <span className="font-medium" style={{ color: '#1a1a2e' }}>{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-3xl p-8"
              style={{ boxShadow: '0 4px 30px rgba(0, 0, 0, 0.08)' }}
            >
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)' }}>
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 rounded-2xl rounded-tl-sm p-4"
                    style={{ background: '#f4f0fb' }}>
                    <p className="text-sm" style={{ color: '#1a1a2e' }}>
                      Hey there! Want to create a fun story together or chat about your day?
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="flex-1 max-w-[80%] rounded-2xl rounded-tr-sm p-4"
                    style={{ background: '#f1f5f9' }}>
                    <p className="text-sm" style={{ color: '#1a1a2e' }}>
                      I want to make a story about a dragon!
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)' }}>
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 rounded-2xl rounded-tl-sm p-4"
                    style={{ background: '#f4f0fb' }}>
                    <p className="text-sm" style={{ color: '#1a1a2e' }}>
                      Awesome! Should the dragon be friendly or brave and fierce?
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* For Parents Section */}
      <section id="parents" className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-heading font-black text-3xl sm:text-4xl lg:text-5xl mb-4"
              style={{ color: '#1a1a2e' }}>
              Built for <span style={{ color: '#8B5CF6' }}>Parents</span> Too
            </h2>
            <p className="text-base sm:text-lg max-w-2xl mx-auto" style={{ color: '#64748B' }}>
              Stay in control with simple, meaningful updates
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: BarChart2, title: 'Simple behavior reports', color: '#8B5CF6' },
              { icon: Brain, title: 'Growth insights', color: '#10B981' },
              { icon: Heart, title: 'Smart alerts', color: '#EC4899' },
              { icon: Shield, title: 'Privacy-first design', color: '#F59E0B' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl p-6 text-center"
                style={{ boxShadow: '0 4px 30px rgba(0, 0, 0, 0.06)' }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: `${item.color}15` }}>
                  <item.icon className="w-8 h-8" style={{ color: item.color }} />
                </div>
                <h3 className="font-bold text-base" style={{ color: '#1a1a2e' }}>
                  {item.title}
                </h3>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-8 text-sm italic" style={{ color: '#64748B' }}
          >
            No overwhelming dashboards—just meaningful updates.
          </motion.p>
        </div>
      </section>

      {/* Why Kids Love Section */}
      <section className="py-20 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-3xl p-12"
            style={{ boxShadow: '0 4px 30px rgba(0, 0, 0, 0.08)' }}
          >
            <h2 className="font-heading font-black text-3xl sm:text-4xl text-center mb-8"
              style={{ color: '#1a1a2e' }}>
              Why Kids Love <span style={{ color: '#8B5CF6' }}>TWINNEE</span>
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                'Feels like a friend, not a teacher',
                'Fun, interactive storytelling',
                'No pressure or judgment',
                'Personalized just for them',
              ].map((text, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle className="w-6 h-6 shrink-0" style={{ color: '#10B981' }} />
                  <p className="font-medium" style={{ color: '#1a1a2e' }}>
                    {text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Safety Section */}
      <section className="py-20 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
              style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)' }}>
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h2 className="font-heading font-black text-3xl sm:text-4xl mb-6"
              style={{ color: '#1a1a2e' }}>
              Safe. Private. <span style={{ color: '#8B5CF6' }}>Responsible.</span>
            </h2>
            <div className="space-y-3 text-base max-w-xl mx-auto" style={{ color: '#64748B' }}>
              {[
                'Designed for children\'s well-being',
                'No harmful engagement loops',
                'Transparent parent controls',
                'Privacy-first architecture',
              ].map((text, i) => (
                <p key={i} className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />
                  {text}
                </p>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl mb-6"
              style={{ color: '#1a1a2e' }}>
              Start Your Child's <br />
              <span className="gradient-text-hero">
                Journey Today
              </span>
            </h2>
            <p className="text-lg sm:text-xl mb-10 max-w-2xl mx-auto" style={{ color: '#64748B' }}>
              Help your child grow with a companion that understands them.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/register')}
              className="rounded-full font-bold px-12 py-8 text-xl transition-all hover:scale-110"
              style={{ 
                background: '#8B5CF6', 
                color: 'white',
                boxShadow: '0 12px 40px rgba(139, 92, 246, 0.4)'
              }}
              data-testid="final-cta-btn"
            >
              Get Started Now
              <ArrowRight className="w-6 h-6 ml-3" />
            </Button>
            <p className="text-xs mt-6" style={{ color: '#94A3B8' }}>
              Free to start • No credit card required
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t relative z-10" style={{ borderColor: '#e2e8f0' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-lg" style={{ color: '#1a1a2e' }}>
                Twinnee
              </span>
              <span className="w-2 h-2 rounded-full" style={{ background: '#8B5CF6' }}></span>
            </div>
            <p className="text-sm italic" style={{ color: '#64748B' }}>
              Growing with your child, one conversation at a time.
            </p>
            <div className="text-xs" style={{ color: '#94A3B8' }}>
              © 2025 TWINNEE. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

      {/* Custom Gradient Text Style */}
      <style>{`
        .gradient-text-hero {
          background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F59E0B 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 900;
        }
      `}</style>
    </div>
  );
};
